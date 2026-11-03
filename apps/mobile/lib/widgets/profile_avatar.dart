import 'package:flutter/material.dart';

import '../core/avatar_url.dart';

/// A preset avatar, or the person's initial when the URL is missing, not on
/// the allow-list (see [trustedAvatarUrl]), or fails to load.
///
/// The API sends a DiceBear SVG URL for members with no image, and `users.image`
/// can hold a Google photo URL. Neither is fetched, so those members show their
/// initial.
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.url,
    required this.fallbackLabel,
    this.size,
    this.borderRadius,
  });

  final String url;
  final String fallbackLabel;
  final double? size;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(16);
    final placeholder = _Fallback(label: fallbackLabel, size: size);
    final trusted = trustedAvatarUrl(url);

    return ClipRRect(
      borderRadius: radius,
      child: trusted == null
          ? placeholder
          : Image.network(
              trusted,
              width: size,
              height: size,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => placeholder,
            ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.label, this.size});

  final String label;
  final double? size;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final initial = label.isEmpty ? '?' : label.characters.first.toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      color: theme.colorScheme.surfaceContainerHighest,
      child: Text(
        initial,
        style: TextStyle(
          fontSize: (size ?? 48) * 0.4,
          fontWeight: FontWeight.bold,
          color: theme.colorScheme.primary,
        ),
      ),
    );
  }
}
