import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api_client.dart';
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

enum AuthStatus { unknown, signedIn, signedOut }

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

  /// Called once at startup. The persisted cookie means a returning user is
  /// usually still signed in; this confirms it with the server rather than
  /// trusting the cookie's presence.
  Future<void> restore() async {
    final gen = ++_generation;
    try {
      final user = await _repo.getSession();
      if (gen != _generation) return;
      state = user == null
          ? const AuthState(status: AuthStatus.signedOut)
          : AuthState(status: AuthStatus.signedIn, user: user);
    } catch (e) {
      if (gen != _generation) return;
      // Offline at launch shouldn't hard-log-out someone whose cookie is fine.
      // Treat it as signed-out for routing, but keep it non-destructive: the
      // cookie is untouched, so a retry can still succeed.
      debugPrint('Session restore failed: $e');
      state = const AuthState(status: AuthStatus.signedOut);
    }
  }

  Future<SignInResult> signIn(String email, String password) async {
    _generation++;
    final result = await _repo.signIn(email: email, password: password);
    if (result is SignInSuccess) {
      state = AuthState(status: AuthStatus.signedIn, user: result.user);
    }
    return result;
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
    StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref.watch(authRepositoryProvider)),
);

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
