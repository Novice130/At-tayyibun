// Firebase options for the dev app (flavor `dev`). Same Firebase project as
// production (at-tayyibun-e3f79); separate registered apps, because Firebase
// keys each app to its bundle ID / package name:
//   iOS     com.attayyibun.attayyibun.dev
//   Android com.attayyibun.at_tayyibun.dev
//
// Until those apps are registered, this throws so the dev app fails at launch
// with a clear message instead of borrowing production's app IDs.
// To fill it in, see README "Dev app → One-time console setup", then replace
// the throw with the values from the new google-services.json /
// GoogleService-Info.plist (or run `flutterfire configure` for the dev flavor).
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class DevFirebaseOptions {
  static FirebaseOptions get currentPlatform => throw UnsupportedError(
        'Dev Firebase apps are not registered yet. Add the dev iOS and Android '
        'apps to Firebase project at-tayyibun-e3f79 and fill in '
        'lib/firebase_options_dev.dart (README: "Dev app").',
      );
}
