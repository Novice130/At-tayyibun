import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api_client.dart';
import 'core/crash_reporting.dart';
import 'core/push_notifications.dart';
import 'core/theme.dart';
import 'firebase_options.dart';
import 'providers.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await runWithCrashReporting(() async {
    // Firebase delivers and checks the phone-verification SMS and carries push
    // notifications. It never holds a session — better-auth's cookie does.
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // The cookie jar has to be opened from storage before anything can make a
    // request, so the container is built with it already in place.
    final apiClient = await ApiClient.create();

    runApp(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(apiClient),
          pushNotificationsProvider.overrideWith(
            (ref) => PushNotifications(
              messaging: FirebasePushMessaging(),
              devices: ref.watch(devicesRepositoryProvider),
              platform:
                  defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
            ),
          ),
        ],
        child: const AtTayyibunApp(),
      ),
    );
  });
}

class AtTayyibunApp extends ConsumerStatefulWidget {
  const AtTayyibunApp({super.key});

  @override
  ConsumerState<AtTayyibunApp> createState() => _AtTayyibunAppState();
}

class _AtTayyibunAppState extends ConsumerState<AtTayyibunApp> {
  StreamSubscription<String>? _tapSub;
  StreamSubscription<void>? _foregroundSub;

  @override
  void initState() {
    super.initState();
    // Confirm the persisted session with the server on launch.
    Future.microtask(() {
      ref.read(authControllerProvider.notifier).restore();
      _listenForPushes();
    });
  }

  @override
  void dispose() {
    _tapSub?.cancel();
    _foregroundSub?.cancel();
    super.dispose();
  }

  void _listenForPushes() {
    final push = ref.read(pushNotificationsProvider);
    if (push == null) return;
    // A tap while the app was in the background. Signed out, the router's
    // redirect sends this to the welcome screen like any other location.
    _tapSub = push.tappedLocations.listen(
      (location) => ref.read(routerProvider).go(location),
    );
    // A push in the foreground means a request changed; refresh the lists and
    // the nav badge rather than show a banner (iOS shows one as well).
    _foregroundSub = push.foregroundMessages.listen((_) {
      ref.invalidate(incomingRequestsProvider);
      ref.invalidate(outgoingRequestsProvider);
      ref.invalidate(activeRequestProvider);
    });
  }

  /// Push starts once a member is signed in and past the phone gate (the API
  /// refuses everything before it), so a signed-out launch never prompts.
  Future<void> _onAuthChanged(AuthState? previous, AuthState next) async {
    final push = ref.read(pushNotificationsProvider);
    if (push == null) return;
    bool ready(AuthState? s) => s != null && s.isSignedIn && !s.needsPhone;

    if (ready(next) && !ready(previous)) {
      unawaited(push.start());
      // The notification that launched the app, opened once signed in.
      final location = await push.takeInitialLocation();
      if (location != null && mounted) ref.read(routerProvider).go(location);
    } else if (!next.isSignedIn && (previous?.isSignedIn ?? false)) {
      // Sign-out already removed the token while the session existed; after
      // deletion, suspension or expiry there is no session to do it with.
      await push.reset();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authControllerProvider, _onAuthChanged);
    return MaterialApp.router(
      title: 'At-Tayyibun',
      debugShowCheckedModeBanner: false,
      theme: buildLightTheme(),
      darkTheme: buildDarkTheme(),
      themeMode: ThemeMode.system,
      routerConfig: ref.watch(routerProvider),
    );
  }
}
