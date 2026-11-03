// Verification files that let the mobile app open attayyibun.com links:
// Android App Links (/.well-known/assetlinks.json) and iOS Universal Links
// (/.well-known/apple-app-site-association). Served by route handlers so both
// go out as application/json; a public/ file without an extension would not.
//
// The paths must match the mobile app: the intent-filter in
// apps/mobile/android/app/src/main/AndroidManifest.xml, the associated domain
// in apps/mobile/ios/Runner/Runner.entitlements and the mapping in
// apps/mobile/lib/core/deep_links.dart. Other site links, such as the emailed
// /requests/<id>/contact, are left to the browser.

/** applicationId in apps/mobile/android/app/build.gradle.kts. */
export const ANDROID_PACKAGE_NAME = 'com.attayyibun.at_tayyibun';

/**
 * SHA-256 fingerprints of the certificate that signs the installed app. With
 * Play App Signing that is Google's app signing key, not the upload key:
 * Play Console -> Test and release -> App integrity -> App signing.
 *
 * Read at request time from ANDROID_APP_SHA256_FINGERPRINTS (comma-separated,
 * `AA:BB:...` form; public values, not secrets), so setting it needs a
 * container restart, not a rebuild. Malformed entries are dropped. With none
 * set, assetlinks.json is a 404: publishing a wrong fingerprint would make
 * Android record the domain as unverified on install, while a 404 only means
 * links open in the browser until the value is set.
 */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function androidCertFingerprints(raw = process.env.ANDROID_APP_SHA256_FINGERPRINTS): string[] {
  return (raw ?? '')
    .split(',')
    .map((f) => f.trim().replace(/^["']|["']$/g, '').toUpperCase())
    .filter((f) => FINGERPRINT.test(f));
}

/** DEVELOPMENT_TEAM and PRODUCT_BUNDLE_IDENTIFIER in the iOS Runner target. */
export const IOS_APP_ID = 'TT3HQ774N4.com.attayyibun.attayyibun';

/** Paths the app opens, in Apple's component syntax (`*` matches anything). */
export const APP_LINK_PATHS = ['/requests', '/profiles/*'] as const;

/** Null until a valid fingerprint is configured. */
export function assetLinks(fingerprints = androidCertFingerprints()) {
  if (fingerprints.length === 0) return null;
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function appleAppSiteAssociation() {
  return {
    applinks: {
      details: [
        {
          appIDs: [IOS_APP_ID],
          components: APP_LINK_PATHS.map((path) => ({ '/': path })),
        },
      ],
    },
  };
}

/** Apple's CDN and Google's verifier refetch these; an hour keeps edits quick. */
export const APP_LINKS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600',
} as const;
