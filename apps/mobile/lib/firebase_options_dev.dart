// Firebase options for the dev app (flavor `dev`), Firebase project
// at-tayyibun-staging — separate from production so staging traffic, test
// users and SMS never touch the real project. Values from
// android/app/src/dev/google-services.json and
// ios/config/dev/GoogleService-Info.plist. Public identifiers, not secrets.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DevFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('The mobile app has no web Firebase options.');
    }
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => android,
      TargetPlatform.iOS => ios,
      _ => throw UnsupportedError(
          'DevFirebaseOptions are not supported for this platform.'),
    };
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCX1flrGcxC-qY2IzO8e7RC2hCJe43WjVo',
    appId: '1:1011611778098:android:e2a58724c3cbcad069d02b',
    messagingSenderId: '1011611778098',
    projectId: 'at-tayyibun-staging',
    storageBucket: 'at-tayyibun-staging.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBAeicsnRzrid5QGKfpaZQapoX1jNgjEOw',
    appId: '1:1011611778098:ios:f758eb50e7ab873969d02b',
    messagingSenderId: '1011611778098',
    projectId: 'at-tayyibun-staging',
    storageBucket: 'at-tayyibun-staging.firebasestorage.app',
    iosClientId:
        '1011611778098-okilkjejj879ngnf8n0936kouqalinkg.apps.googleusercontent.com',
    iosBundleId: 'com.attayyibun.attayyibun.dev',
  );
}
