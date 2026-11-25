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
/// Android client id here would produce a token the server rejects. It must
/// equal GOOGLE_CLIENT_ID on the server this flavor talks to.
///
/// Client ids are public identifiers (the secret stays on the server). Each
/// flavor has its own Google Cloud project:
///   prod → at-tayyibun-prod     dev → at-tayyibun-staging
/// Either can be overridden at build time with
///   --dart-define=GOOGLE_SERVER_CLIENT_ID=… / GOOGLE_IOS_CLIENT_ID=…
const String _kGoogleServerClientIdOverride =
    String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
final String kGoogleServerClientId = _kGoogleServerClientIdOverride.isNotEmpty
    ? _kGoogleServerClientIdOverride
    : switch (kAppEnv) {
        AppEnv.prod =>
          '302409438996-b89uv51bu8h044h2eakirmg63k9cmug3.apps.googleusercontent.com',
        AppEnv.dev =>
          '1011611778098-l2va7fnar0q9amkcnctvcfb32nh0ijtk.apps.googleusercontent.com',
      };

/// The iOS OAuth client is tied to a bundle ID, so each flavor has its own.
/// Must match GIDClientID in Info.plist (Flutter/prod.xcconfig, dev.xcconfig).
const String _kGoogleIosClientIdOverride =
    String.fromEnvironment('GOOGLE_IOS_CLIENT_ID');
final String kGoogleIosClientId = _kGoogleIosClientIdOverride.isNotEmpty
    ? _kGoogleIosClientIdOverride
    : switch (kAppEnv) {
        AppEnv.prod =>
          '302409438996-2o4i457ecpv9matr4bg8mjj0rhvuq59f.apps.googleusercontent.com',
        AppEnv.dev =>
          '1011611778098-okilkjejj879ngnf8n0936kouqalinkg.apps.googleusercontent.com',
      };

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
