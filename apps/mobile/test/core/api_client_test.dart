import 'package:at_tayyibun/core/api_exception.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_api.dart';

void main() {
  test('a suspended response fires the callback and still throws', () async {
    final api = fakeApiClient((_) async => jsonBody(
          {'message': 'suspended', 'code': 'ACCOUNT_SUSPENDED'},
          status: 403,
        ));
    var fired = 0;
    api.onAccountSuspended = () => fired++;

    await expectLater(
      api.get<dynamic>('/api/profiles/me'),
      throwsA(isA<ApiException>()),
    );
    expect(fired, 1);
  });

  test('other errors do not fire it', () async {
    final api = fakeApiClient(
      (_) async => jsonBody({'message': 'nope'}, status: 403),
    );
    var fired = 0;
    api.onAccountSuspended = () => fired++;

    await expectLater(
      api.get<dynamic>('/api/profiles/me'),
      throwsA(isA<ApiException>()),
    );
    expect(fired, 0);
  });
}
