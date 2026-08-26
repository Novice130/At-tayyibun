import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

import '../core/api_client.dart';
import '../core/api_exception.dart';
import '../core/constants.dart';
import '../models/user.dart';

sealed class SignInResult {
  const SignInResult();
}

class SignInSuccess extends SignInResult {
  const SignInSuccess(this.user);
  final AppUser user;
}

/// better-auth deleted the session and is waiting on a second factor. The
/// response carries no token and no cookie, so the user is NOT signed in.
/// 2FA is enforced for admins only, and enrolment lives on the website.
class SignInTwoFactorRequired extends SignInResult {
  const SignInTwoFactorRequired();
}

/// The user dismissed the Google account picker. Not an error — the UI should
/// simply return to the idle state without showing a message.
class SignInCancelled extends SignInResult {
  const SignInCancelled();
}

class AuthRepository {
  AuthRepository(this._api);

  final ApiClient _api;

  Future<SignInResult> signIn({
    required String email,
    required String password,
  }) async {
    final data = await _api.post<Map<String, dynamic>>(
      '/auth/sign-in/email',
      body: {'email': email, 'password': password},
    );

    return _confirmSession(data, providerName: 'Email');
  }

  /// Confirms that a successful auth/exchange response established a valid,
  /// cookie-backed session. The non-null user returned by /auth/get-session is
  /// treated as authoritative.
  Future<SignInResult> _confirmSession(
    Map<String, dynamic> data, {
    required String providerName,
  }) async {
    if (data['twoFactorRedirect'] == true) {
      return const SignInTwoFactorRequired();
    }

    final confirmedUser = await getSession();
    if (confirmedUser == null) {
      final hasCookie = await _api.hasSessionCookie();
      debugPrint('[$providerName] session_confirmation failed (hasCookie=$hasCookie)');
      throw ApiException(
        message: '$providerName sign-in completed, but we could not start your session. Please try again.',
        statusCode: 0,
      );
    }

    return SignInSuccess(confirmedUser);
  }

  /// Native Sign in with Apple.
  ///
  /// Mirrors the Google path deliberately: Apple's native sheet hands back an
  /// identity token, we POST it to better-auth, and the session cookie comes
  /// back on that response straight into our jar. A browser redirect flow
  /// would drop the cookie in Safari instead of the app.
  Future<SignInResult> signInWithApple() async {
    final rawNonce = _generateNonce();
    final AuthorizationCredentialAppleID cred;
    try {
      cred = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: sha256.convert(utf8.encode(rawNonce)).toString(),
      );
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) {
        return const SignInCancelled();
      }
      throw ApiException(
        message: 'Apple sign-in failed. Please try again.',
        statusCode: 0,
      );
    }

    final idToken = cred.identityToken;
    if (idToken == null || idToken.isEmpty) {
      throw ApiException(
        message: 'Apple did not return an identity token.',
        statusCode: 0,
      );
    }

    // Apple returns the name ONLY on the first ever authorization for this
    // Apple ID + app pair. Send it every time; the server keeps the first
    // non-empty value it sees. Drop it and the name is unrecoverable.
    final given = cred.givenName ?? '';
    final family = cred.familyName ?? '';
    final name = [given, family].where((s) => s.isNotEmpty).join(' ');

    final data = await _api.post<Map<String, dynamic>>(
      '/auth/sign-in/social',
      body: {
        'provider': 'apple',
        'idToken': {'token': idToken, 'nonce': rawNonce},
        if (name.isNotEmpty) 'name': name,
      },
    );

    return _confirmSession(data, providerName: 'Apple');
  }

  String _generateNonce() {
    const charset =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._';
    final random = Random.secure();
    return List.generate(32, (_) => charset[random.nextInt(charset.length)])
        .join();
  }

  /// Native Google sign-in.
  ///
  /// Deliberately does NOT use the browser redirect flow: this app authenticates
  /// with a cookie held in its own jar, and a redirect completed in a Custom Tab
  /// would set that cookie on the browser instead of the app. Google's native
  /// SDK hands us an ID token, we post it to better-auth, and the session cookie
  /// comes back on that response — straight into our jar.
  Future<SignInResult> signInWithGoogle() async {
    final String idToken;
    try {
      debugPrint('[auth_repository] stage: google_initialize');
      await GoogleSignIn.instance.initialize(
        clientId: kGoogleIosClientId.isNotEmpty ? kGoogleIosClientId : null,
        serverClientId:
            kGoogleServerClientId.isNotEmpty ? kGoogleServerClientId : null,
      );
      debugPrint('[auth_repository] stage: google_account');
      final account = await GoogleSignIn.instance.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) {
        throw ApiException(
          message: 'Google did not return an ID token. Please try again.',
          statusCode: 0,
        );
      }
      idToken = token;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) {
        return const SignInCancelled();
      }
      throw ApiException(
        message: e.description ?? 'Google sign-in failed. Please try again.',
        statusCode: 0,
      );
    }

    debugPrint('[auth_repository] stage: social_exchange');
    final data = await _api.post<Map<String, dynamic>>(
      '/auth/sign-in/social',
      body: {
        'provider': 'google',
        'idToken': {'token': idToken},
      },
    );

    debugPrint('[auth_repository] stage: session_confirmation');
    return _confirmSession(data, providerName: 'Google');
  }

  /// Creates the account. Because the server sets requireEmailVerification,
  /// this returns no session — the user must open the emailed link before they
  /// can sign in.
  Future<void> signUp({
    required String email,
    required String password,
    required String name,
    String? image,
    required DateTime termsAcceptedAt,
  }) async {
    await _api.post<Map<String, dynamic>>(
      '/auth/sign-up/email',
      body: {
        'email': email,
        'password': password,
        'name': name,
        // NOTE: no 'phone'. users.phone belongs to the better-auth phone-number
        // plugin and may only be written by a Firebase-verified claim — the
        // phone gate collects it right after this account is created.
        if (image != null && image.isNotEmpty) 'image': image,
        'termsAcceptedAt': termsAcceptedAt.toUtc().toIso8601String(),
        'callbackURL': '/profile/setup',
      },
    );
  }

  /// Returns null when signed out. Note the endpoint answers 200 with a JSON
  /// `null` body in that case rather than 401.
  Future<AppUser?> getSession() async {
    final data = await _api.get<dynamic>('/auth/get-session');
    if (data is! Map) return null;
    final user = (data['user'] as Map?)?.cast<String, dynamic>();
    if (user == null) return null;
    return AppUser.fromJson(user);
  }

  Future<void> signOut() async {
    try {
      await _api.post<dynamic>('/auth/sign-out');
    } catch (_) {
      // Even if the server call fails, drop the local session below.
    }
    try {
      // Otherwise the Google SDK silently reuses the last account and the next
      // "Continue with Google" skips the picker entirely.
      await GoogleSignIn.instance.signOut();
    } catch (_) {
      // Never signed in with Google, or the SDK is unavailable.
    }
    await _api.clearCookies();
  }

  /// Permanently deletes the caller's own account, then drops the session
  /// cookie. The server does the real deletion (profiles, photos, requests);
  /// clearing the jar here makes the signed-out state stick.
  Future<void> deleteAccount() async {
    await _api.delete<dynamic>('/api/users/me');
    await _api.clearCookies();
  }

  /// Persists the chosen preset avatar. better-auth exposes this as a POST on
  /// the auth base path, so it goes through the /auth Origin-header branch of
  /// ApiClient rather than the /api X-Requested-With branch.
  Future<void> updateAvatar(String imageUrl) async {
    await _api.post<dynamic>('/auth/update-user', body: {'image': imageUrl});
  }

  Future<void> resendVerificationEmail(String email) async {
    await _api.post<dynamic>(
      '/auth/send-verification-email',
      body: {'email': email, 'callbackURL': '/profile/setup'},
    );
  }

  // ── Phone verification ─────────────────────────────────────────────────────
  //
  // Firebase delivers and checks the SMS code; what reaches our server is the
  // resulting ID token, which better-auth's phone-number plugin accepts in
  // place of an OTP (see apps/web/src/lib/phone-verify.ts). The session cookie
  // comes back on the response and lands in the jar exactly like the Google and
  // Apple paths above.

  /// Ask Firebase to text a code to [e164].
  ///
  /// On Android the SMS is often auto-retrieved, in which case
  /// [onAutoVerified] fires with a ready-to-use credential and the user never
  /// has to type anything — ignoring it leaves them staring at a code field
  /// that has already succeeded.
  Future<String> startPhoneVerification(
    String e164, {
    required void Function(fb.PhoneAuthCredential credential) onAutoVerified,
    required void Function(fb.FirebaseAuthException error) onFailed,
  }) async {
    final completer = Completer<String>();
    await fb.FirebaseAuth.instance.verifyPhoneNumber(
      phoneNumber: e164,
      verificationCompleted: onAutoVerified,
      verificationFailed: (error) {
        if (!completer.isCompleted) completer.completeError(error);
        onFailed(error);
      },
      codeSent: (verificationId, _) {
        if (!completer.isCompleted) completer.complete(verificationId);
      },
      codeAutoRetrievalTimeout: (verificationId) {
        if (!completer.isCompleted) completer.complete(verificationId);
      },
    );
    return completer.future;
  }

  /// Exchange a Firebase credential for a better-auth session.
  ///
  /// [updatePhoneNumber] attaches the number to the account that is already
  /// signed in (the phone gate). Without it, verifying signs in — creating the
  /// account if this number has never been seen.
  Future<AppUser> verifyPhoneCredential({
    required String e164,
    required fb.PhoneAuthCredential credential,
    bool updatePhoneNumber = false,
  }) async {
    final cred = await fb.FirebaseAuth.instance.signInWithCredential(credential);
    final idToken = await cred.user?.getIdToken();
    if (idToken == null) {
      throw ApiException(
        message: 'Could not confirm that code. Please try again.',
        statusCode: 400,
      );
    }

    try {
      final data = await _api.post<Map<String, dynamic>>(
        '/auth/phone-number/verify',
        body: {
          'phoneNumber': e164,
          'code': idToken,
          if (updatePhoneNumber) 'updatePhoneNumber': true,
        },
      );
      final user = (data['user'] as Map?)?.cast<String, dynamic>();
      return AppUser.fromJson(user ?? const {});
    } finally {
      // better-auth's cookie is the only session this app has; do not leave a
      // second one behind in Firebase.
      await fb.FirebaseAuth.instance.signOut().catchError((_) {});
    }
  }

  /// Convenience wrapper for a code the user typed.
  Future<AppUser> verifyPhoneCode({
    required String e164,
    required String verificationId,
    required String smsCode,
    bool updatePhoneNumber = false,
  }) {
    return verifyPhoneCredential(
      e164: e164,
      credential: fb.PhoneAuthProvider.credential(
        verificationId: verificationId,
        smsCode: smsCode,
      ),
      updatePhoneNumber: updatePhoneNumber,
    );
  }
}
