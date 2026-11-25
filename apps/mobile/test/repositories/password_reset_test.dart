import 'package:at_tayyibun/core/api_exception.dart';
import 'package:at_tayyibun/repositories/auth_repository.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_api.dart';

void main() {
  test('posts the email and web reset page to Better Auth', () async {
    late RequestOptions seen;
    final repo = AuthRepository(fakeApiClient((options) async {
      seen = options;
      return jsonBody({'status': true});
    }));

    await repo.requestPasswordReset('a@b.com');

    expect(seen.method, 'POST');
    expect(seen.path, '/auth/request-password-reset');
    expect(seen.data, {
      'email': 'a@b.com',
      'redirectTo': 'https://attayyibun.com/reset-password',
    });
  });

  // A server answer of any kind must look like success, or the response would
  // reveal which addresses have accounts.
  for (final status in [400, 404, 500, 503]) {
    test('a $status completes normally', () async {
      final repo = AuthRepository(fakeApiClient(
        (_) async => jsonBody({'code': 'USER_NOT_FOUND'}, status: status),
      ));

      await expectLater(repo.requestPasswordReset('a@b.com'), completes);
    });
  }

  test('a network failure is reported, since nothing was attempted', () async {
    final repo = AuthRepository(fakeApiClient(
      (options) async => connectionFailure(options),
    ));

    await expectLater(
      repo.requestPasswordReset('a@b.com'),
      throwsA(isA<ApiException>()
          .having((e) => e.isNetworkFailure, 'isNetworkFailure', isTrue)),
    );
  });

  test('a rate limit is reported', () async {
    final repo = AuthRepository(fakeApiClient(
      (_) async => jsonBody('slow down', status: 429),
    ));

    await expectLater(
      repo.requestPasswordReset('a@b.com'),
      throwsA(isA<ApiException>()
          .having((e) => e.isRateLimited, 'isRateLimited', isTrue)),
    );
  });
}
