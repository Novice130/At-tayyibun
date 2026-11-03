import 'package:at_tayyibun/core/api_exception.dart';
import 'package:at_tayyibun/models/user.dart';
import 'package:at_tayyibun/providers.dart';
import 'package:at_tayyibun/repositories/auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';

/// Sign-up no longer starts a session (better-auth autoSignIn is off), so the
/// app signs in with the same credentials straight after.
class _Repo implements AuthRepository {
  _Repo(this.signInResult);

  final Object signInResult;
  final calls = <String>[];

  @override
  Future<void> signUp({
    required String email,
    required String password,
    required String name,
    String? image,
    required DateTime termsAcceptedAt,
  }) async =>
      calls.add('signUp $email');

  @override
  Future<SignInResult> signIn({
    required String email,
    required String password,
  }) async {
    calls.add('signIn $email');
    final r = signInResult;
    if (r is SignInResult) return r;
    throw r;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<bool> _signUp(AuthController c) => c.signUpAndSignIn(
      email: 'a@b.com',
      password: 'pw',
      name: 'A',
      termsAcceptedAt: DateTime(2026),
    );

void main() {
  test('signs in with the same credentials after sign-up', () async {
    final repo = _Repo(
      SignInSuccess(AppUser.fromJson({'id': 'u1', 'email': 'a@b.com'})),
    );
    final c = AuthController(repo);

    expect(await _signUp(c), isTrue);
    expect(repo.calls, ['signUp a@b.com', 'signIn a@b.com']);
    expect(c.state.status, AuthStatus.signedIn);
  });

  for (final failure in <Object>[
    ApiException(
      message: 'Email not verified',
      statusCode: 403,
      code: 'EMAIL_NOT_VERIFIED',
    ),
    ApiException(message: 'Invalid email or password', statusCode: 401),
    ApiException(message: 'offline', statusCode: 0, isNetworkFailure: true),
    const SignInTwoFactorRequired(),
  ]) {
    test('a failed sign-in (${failure.runtimeType}) returns false', () async {
      final c = AuthController(_Repo(failure));

      expect(await _signUp(c), isFalse);
      expect(c.state.status, isNot(AuthStatus.signedIn));
    });
  }
}
