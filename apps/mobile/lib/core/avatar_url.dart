import 'constants.dart';

const _imageExtensions = {'.jpg', '.jpeg', '.png', '.webp'};

/// The URL to fetch for an avatar, or null when it should not be fetched.
///
/// Avatar URLs come from `users.image`, which other clients can write, and a
/// fetch tells the remote host the viewer's IP address. Only the preset
/// catalogue on our own origin is loaded. `/auth` and `/api` share that origin,
/// so there is no separate API host to allow. SVG is refused because it is
/// parsed as a document rather than decoded as a bitmap.
String? trustedAvatarUrl(String raw) {
  final text = raw.trim();
  if (text.isEmpty) return null;

  final parsed = Uri.tryParse(text);
  if (parsed == null) return null;

  final base = Uri.parse(kBaseUrl);
  final uri = base.resolveUri(parsed);
  if (uri.scheme != base.scheme ||
      uri.host != base.host ||
      uri.port != base.port ||
      uri.userInfo.isNotEmpty) {
    return null;
  }

  final path = uri.path;
  final lower = path.toLowerCase();
  if (!path.startsWith('/avatars/')) return null;
  // resolveUri removes plain dot segments; an encoded one could still pass.
  if (path.contains('..') || path.contains('%')) return null;
  if (!_imageExtensions.any(lower.endsWith)) return null;

  return uri.toString();
}
