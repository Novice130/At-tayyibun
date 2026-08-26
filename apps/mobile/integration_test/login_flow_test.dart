import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:at_tayyibun/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('iOS App Store Review - Complete Login & Registration Walkthrough', (tester) async {
    // 1. Launch App
    await app.main();
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // Screen 1: Welcome Screen (Hero Art, Quranic Verse, Value Props)
    await Future.delayed(const Duration(seconds: 4));
    await tester.pumpAndSettle();

    // Screen 2: Navigate to Sign In screen
    final signInBtn = find.text('Sign In to Account');
    if (signInBtn.evaluate().isNotEmpty) {
      await tester.tap(signInBtn);
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }
    await Future.delayed(const Duration(seconds: 4));

    // Scroll down to see full login options (Apple, Google, Phone, Email/Password)
    await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -150));
    await tester.pumpAndSettle();
    await Future.delayed(const Duration(seconds: 3));

    // Screen 3: Navigate to Phone Sign In
    final phoneBtn = find.textContaining('Phone');
    if (phoneBtn.evaluate().isNotEmpty) {
      await tester.tap(phoneBtn.first);
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }
    await Future.delayed(const Duration(seconds: 4));

    // Return to Login Screen
    final backBtn1 = find.byType(BackButton);
    if (backBtn1.evaluate().isNotEmpty) {
      await tester.tap(backBtn1.first);
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }
    await Future.delayed(const Duration(seconds: 2));

    // Screen 4: Navigate to Create Account (Register)
    final registerLink = find.textContaining('Create one now');
    if (registerLink.evaluate().isNotEmpty) {
      await tester.tap(registerLink);
      await tester.pumpAndSettle(const Duration(seconds: 2));
    } else {
      final regBtn = find.text('Register');
      if (regBtn.evaluate().isNotEmpty) {
        await tester.tap(regBtn);
        await tester.pumpAndSettle(const Duration(seconds: 2));
      }
    }
    await Future.delayed(const Duration(seconds: 4));

    // Scroll down Registration Form to show fields & EULA
    await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -200));
    await tester.pumpAndSettle();
    await Future.delayed(const Duration(seconds: 3));

    // Screen 5: Return to Welcome Screen
    final backBtn2 = find.byType(BackButton);
    if (backBtn2.evaluate().isNotEmpty) {
      await tester.tap(backBtn2.first);
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    final backBtn3 = find.byType(BackButton);
    if (backBtn3.evaluate().isNotEmpty) {
      await tester.tap(backBtn3.first);
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }
    await Future.delayed(const Duration(seconds: 3));
  });
}
