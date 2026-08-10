import 'package:google_sign_in/google_sign_in.dart';

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

    if (data['twoFactorRedirect'] == true) {
      return const SignInTwoFactorRequired();
    }

    final user = (data['user'] as Map?)?.cast<String, dynamic>();
    return SignInSuccess(AppUser.fromJson(user ?? const {}));
  }

  /// Native Google sign-in.
  ///
  /// Deliberately does NOT use the browser redirect flow: this app authenticates
  /// with a cookie held in its own jar, and a redirect completed in a Custom Tab
  /// would set that cookie on the browser instead of the app. Google's native
  /// SDK hands us an ID token, we post it to better-auth, and the session cookie
  /// comes back on that response — straight into our jar.
  Future<SignInResult> signInWithGoogle() async {
    if (kGoogleServerClientId.isEmpty) {
      throw ApiException(
        message: 'Google sign-in is not configured in this build.',
        statusCode: 0,
      );
    }

    final String idToken;
    try {
      // initialize() is idempotent, so calling it per attempt is safe and
      // avoids ordering constraints at app start.
      await GoogleSignIn.instance.initialize(
        serverClientId: kGoogleServerClientId,
      );
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

    final data = await _api.post<Map<String, dynamic>>(
      '/auth/sign-in/social',
      body: {
        'provider': 'google',
        'idToken': {'token': idToken},
      },
    );

    final user = (data['user'] as Map?)?.cast<String, dynamic>();
    return SignInSuccess(AppUser.fromJson(user ?? const {}));
  }

  /// Creates the account. Because the server sets requireEmailVerification,
  /// this returns no session — the user must open the emailed link before they
  /// can sign in.
  Future<void> signUp({
    required String email,
    required String password,
    required String name,
    required String phone,
    String? image,
  }) async {
    await _api.post<Map<String, dynamic>>(
      '/auth/sign-up/email',
      body: {
        'email': email,
        'password': password,
        'name': name,
        'phone': phone,
        if (image != null && image.isNotEmpty) 'image': image,
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

  Future<void> resendVerificationEmail(String email) async {
    await _api.post<dynamic>(
      '/auth/send-verification-email',
      body: {'email': email, 'callbackURL': '/profile/setup'},
    );
  }
}
