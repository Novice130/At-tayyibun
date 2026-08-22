import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/api_client.dart';
import 'core/theme.dart';
import 'firebase_options.dart';
import 'providers.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase is used for one thing: delivering and checking the phone-
  // verification SMS. It never holds a session — better-auth's cookie does.
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // The cookie jar has to be opened from disk before anything can make a
  // request, so the container is built with it already in place.
  final apiClient = await ApiClient.create();

  runApp(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(apiClient)],
      child: const AtTayyibunApp(),
    ),
  );
}

class AtTayyibunApp extends ConsumerStatefulWidget {
  const AtTayyibunApp({super.key});

  @override
  ConsumerState<AtTayyibunApp> createState() => _AtTayyibunAppState();
}

class _AtTayyibunAppState extends ConsumerState<AtTayyibunApp> {
  @override
  void initState() {
    super.initState();
    // Confirm the persisted session with the server on launch.
    Future.microtask(
      () => ref.read(authControllerProvider.notifier).restore(),
    );
  }

  @override
  Widget build(BuildContext context) {
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
