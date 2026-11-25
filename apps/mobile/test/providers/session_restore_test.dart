import 'package:at_tayyibun/core/api_exception.dart';
import 'package:at_tayyibun/models/user.dart';
import 'package:at_tayyibun/providers.dart';
import 'package:at_tayyibun/repositories/auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';

class _Repo implements AuthRepository {
  _Repo({this.error, this.cookie = true, AppUser? user}) : session = user;

  AppUser? session;
  Object? error;
  bool cookie;
  int signOuts = 0;

  @override
  Future<AppUser?> getSession() async {
    if (error != null) throw error!;
    return session;
  }

  @override
  Future<bool> hasSessionCookie() async => cookie;

  @override
  Future<void> signOut() async => signOuts++;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

final _user = AppUser.fromJson({'id': 'u1', 'email': 'a@b.com'});
ApiException _network() => ApiException(
      message: 'offline',
      statusCode: 0,
      isNetworkFailure: true,
    );

void main() {
  group('restore', () {
    test('a valid session signs in', () async {
      final c = AuthController(_Repo(user: _user));
      await c.restore();
      expect(c.state.status, AuthStatus.signedIn);
    });

    test('a null session is signed out', () async {
      final c = AuthController(_Repo());
      await c.restore();
      expect(c.state.status, AuthStatus.signedOut);
    });

    test('offline with a saved session keeps it', () async {
      final repo = _Repo(error: _network());
      final c = AuthController(repo);
      await c.restore();
      expect(c.state.status, AuthStatus.offline);
      expect(repo.signOuts, 0);
    });

    test('a server outage with a saved session keeps it', () async {
      final c = AuthController(_Repo(
        error: ApiException(message: 'down', statusCode: 503),
      ));
      await c.restore();
      expect(c.state.status, AuthStatus.offline);
    });

    test('offline with no saved session is plain signed out', () async {
      final c = AuthController(_Repo(error: _network(), cookie: false));
      await c.restore();
      expect(c.state.status, AuthStatus.signedOut);
    });

    test('an explicit refusal is signed out', () async {
      final c = AuthController(_Repo(
        error: ApiException(message: 'no', statusCode: 401),
      ));
      await c.restore();
      expect(c.state.status, AuthStatus.signedOut);
    });

    test('retrying once back online signs in', () async {
      final repo = _Repo(error: _network());
      final c = AuthController(repo);
      await c.restore();
      expect(c.state.status, AuthStatus.offline);

      repo
        ..error = null
        ..session = _user;
      await c.restore();
      expect(c.state.status, AuthStatus.signedIn);
    });
  });

  group('markSuspended', () {
    test('moves a signed-in user to suspended', () {
      final c = AuthController(_Repo())..adoptVerifiedUser(_user);
      c.markSuspended();
      expect(c.state.status, AuthStatus.suspended);
    });

    test('a late response after sign-out is ignored', () async {
      final c = AuthController(_Repo())..adoptVerifiedUser(_user);
      await c.signOut();
      c.markSuspended();
      expect(c.state.status, AuthStatus.signedOut);
    });

    test('signing out from suspended clears it', () async {
      final c = AuthController(_Repo())..adoptVerifiedUser(_user);
      c.markSuspended();
      await c.signOut();
      expect(c.state.status, AuthStatus.signedOut);
    });
  });
}
