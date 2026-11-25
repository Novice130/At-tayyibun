/// The links the app opens: https://attayyibun.com/requests and
/// `https://attayyibun.com/profiles/{publicId}`, from App Links / Universal
/// Links or from the `path` field of a push notification.
///
/// Everything else maps to null and is ignored, so a link or a push payload
/// can never send the app to an arbitrary screen. Keep this list in step with
/// the intent-filter in AndroidManifest.xml and the paths in
/// apps/web/src/lib/app-links.ts.
library;

const Set<String> _hosts = {'attayyibun.com', 'www.attayyibun.com'};

/// Public ids are nanoid-style. Anything else is not a profile link.
final RegExp _publicId = RegExp(r'^[A-Za-z0-9_-]{1,64}$');

/// Maps an incoming link to an in-app location, or null when it is not one
/// the app handles. Accepts a full https URL on the site's host or a bare
/// path such as `/requests`.
String? deepLinkLocation(Uri uri) {
  if (uri.hasScheme) {
    if (uri.scheme != 'https' || !_hosts.contains(uri.host)) return null;
    if (uri.hasPort && uri.port != 443) return null;
  } else if (uri.hasAuthority) {
    return null;
  }

  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  if (segments.length == 1 && segments[0] == 'requests') return '/requests';
  if (segments.length == 2 &&
      segments[0] == 'profiles' &&
      _publicId.hasMatch(segments[1])) {
    return '/profiles/${segments[1]}';
  }
  return null;
}

/// The location a push notification asks to open, from its `path` data field.
String? pushLocation(Map<String, dynamic> data) {
  final path = data['path'];
  if (path is! String || path.isEmpty) return null;
  final uri = Uri.tryParse(path);
  return uri == null ? null : deepLinkLocation(uri);
}
