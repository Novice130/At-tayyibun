import 'env.dart';

/// Deployed origin for this build's environment (see env.dart). Both surfaces
/// live here:
///   /auth/*  -> better-auth inside the Next.js app
///   /api/*   -> proxied through to the NestJS API
final String kBaseUrl = kAppEnv.baseUrl;

/// better-auth runs an origin check on every non-GET /auth/* request. Once the
/// cookie jar holds anything for the host it rejects requests whose Origin is
/// missing or untrusted, so this header is mandatory on auth POSTs.
final String kOriginHeader = kBaseUrl;

/// Session cookie. The `__Secure-` prefix is applied by better-auth because the
/// origin is HTTPS; the unprefixed name is what a local http:// dev server
/// would set. The API accepts either.
const String kSessionCookieSecure = '__Secure-better-auth.session_token';
const String kSessionCookie = 'better-auth.session_token';

/// Browse page size. The API hard-caps this at 50.
const int kBrowsePageSize = 20;

/// The **web** OAuth client id from Google Cloud Console — not the Android one.
///
/// Passing it as `serverClientId` makes Google mint an ID token whose audience
/// is the web client, which is exactly what the server verifies
/// (better-auth checks `audience: options.clientId`, a single value). An
/// Android client id here would produce a token the server rejects.
///
/// Injected at build time so it never lands in the repo:
///   flutter build apk --dart-define=GOOGLE_SERVER_CLIENT_ID=xxx.apps.googleusercontent.com
///
/// The iOS client is tied to a bundle ID, so the dev app has its own. Empty
/// means google_sign_in falls back to GIDClientID in Info.plist.
const String _kGoogleIosClientIdOverride = String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');
final String kGoogleIosClientId = _kGoogleIosClientIdOverride.isNotEmpty
    ? _kGoogleIosClientIdOverride
    : switch (kAppEnv) {
        AppEnv.prod =>
          '659173631996-gg4ju84nmskgcrq6hkc030fmsa7kaj4l.apps.googleusercontent.com',
        // Set once the iOS OAuth client for com.attayyibun.attayyibun.dev exists
        // (Google Cloud project 659173631996). See README "Dev app".
        AppEnv.dev => '',
      };

const String kGoogleServerClientId = String.fromEnvironment(
  'GOOGLE_SERVER_CLIENT_ID',
  defaultValue:
      '659173631996-bi5c9d3i4qk6pksee92abkn3t4vheeo9.apps.googleusercontent.com',
);

/// The preset avatar set, mirrored from apps/web/src/app/signup/SignupForm.tsx.
/// Real photos are never displayed publicly — a chosen cartoon avatar is the
/// only image the product shows, which is also why the iOS app needs no photo
/// library permission.
List<String> presetAvatars(String gender) {
  final folder = gender.toUpperCase() == 'MALE' ? 'male' : 'female';
  return List.generate(21, (i) => '$kBaseUrl/avatars/$folder/$folder-${i + 1}.jpg');
}

const List<String> kEthnicities = [
  'South Asian',
  'Arab',
  'African',
  'African American',
  'Southeast Asian',
  'Turkish',
  'Persian',
  'Central Asian',
  'White / Caucasian',
  'Hispanic / Latino',
  'Mixed',
  'Other',
];

const List<String> kUsStates = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC',
];
