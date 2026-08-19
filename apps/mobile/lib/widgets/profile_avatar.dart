import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Avatars come from DiceBear as **SVG**, which Image.network cannot decode —
/// hence flutter_svg. Falls back to an initial when the URL is missing or the
/// fetch fails.
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

    if (url.isEmpty) {
      return ClipRRect(borderRadius: radius, child: placeholder);
    }

    return ClipRRect(
      borderRadius: radius,
      child: SvgPicture.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholderBuilder: (_) => placeholder,
        // Broken/unreachable avatar URLs used to render a blank box — fall
        // back to the initial so the UI never shows an empty avatar.
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
