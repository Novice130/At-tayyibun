import 'package:at_tayyibun/core/api_client.dart';
import 'package:at_tayyibun/core/constants.dart';
import 'package:at_tayyibun/main.dart';
import 'package:at_tayyibun/providers.dart';
import 'package:at_tayyibun/screens/offline_screen.dart';
import 'package:at_tayyibun/screens/suspended_screen.dart';
import 'package:at_tayyibun/screens/welcome_screen.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fake_api.dart';

const _member = {
  'user': {
    'id': 'u1',
    'email': 'a@b.com',
    'phoneGateExempt': true,
    'image': 'https://attayyibun.com/avatars/male/male-1.jpg',
  },
};

Future<ApiClient> _clientWithSavedCookie(
  Future<ResponseBody> Function(RequestOptions) handler,
) async {
  final jar = CookieJar();
  await jar.saveFromResponse(Uri.parse(kBaseUrl), [
    Cookie(kSessionCookieSecure, 'abc'),
  ]);
  final dio = Dio(
    BaseOptions(baseUrl: kBaseUrl, responseType: ResponseType.json),
  );
  dio.httpClientAdapter = FakeAdapter(handler);
  return ApiClient.forTesting(dio, jar);
}

Future<void> _boot(WidgetTester tester, ApiClient api) async {
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const AtTayyibunApp(),
    ),
  );
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  testWidgets('launching offline with a session shows the retry screen',
      (tester) async {
    final api = await _clientWithSavedCookie(
      (options) async => connectionFailure(options),
    );

    await _boot(tester, api);

    expect(find.byType(OfflineScreen), findsOneWidget);
    expect(find.byType(WelcomeScreen), findsNothing);
    expect(await api.hasSessionCookie(), isTrue);
  });

  testWidgets('an API suspension response routes to the suspended screen',
      (tester) async {
    final api = await _clientWithSavedCookie((options) async {
      if (options.path == '/auth/get-session') return jsonBody(_member);
      return jsonBody(
        {'message': 'suspended', 'code': 'ACCOUNT_SUSPENDED'},
        status: 403,
      );
    });

    await _boot(tester, api);

    expect(find.byType(SuspendedScreen), findsOneWidget);
  });

  testWidgets('an invalid session lands on the welcome screen', (tester) async {
    final api = await _clientWithSavedCookie((_) async => jsonBody(null));

    await _boot(tester, api);

    expect(find.byType(WelcomeScreen), findsOneWidget);
  });
}
