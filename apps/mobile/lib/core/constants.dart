/// Deployed origin. Both surfaces live here:
///   /auth/*  -> better-auth inside the Next.js app
///   /api/*   -> proxied through to the NestJS API
const String kBaseUrl = 'https://attayyibun.com';

/// better-auth runs an origin check on every non-GET /auth/* request. Once the
/// cookie jar holds anything for the host it rejects requests whose Origin is
/// missing or untrusted, so this header is mandatory on auth POSTs.
const String kOriginHeader = kBaseUrl;

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
const String kGoogleServerClientId =
    String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

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
