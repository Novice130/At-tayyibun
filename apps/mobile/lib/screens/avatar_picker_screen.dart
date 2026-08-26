import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api_exception.dart';
import '../core/constants.dart';
import '../providers.dart';
import '../widgets/avatar_grid.dart';

/// Preset avatar catalogue — the only images the product ever displays are the
/// fixed illustrated set from the web signup. Picking one calls better-auth's
/// update-user so `users.image` carries an absolute URL, which browse then
/// prefers over the DiceBear default.
class AvatarPickerScreen extends ConsumerStatefulWidget {
  const AvatarPickerScreen({super.key, this.gender, this.isInitial = false});

  final String? gender;
  final bool isInitial;

  @override
  ConsumerState<AvatarPickerScreen> createState() => _AvatarPickerScreenState();
}

class _AvatarPickerScreenState extends ConsumerState<AvatarPickerScreen> {
  late String _gender;
  String? _selected;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final profile = ref.read(myProfileProvider).valueOrNull?.profile;
    final initialGender = widget.gender ?? profile?.gender ?? 'MALE';
    _gender = initialGender.toUpperCase() == 'FEMALE' ? 'FEMALE' : 'MALE';

    final currentImage = ref.read(authControllerProvider).user?.image ??
        ref.read(myProfileProvider).valueOrNull?.image;
    if (currentImage != null &&
        currentImage.isNotEmpty &&
        (currentImage.contains('/avatars/male/') ||
            currentImage.contains('/avatars/female/'))) {
      _selected = currentImage;
    }
  }

  Future<void> _save() async {
    final url = _selected;
    if (url == null || _saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(authControllerProvider.notifier).updateAvatar(url);
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      if (widget.isInitial || !context.canPop()) {
        context.go('/browse');
      } else {
        context.pop(true);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final avatars = presetAvatars(_gender);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isInitial ? 'Choose Your Avatar' : 'Change Photo'),
        automaticallyImplyLeading: !widget.isInitial,
        actions: [
          if (widget.isInitial)
            TextButton(
              onPressed: _saving
                  ? null
                  : () => ref.read(authControllerProvider.notifier).signOut(),
              child: const Text('Sign out'),
            )
          else
            TextButton(
              onPressed: (_selected == null || _saving) ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save'),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                children: [
                  if (widget.isInitial) ...[
                    Text(
                      'Select a cartoon avatar for your profile. Real photos are never displayed publicly.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurface.withValues(alpha: 0.75),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'MALE', label: Text('Brother')),
                      ButtonSegment(value: 'FEMALE', label: Text('Sister')),
                    ],
                    selected: {_gender},
                    onSelectionChanged: _saving
                        ? null
                        : (s) {
                            if (s.isNotEmpty) {
                              setState(() {
                                _gender = s.first;
                                _selected = null;
                              });
                            }
                          },
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: AvatarGrid(
                avatars: avatars,
                selected: _selected,
                onSelect: _saving ? null : (url) => setState(() => _selected = url),
              ),
            ),
            if (widget.isInitial)
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: (_selected == null || _saving) ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save & Continue'),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
