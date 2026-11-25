import 'package:at_tayyibun/providers.dart';
import 'package:at_tayyibun/screens/forgot_password_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_api.dart';

const _generic = 'If an account exists for that email';

Future<void> _pump(
  WidgetTester tester,
  Future<ResponseBody> Function(RequestOptions) handler,
) =>
    tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(fakeApiClient(handler)),
        ],
        child: const MaterialApp(home: ForgotPasswordScreen()),
      ),
    );

Future<void> _submit(WidgetTester tester, String email) async {
  await tester.enterText(find.byType(TextFormField), email);
  await tester.tap(find.widgetWithText(FilledButton, 'Send reset link'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('rejects a malformed email without calling the server',
      (tester) async {
    var calls = 0;
    await _pump(tester, (_) async {
      calls++;
      return jsonBody({'status': true});
    });

    await _submit(tester, 'not-an-email');

    expect(find.text('Enter a valid email'), findsOneWidget);
    expect(calls, 0);
  });

  testWidgets('success shows the generic confirmation and trims the email',
      (tester) async {
    late Map<dynamic, dynamic> body;
    await _pump(tester, (options) async {
      body = options.data as Map;
      return jsonBody({'status': true});
    });

    await _submit(tester, '  a@b.com ');

    expect(find.textContaining(_generic), findsOneWidget);
    expect(body['email'], 'a@b.com');
  });

  testWidgets('a server refusal looks identical to success', (tester) async {
    await _pump(
      tester,
      (_) async => jsonBody({'code': 'USER_NOT_FOUND'}, status: 400),
    );

    await _submit(tester, 'nobody@b.com');

    expect(find.textContaining(_generic), findsOneWidget);
    expect(find.textContaining('USER_NOT_FOUND'), findsNothing);
  });

  testWidgets('offline stays on the form with a retryable message',
      (tester) async {
    await _pump(tester, (options) async => connectionFailure(options));

    await _submit(tester, 'a@b.com');

    expect(find.textContaining(_generic), findsNothing);
    expect(find.textContaining('Cannot reach At-Tayyibun'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Send reset link'), findsOneWidget);
  });
}
