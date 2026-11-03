import 'package:at_tayyibun/models/user.dart';
import 'package:at_tayyibun/providers.dart';
import 'package:at_tayyibun/screens/suspended_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_api.dart';

Future<ProviderContainer> _pump(
  WidgetTester tester,
  Future<ResponseBody> Function(RequestOptions) handler,
) async {
  tester.view.physicalSize = const Size(1200, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final container = ProviderContainer(
    overrides: [apiClientProvider.overrideWithValue(fakeApiClient(handler))],
  );
  addTearDown(container.dispose);
  container.read(authControllerProvider.notifier)
    ..adoptVerifiedUser(AppUser.fromJson({'id': 'u1', 'email': 'a@b.com'}))
    ..markSuspended();
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: SuspendedScreen()),
    ),
  );
  return container;
}

Finder get _deleteButton =>
    find.widgetWithText(FilledButton, 'Delete my account');

void main() {
  testWidgets('explains the suspension and how to ask about it',
      (tester) async {
    await _pump(tester, (_) async => jsonBody({}));

    expect(find.text('Your account is suspended'), findsOneWidget);
    expect(find.text('support@attayyibun.com'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
  });

  testWidgets('delete stays disabled until DELETE is typed', (tester) async {
    await _pump(tester, (_) async => jsonBody({}));

    expect(tester.widget<FilledButton>(_deleteButton).onPressed, isNull);

    await tester.enterText(find.byType(TextField), 'delete');
    await tester.pump();
    expect(tester.widget<FilledButton>(_deleteButton).onPressed, isNull);

    await tester.enterText(find.byType(TextField), 'DELETE');
    await tester.pump();
    expect(tester.widget<FilledButton>(_deleteButton).onPressed, isNotNull);
  });

  testWidgets('confirming deletes the account and signs out', (tester) async {
    final calls = <String>[];
    final container = await _pump(tester, (options) async {
      calls.add('${options.method} ${options.path}');
      return jsonBody({'success': true});
    });

    await tester.enterText(find.byType(TextField), 'DELETE');
    await tester.pump();
    await tester.tap(_deleteButton);
    await tester.pumpAndSettle();

    expect(calls, ['DELETE /api/users/me']);
    expect(
      container.read(authControllerProvider).status,
      AuthStatus.signedOut,
    );
  });

  testWidgets('a failed delete shows an error and stays suspended',
      (tester) async {
    final container = await _pump(
      tester,
      (_) async => jsonBody({'message': 'nope'}, status: 500),
    );

    await tester.enterText(find.byType(TextField), 'DELETE');
    await tester.pump();
    await tester.tap(_deleteButton);
    await tester.pumpAndSettle();

    expect(find.textContaining('Could not delete'), findsOneWidget);
    expect(
      container.read(authControllerProvider).status,
      AuthStatus.suspended,
    );
  });
}
