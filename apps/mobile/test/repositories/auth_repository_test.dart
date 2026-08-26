import 'dart:convert';
import 'dart:typed_data';

import 'package:at_tayyibun/core/api_client.dart';
import 'package:at_tayyibun/core/api_exception.dart';
import 'package:at_tayyibun/repositories/auth_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

class _MockHttpAdapter implements HttpClientAdapter {
  _MockHttpAdapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) {
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ApiClient _createTestApiClient(
  Future<ResponseBody> Function(RequestOptions options) handler,
) {
  final dio = Dio(
    BaseOptions(
      baseUrl: 'https://attayyibun.test',
      responseType: ResponseType.json,
    ),
  );
  dio.httpClientAdapter = _MockHttpAdapter(handler);
  return ApiClient.forTesting(dio);
}

ResponseBody _jsonResponse(dynamic data, {int statusCode = 200}) {
  final str = jsonEncode(data);
  return ResponseBody.fromString(
    str,
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}

void main() {
  group('AuthRepository session confirmation', () {
    test('Exchange response followed by null session throws safe ApiException', () async {
      final api = _createTestApiClient((options) async {
        if (options.path == '/auth/sign-in/email') {
          return _jsonResponse({
            'user': {'id': 'usr_1', 'email': 'test@example.com', 'name': 'Test User'},
          });
        }
        if (options.path == '/auth/get-session') {
          // get-session returns null (or empty body)
          return _jsonResponse(null);
        }
        throw Exception('Unexpected path: ${options.path}');
      });

      final repo = AuthRepository(api);

      expect(
        () => repo.signIn(email: 'test@example.com', password: 'password123'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('could not start your session'),
          ),
        ),
      );
    });

    test('Valid /auth/get-session returns confirmed user in SignInSuccess', () async {
      final api = _createTestApiClient((options) async {
        if (options.path == '/auth/sign-in/email') {
          return _jsonResponse({
            'user': {'id': 'usr_1', 'email': 'test@example.com', 'name': 'Exchange User'},
          });
        }
        if (options.path == '/auth/get-session') {
          return _jsonResponse({
            'user': {
              'id': 'usr_1',
              'email': 'test@example.com',
              'name': 'Confirmed User',
              'emailVerified': true,
              'role': 'USER',
            },
          });
        }
        throw Exception('Unexpected path: ${options.path}');
      });

      final repo = AuthRepository(api);
      final result = await repo.signIn(email: 'test@example.com', password: 'password123');

      expect(result, isA<SignInSuccess>());
      final success = result as SignInSuccess;
      expect(success.user.name, equals('Confirmed User'));
      expect(success.user.email, equals('test@example.com'));
    });

    test('twoFactorRedirect in sign-in returns SignInTwoFactorRequired', () async {
      final api = _createTestApiClient((options) async {
        if (options.path == '/auth/sign-in/email') {
          return _jsonResponse({
            'twoFactorRedirect': true,
          });
        }
        throw Exception('Unexpected path: ${options.path}');
      });

      final repo = AuthRepository(api);
      final result = await repo.signIn(email: 'admin@example.com', password: 'password123');

      expect(result, isA<SignInTwoFactorRequired>());
    });

    test('Session confirmation network failure throws ApiException', () async {
      final api = _createTestApiClient((options) async {
        if (options.path == '/auth/sign-in/email') {
          return _jsonResponse({'user': {'id': 'usr_1'}});
        }
        if (options.path == '/auth/get-session') {
          return _jsonResponse({'message': 'Internal Server Error'}, statusCode: 500);
        }
        throw Exception('Unexpected path: ${options.path}');
      });

      final repo = AuthRepository(api);

      expect(
        () => repo.signIn(email: 'test@example.com', password: 'password123'),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
