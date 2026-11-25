import 'package:at_tayyibun/screens/verify_phone_screen.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a disabled provider no longer tells users to edit Firebase', () {
    final text = firebaseErrorMessage(
      fb.FirebaseAuthException(code: 'operation-not-allowed'),
    );
    expect(text, isNot(contains('Firebase')));
    expect(text, isNot(contains('Console')));
  });

  test('an unknown code hides the SDK message', () {
    final text = firebaseErrorMessage(fb.FirebaseAuthException(
      code: 'internal-error',
      message: 'An internal error has occurred. [ BILLING_NOT_ENABLED ]',
    ));
    expect(text, isNot(contains('BILLING')));
  });

  test('a known code keeps its specific advice', () {
    final text = firebaseErrorMessage(
      fb.FirebaseAuthException(code: 'invalid-verification-code'),
    );
    expect(text, contains('code'));
  });

  test('a platform failure hides the plugin message', () {
    final text = platformErrorMessage(
      PlatformException(code: 'x', message: 'NSURLErrorDomain -1200 stack'),
      fallback: 'Please try again.',
    );
    expect(text, 'Please try again.');
  });
}
