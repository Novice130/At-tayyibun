// Firebase options for the production app (flavor `prod`), Firebase project
// at-tayyibun-prod. Values from android/app/src/prod/google-services.json and
// ios/config/prod/GoogleService-Info.plist. These are public identifiers, not
// secrets.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('The mobile app has no web Firebase options.');
    }
    return switch (defaultTargetPlatform) {
      TargetPlatform.android => android,
      TargetPlatform.iOS => ios,
      _ => throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.'),
    };
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDLQgezdkBtCcSR9RMdfQlkTA68IPssWD8',
    appId: '1:302409438996:android:e429bb409219e486531401',
    messagingSenderId: '302409438996',
    projectId: 'at-tayyibun-prod',
    storageBucket: 'at-tayyibun-prod.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBy0XRk0qb3452KOQengLL0T3IGwaabfE4',
    appId: '1:302409438996:ios:69ed80fda11d859b531401',
    messagingSenderId: '302409438996',
    projectId: 'at-tayyibun-prod',
    storageBucket: 'at-tayyibun-prod.firebasestorage.app',
    iosClientId:
        '302409438996-2o4i457ecpv9matr4bg8mjj0rhvuq59f.apps.googleusercontent.com',
    iosBundleId: 'com.attayyibun.attayyibun',
  );
}
