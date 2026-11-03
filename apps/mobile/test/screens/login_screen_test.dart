import 'package:at_tayyibun/providers.dart';
import 'package:at_tayyibun/screens/forgot_password_screen.dart';
import 'package:at_tayyibun/screens/login_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../support/fake_api.dart';

Future<void> _pump(
  WidgetTester tester,
  Future<ResponseBody> Function(RequestOptions) handler,
) {
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final router = GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (_, _) => const ForgotPasswordScreen(),
      ),
    ],
  );
  return tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(fakeApiClient(handler))],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
}

void main() {
  testWidgets('shows the form and required-field errors', (tester) async {
    await _pump(tester, (_) async => jsonBody(null));

    await tester.tap(find.widgetWithText(FilledButton, 'Sign In'));
    await tester.pump();

    expect(find.text('Enter a valid email'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });

  testWidgets('shows the server message on bad credentials', (tester) async {
    await _pump(
      tester,
      (_) async => jsonBody(
        {
          'code': 'INVALID_EMAIL_OR_PASSWORD',
          'message': 'Invalid email or password',
        },
        status: 401,
      ),
    );

    await tester.enterText(find.byType(TextFormField).at(0), 'a@b.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'wrong');
    await tester.tap(find.widgetWithText(FilledButton, 'Sign In'));
    await tester.pumpAndSettle();

    expect(find.text('Invalid email or password'), findsOneWidget);
  });

  testWidgets('Forgot password opens the reset screen', (tester) async {
    await _pump(tester, (_) async => jsonBody(null));

    await tester.tap(find.text('Forgot password?'));
    await tester.pumpAndSettle();

    expect(find.byType(ForgotPasswordScreen), findsOneWidget);
  });
}
