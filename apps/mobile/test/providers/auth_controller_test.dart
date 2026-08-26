import 'dart:async';

import 'package:at_tayyibun/models/user.dart';
import 'package:at_tayyibun/providers.dart';
import 'package:at_tayyibun/repositories/auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeAuthRepository implements AuthRepository {
  Completer<AppUser?>? getSessionCompleter;
  SignInResult? nextSignInResult;

  @override
  Future<AppUser?> getSession() {
    if (getSessionCompleter != null) {
      return getSessionCompleter!.future;
    }
    return Future.value(null);
  }

  @override
  Future<SignInResult> signIn({
    required String email,
    required String password,
  }) async {
    return nextSignInResult ??
        SignInSuccess(
          AppUser.fromJson({
            'id': 'usr_interactive',
            'email': email,
            'name': 'Interactive User',
            'emailVerified': true,
          }),
        );
  }

  @override
  Future<SignInResult> signInWithGoogle() async {
    return nextSignInResult ??
        SignInSuccess(
          AppUser.fromJson({
            'id': 'usr_google',
            'email': 'google@example.com',
            'name': 'Google User',
            'emailVerified': true,
          }),
        );
  }

  @override
  Future<SignInResult> signInWithApple() async {
    return nextSignInResult ??
        SignInSuccess(
          AppUser.fromJson({
            'id': 'usr_apple',
            'email': 'apple@example.com',
            'name': 'Apple User',
            'emailVerified': true,
          }),
        );
  }

  @override
  Future<void> signOut() async {}

  @override
  Future<void> deleteAccount() async {}

  @override
  Future<void> updateAvatar(String imageUrl) async {}

  @override
  Future<void> resendVerificationEmail(String email) async {}

  @override
  Future<void> signUp({
    required String email,
    required String password,
    required String name,
    String? image,
    required DateTime termsAcceptedAt,
  }) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('AuthController generation tracking', () {
    test('Late restore resolving null does not overwrite newer interactive sign-in', () async {
      final fakeRepo = _FakeAuthRepository();
      fakeRepo.getSessionCompleter = Completer<AppUser?>();

      final controller = AuthController(fakeRepo);
      expect(controller.state.status, equals(AuthStatus.unknown));

      // 1. Trigger restore at startup (takes a long time to complete)
      final restoreFuture = controller.restore();

      // 2. User immediately performs interactive sign-in before restore completes
      final signInResult = await controller.signIn('user@example.com', 'secret');
      expect(signInResult, isA<SignInSuccess>());
      expect(controller.state.status, equals(AuthStatus.signedIn));
      expect(controller.state.user?.name, equals('Interactive User'));

      // 3. Now slow restore finally completes with null (simulating stale session on disk)
      fakeRepo.getSessionCompleter!.complete(null);
      await restoreFuture;

      // 4. State must STILL be signedIn, not overwritten to signedOut!
      expect(controller.state.status, equals(AuthStatus.signedIn));
      expect(controller.state.user?.name, equals('Interactive User'));
    });

    test('Late restore error does not overwrite newer interactive sign-in', () async {
      final fakeRepo = _FakeAuthRepository();
      fakeRepo.getSessionCompleter = Completer<AppUser?>();

      final controller = AuthController(fakeRepo);

      // 1. Startup restore starts
      final restoreFuture = controller.restore();

      // 2. Interactive Google sign-in completes
      await controller.signInWithGoogle();
      expect(controller.state.status, equals(AuthStatus.signedIn));
      expect(controller.state.user?.name, equals('Google User'));

      // 3. Slow restore fails with network error
      fakeRepo.getSessionCompleter!.completeError(Exception('Network timeout'));
      await restoreFuture;

      // 4. State remains signedIn
      expect(controller.state.status, equals(AuthStatus.signedIn));
      expect(controller.state.user?.name, equals('Google User'));
    });

    test('Normal restore sets signedIn when session is valid', () async {
      final fakeRepo = _FakeAuthRepository();
      fakeRepo.getSessionCompleter = Completer<AppUser?>();

      final controller = AuthController(fakeRepo);
      final restoreFuture = controller.restore();

      final user = AppUser.fromJson({
        'id': 'usr_restored',
        'email': 'restored@example.com',
        'name': 'Restored User',
        'emailVerified': true,
      });
      fakeRepo.getSessionCompleter!.complete(user);
      await restoreFuture;

      expect(controller.state.status, equals(AuthStatus.signedIn));
      expect(controller.state.user?.name, equals('Restored User'));
    });

    test('needsAvatar and hasPresetAvatar correctly identify preset vs social/null images', () async {
      final fakeRepo = _FakeAuthRepository();
      final controller = AuthController(fakeRepo);

      // User without image
      final userNoImage = AppUser.fromJson({
        'id': 'usr_1',
        'email': 'user@example.com',
        'emailVerified': true,
        'image': null,
      });
      expect(userNoImage.hasPresetAvatar, isFalse);
      expect(userNoImage.needsAvatar, isTrue);

      // User with Google photo (not an illustrated avatar)
      final userGoogleImage = AppUser.fromJson({
        'id': 'usr_2',
        'email': 'user@example.com',
        'emailVerified': true,
        'image': 'https://lh3.googleusercontent.com/a/ACg8ocL3-example',
      });
      expect(userGoogleImage.hasPresetAvatar, isFalse);
      expect(userGoogleImage.needsAvatar, isTrue);

      // User with preset male avatar
      final userPresetMale = AppUser.fromJson({
        'id': 'usr_3',
        'email': 'user@example.com',
        'emailVerified': true,
        'image': 'https://attayyibun.com/avatars/male/male-5.jpg',
      });
      expect(userPresetMale.hasPresetAvatar, isTrue);
      expect(userPresetMale.needsAvatar, isFalse);

      // User with preset female avatar
      final userPresetFemale = AppUser.fromJson({
        'id': 'usr_4',
        'email': 'user@example.com',
        'emailVerified': true,
        'image': 'https://attayyibun.com/avatars/female/female-12.jpg',
      });
      expect(userPresetFemale.hasPresetAvatar, isTrue);
      expect(userPresetFemale.needsAvatar, isFalse);

      // Adopt user in controller and verify AuthState.needsAvatar
      controller.adoptVerifiedUser(userGoogleImage);
      expect(controller.state.needsAvatar, isTrue);

      await controller.updateAvatar('https://attayyibun.com/avatars/male/male-1.jpg');
      expect(controller.state.needsAvatar, isFalse);
      expect(controller.state.user?.hasPresetAvatar, isTrue);
    });
  });
}
