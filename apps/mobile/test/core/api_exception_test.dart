import 'package:at_tayyibun/core/api_exception.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

ApiException _noResponse(DioExceptionType type, {String? message}) =>
    ApiException.fromDio(DioException(
      requestOptions: RequestOptions(path: '/x'),
      type: type,
      message: message,
    ));

ApiException _status(int status, Object? data) {
  final options = RequestOptions(path: '/x');
  return ApiException.fromDio(DioException(
    requestOptions: options,
    type: DioExceptionType.badResponse,
    response: Response(requestOptions: options, statusCode: status, data: data),
  ));
}

void main() {
  group('network failure', () {
    for (final type in [
      DioExceptionType.connectionError,
      DioExceptionType.connectionTimeout,
      DioExceptionType.sendTimeout,
      DioExceptionType.receiveTimeout,
      DioExceptionType.unknown,
    ]) {
      test('$type counts as a network failure', () {
        final e = _noResponse(type);
        expect(e.isNetworkFailure, isTrue);
        expect(e.isTemporaryFailure, isTrue);
      });
    }

    test('never shows the raw Dio message to the user', () {
      final e = _noResponse(
        DioExceptionType.unknown,
        message: 'SocketException: Failed host lookup: attayyibun.com',
      );
      expect(e.message, isNot(contains('SocketException')));
    });
  });

  group('temporary vs definitive answers', () {
    test('5xx and 429 are temporary but not network failures', () {
      for (final status in [500, 502, 503, 429]) {
        final e = _status(status, 'nope');
        expect(e.isTemporaryFailure, isTrue, reason: '$status');
        expect(e.isNetworkFailure, isFalse, reason: '$status');
      }
    });

    test('401 and 403 are definitive', () {
      expect(_status(401, {'message': 'no'}).isTemporaryFailure, isFalse);
      expect(_status(403, {'message': 'no'}).isTemporaryFailure, isFalse);
    });
  });

  group('suspension', () {
    test('recognises the code the API guard sends', () {
      final e = _status(403, {
        'message': 'This account is suspended.',
        'code': 'ACCOUNT_SUSPENDED',
      });
      expect(e.isSuspended, isTrue);
    });

    test('another 403 is not a suspension', () {
      final e = _status(403, {
        'message': 'Phone verification required',
        'code': 'PHONE_VERIFICATION_REQUIRED',
      });
      expect(e.isSuspended, isFalse);
    });
  });
}
