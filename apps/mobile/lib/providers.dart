import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api_client.dart';
import 'core/api_exception.dart';
import 'models/user.dart';
import 'repositories/auth_repository.dart';
import 'repositories/moderation_repository.dart';
import 'repositories/profiles_repository.dart';
import 'repositories/requests_repository.dart';

/// Overridden in main() once the cookie jar has been opened on disk.
final apiClientProvider = Provider<ApiClient>((ref) {
  throw UnimplementedError('apiClientProvider must be overridden in main()');
});

final authRepositoryProvider =
    Provider((ref) => AuthRepository(ref.watch(apiClientProvider)));

final profilesRepositoryProvider =
    Provider((ref) => ProfilesRepository(ref.watch(apiClientProvider)));

final requestsRepositoryProvider =
    Provider((ref) => RequestsRepository(ref.watch(apiClientProvider)));

final moderationRepositoryProvider =
    Provider((ref) => ModerationRepository(ref.watch(apiClientProvider)));

enum AuthStatus {
  unknown,
  signedIn,
  signedOut,

  /// A saved session could not be checked because the server is unreachable.
  /// Kept until a retry gets a real answer.
  offline,

  /// Signed in, but the API refuses this account. Only self-delete still works.
  suspended,
}

class AuthState {
  const AuthState({required this.status, this.user});

  final AuthStatus status;
  final AppUser? user;

  bool get isSignedIn => status == AuthStatus.signedIn;

  /// Signed in but blocked at the phone gate. Accounts created before phone
  /// verification existed are exempt, so nobody already signed up is locked out.
  bool get needsPhone => isSignedIn && (user?.needsPhone ?? false);

  /// Signed in but needs to pick an avatar before proceeding to browse.
  bool get needsAvatar => isSignedIn && (user?.needsAvatar ?? true);
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repo)
      : super(const AuthState(status: AuthStatus.unknown));

  final AuthRepository _repo;
  int _generation = 0;

  /// Called at startup and on retry. The persisted cookie means a returning
  /// user is usually still signed in; this confirms it with the server rather
  /// than trusting the cookie's presence.
  Future<void> restore() async {
    final gen = ++_generation;
    try {
      final user = await _repo.getSession();
      if (gen != _generation) return;
      state = user == null
          ? const AuthState(status: AuthStatus.signedOut)
          : AuthState(status: AuthStatus.signedIn, user: user);
    } on ApiException catch (e) {
      if (gen != _generation) return;
      // No answer says nothing about the session, so a saved one is kept for
      // a retry. With nothing saved there is nothing to wait for.
      final keep = e.isTemporaryFailure && await _hasSavedSession();
      if (gen != _generation) return;
      debugPrint('Session restore failed: status ${e.statusCode}');
      state = AuthState(
        status: keep ? AuthStatus.offline : AuthStatus.signedOut,
      );
    } catch (e) {
      if (gen != _generation) return;
      debugPrint('Session restore failed: ${e.runtimeType}');
      state = const AuthState(status: AuthStatus.signedOut);
    }
  }

  Future<bool> _hasSavedSession() async {
    try {
      return await _repo.hasSessionCookie();
    } catch (_) {
      return false;
    }
  }

  /// The API refused a request because this account is suspended. A response
  /// that arrives after sign-out is ignored.
  void markSuspended() {
    if (state.status != AuthStatus.signedIn) return;
    _generation++;
    state = AuthState(status: AuthStatus.suspended, user: state.user);
  }

  Future<SignInResult> signIn(String email, String password) async {
    _generation++;
    final result = await _repo.signIn(email: email, password: password);
    if (result is SignInSuccess) {
      state = AuthState(status: AuthStatus.signedIn, user: result.user);
    }
    return result;
  }

  /// Creates the account, then signs in with the same credentials, because
  /// sign-up itself never starts a session. The server answers sign-up the
  /// same way for new and existing emails, and this keeps that property:
  /// sign-up errors (validation, network) still throw, but any sign-in failure
  /// only returns false. The caller then shows one message that does not say
  /// which case it was. Returns true when signed in.
  Future<bool> signUpAndSignIn({
    required String email,
    required String password,
    required String name,
    String? image,
    required DateTime termsAcceptedAt,
  }) async {
    await _repo.signUp(
      email: email,
      password: password,
      name: name,
      image: image,
      termsAcceptedAt: termsAcceptedAt,
    );
    try {
      return await signIn(email, password) is SignInSuccess;
    } catch (e) {
      debugPrint('[sign_up] sign-in after sign-up failed: ${e.runtimeType}');
      return false;
    }
  }

  Future<SignInResult> signInWithGoogle() async {
    _generation++;
    final result = await _repo.signInWithGoogle();
    if (result is SignInSuccess) {
      state = AuthState(status: AuthStatus.signedIn, user: result.user);
    }
    return result;
  }

  Future<SignInResult> signInWithApple() async {
    _generation++;
    final result = await _repo.signInWithApple();
    if (result is SignInSuccess) {
      state = AuthState(status: AuthStatus.signedIn, user: result.user);
    }
    return result;
  }

  /// Adopt the user returned by a phone verification. Signing in and attaching
  /// a number to an existing session both land here, and both must refresh the
  /// state or the router keeps redirecting to the gate it just cleared.
  void adoptVerifiedUser(AppUser user) {
    _generation++;
    state = AuthState(status: AuthStatus.signedIn, user: user);
  }

  Future<void> updateAvatar(String imageUrl) async {
    await _repo.updateAvatar(imageUrl);
    if (state.user != null) {
      final updated = AppUser(
        id: state.user!.id,
        email: state.user!.email,
        name: state.user!.name,
        image: imageUrl,
        emailVerified: state.user!.emailVerified,
        publicId: state.user!.publicId,
        role: state.user!.role,
        phoneNumber: state.user!.phoneNumber,
        phoneNumberVerified: state.user!.phoneNumberVerified,
        phoneGateExempt: state.user!.phoneGateExempt,
        emailIsPlaceholder: state.user!.emailIsPlaceholder,
      );
      state = AuthState(status: AuthStatus.signedIn, user: updated);
    }
  }

  Future<void> deleteAccount() async {
    _generation++;
    await _repo.deleteAccount();
    state = const AuthState(status: AuthStatus.signedOut);
  }

  Future<void> signOut() async {
    _generation++;
    await _repo.signOut();
    state = const AuthState(status: AuthStatus.signedOut);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  final controller = AuthController(ref.watch(authRepositoryProvider));
  ref.watch(apiClientProvider).onAccountSuspended = controller.markSuspended;
  return controller;
});

/// The signed-in user's own profile. Browse uses its gender to show the
/// opposite gender, mirroring the website.
final myProfileProvider = FutureProvider((ref) async {
  ref.watch(authControllerProvider);
  return ref.watch(profilesRepositoryProvider).me();
});

/// Pending incoming requests — drives the nav badge.
final incomingRequestsProvider = FutureProvider((ref) async {
  ref.watch(authControllerProvider);
  return ref.watch(requestsRepositoryProvider).incoming();
});

final outgoingRequestsProvider = FutureProvider((ref) async {
  ref.watch(authControllerProvider);
  return ref.watch(requestsRepositoryProvider).outgoing();
});

final pendingIncomingCountProvider = Provider<int>((ref) {
  final async = ref.watch(incomingRequestsProvider);
  return async.maybeWhen(
    data: (list) => list.where((r) => r.isPending).length,
    orElse: () => 0,
  );
});

/// The caller's single outstanding outgoing request (or null).
final activeRequestProvider = FutureProvider((ref) async {
  ref.watch(authControllerProvider);
  return ref.watch(requestsRepositoryProvider).active();
});

/// The caller's block list, for the Settings/Blocked accounts screen.
final blockedAccountsProvider = FutureProvider((ref) async {
  ref.watch(authControllerProvider);
  return ref.watch(moderationRepositoryProvider).blocked();
});
