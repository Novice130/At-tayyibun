import 'package:flutter/material.dart';

/// Selection grid for the preset avatar catalogue.
///
/// Shared by the profile avatar picker and the signup wizard so the two show
/// the same tile, ring and check badge. Selection only — persisting the choice
/// differs between the two callers (better-auth `update-user` vs. the sign-up
/// payload), so that stays with them.
class AvatarGrid extends StatelessWidget {
  const AvatarGrid({
    super.key,
    required this.avatars,
    required this.selected,
    required this.onSelect,
    this.padding = const EdgeInsets.all(16),
    this.shrinkWrap = false,
    this.physics,
  });

  final List<String> avatars;
  final String? selected;

  /// Null disables selection (used while a save is in flight).
  final ValueChanged<String>? onSelect;

  final EdgeInsetsGeometry padding;
  final bool shrinkWrap;
  final ScrollPhysics? physics;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GridView.builder(
      padding: padding,
      shrinkWrap: shrinkWrap,
      physics: physics,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
      ),
      itemCount: avatars.length,
      itemBuilder: (context, index) {
        final url = avatars[index];
        final isSelected = url == selected;
        return InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onSelect == null ? null : () => onSelect!(url),
          child: Stack(
            fit: StackFit.expand,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  url,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => Container(
                    color: theme.colorScheme.surfaceContainerHighest,
                    child: const Icon(Icons.person_outline),
                  ),
                ),
              ),
              if (isSelected)
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border:
                        Border.all(color: theme.colorScheme.primary, width: 3),
                  ),
                ),
              if (isSelected)
                Positioned(
                  top: 6,
                  right: 6,
                  child: CircleAvatar(
                    radius: 12,
                    backgroundColor: theme.colorScheme.primary,
                    child: const Icon(Icons.check,
                        size: 14, color: Colors.white),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
