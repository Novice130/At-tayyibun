import '../core/api_client.dart';
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
    await _api.clearCookies();
  }

  Future<void> resendVerificationEmail(String email) async {
    await _api.post<dynamic>(
      '/auth/send-verification-email',
      body: {'email': email, 'callbackURL': '/profile/setup'},
    );
  }
}
