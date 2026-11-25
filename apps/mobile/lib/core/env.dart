import 'package:flutter/services.dart' show appFlavor;

/// Which backend this build talks to.
///
/// Derived from the build flavor (`flutter build … --flavor dev|prod`), which
/// also sets the app ID. Tying the server to the flavor means a build can't
/// carry the dev app ID while talking to production, or the reverse.
///
///   prod → com.attayyibun.attayyibun / com.attayyibun.at_tayyibun → attayyibun.com
///   dev  → …attayyibun.dev / …at_tayyibun.dev → staging.attayyibun.com
enum AppEnv {
  prod(baseUrl: 'https://attayyibun.com', appName: 'At-Tayyibun'),
  dev(baseUrl: 'https://staging.attayyibun.com', appName: 'At-Tayyibun Dev');

  const AppEnv({required this.baseUrl, required this.appName});

  final String baseUrl;
  final String appName;

  /// `null` means no flavor was given (`flutter test`, or a plain
  /// `flutter run` before flavors existed); that has always meant production.
  /// Anything else unknown is a build mistake, so it fails loudly.
  static AppEnv fromFlavor(String? flavor) => switch (flavor) {
        null || 'prod' => AppEnv.prod,
        'dev' => AppEnv.dev,
        _ => throw StateError(
            'Unknown build flavor "$flavor". Build with --flavor prod or --flavor dev.'),
      };
}

/// The environment of the running build.
final AppEnv kAppEnv = AppEnv.fromFlavor(appFlavor);
