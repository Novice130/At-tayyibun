import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/deep_links.dart';
import 'providers.dart';
import 'screens/avatar_picker_screen.dart';
import 'screens/browse_screen.dart';
import 'screens/edit_profile_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/login_screen.dart';
import 'screens/my_profile_screen.dart';
import 'screens/offline_screen.dart';
import 'screens/profile_detail_screen.dart';
import 'screens/requests_screen.dart';
import 'screens/shell_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/suspended_screen.dart';
import 'screens/verify_phone_screen.dart';
import 'screens/welcome_screen.dart';

final _rootKey = GlobalKey<NavigatorState>();
final _shellKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/browse',
    refreshListenable: _AuthListenable(ref),
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final path = state.uri.path;
      final isAuthRoute =
          path == '/welcome' ||
          path == '/login' ||
          path == '/signup' ||
          path == '/signup/phone' ||
          path == '/forgot-password';

      // Hold on the splash until the session probe resolves, so a returning
      // user is never briefly bounced to the login screen. An App Link or
      // Universal Link that launched the app rides along in `from`, so it
      // still opens once the session is confirmed.
      if (auth.status == AuthStatus.unknown) {
        if (path == '/splash') return null;
        final target = deepLinkLocation(state.uri);
        return target == null
            ? '/splash'
            : Uri(path: '/splash', queryParameters: {'from': target})
                .toString();
      }

      if (auth.status == AuthStatus.offline) {
        return path == '/offline' ? null : '/offline';
      }

      // Suspension outranks every other gate: nothing else would work anyway.
      if (auth.status == AuthStatus.suspended) {
        return path == '/suspended' ? null : '/suspended';
      }

      if (!auth.isSignedIn) return isAuthRoute ? null : '/welcome';

      // 1. Phone gate. Enforced server-side by BetterAuthGuard too — this only
      // saves the user from a screen full of 403s.
      if (auth.needsPhone) return path == '/verify-phone' ? null : '/verify-phone';

      // 2. Avatar gate. Require avatar selection right after sign-in / verification.
      if (auth.needsAvatar) {
        if (path == '/profile/avatar') return null;
        return '/profile/avatar?initial=true';
      }

      if (path == '/verify-phone') return '/browse';

      if (path == '/splash') {
        final from = state.uri.queryParameters['from'];
        final target = from == null ? null : deepLinkLocation(Uri.parse(from));
        return target ?? '/browse';
      }

      if (isAuthRoute ||
          path == '/offline' ||
          path == '/suspended') {
        return '/browse';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (_, _) => const _SplashScreen(),
      ),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(
        path: '/forgot-password',
        builder: (_, _) => const ForgotPasswordScreen(),
      ),
      GoRoute(path: '/offline', builder: (_, _) => const OfflineScreen()),
      GoRoute(path: '/suspended', builder: (_, _) => const SuspendedScreen()),
      GoRoute(path: '/signup', builder: (_, _) => const SignupScreen()),
      GoRoute(
        path: '/signup/phone',
        builder: (_, _) => const VerifyPhoneScreen(attachToSession: false),
      ),
      GoRoute(
        path: '/verify-phone',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const VerifyPhoneScreen(),
      ),
      GoRoute(
        path: '/profiles/:publicId',
        parentNavigatorKey: _rootKey,
        builder: (_, state) =>
            ProfileDetailScreen(publicId: state.pathParameters['publicId']!),
      ),
      GoRoute(
        path: '/profile/edit',
        parentNavigatorKey: _rootKey,
        builder: (_, _) => const EditProfileScreen(),
      ),
      GoRoute(
        path: '/profile/avatar',
        parentNavigatorKey: _rootKey,
        builder: (_, state) => AvatarPickerScreen(
          gender: state.uri.queryParameters['gender'],
          isInitial: state.uri.queryParameters['initial'] == 'true',
        ),
      ),
      ShellRoute(
        navigatorKey: _shellKey,
        builder: (_, _, child) => ShellScreen(child: child),
        routes: [
          GoRoute(path: '/browse', builder: (_, _) => const BrowseScreen()),
          GoRoute(path: '/requests', builder: (_, _) => const RequestsScreen()),
          GoRoute(path: '/profile', builder: (_, _) => const MyProfileScreen()),
        ],
      ),
    ],
  );
});

/// Bridges Riverpod auth state into go_router's refresh mechanism.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authControllerProvider, (_, _) => notifyListeners());
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Branded splash instead of a bare spinner — the auth probe only
            // takes a moment, but a logo reads as intentional, not frozen.
            Text(
              'At-Tayyibun',
              style: theme.textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: theme.colorScheme.primary,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Muslim Matrimony',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: 32),
            const SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(strokeWidth: 3),
            ),
          ],
        ),
      ),
    );
  }
}
