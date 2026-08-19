import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api_exception.dart';
import '../core/constants.dart';
import '../providers.dart';

/// Preset avatar catalogue — the only images the product ever displays are the
/// fixed illustrated set from the web signup. Picking one calls better-auth's
/// update-user so `users.image` carries an absolute URL, which browse then
/// prefers over the DiceBear default.
class AvatarPickerScreen extends ConsumerStatefulWidget {
  const AvatarPickerScreen({super.key, required this.gender});

  final String gender;

  @override
  ConsumerState<AvatarPickerScreen> createState() => _AvatarPickerScreenState();
}

class _AvatarPickerScreenState extends ConsumerState<AvatarPickerScreen> {
  late final List<String> _avatars = presetAvatars(widget.gender);
  String? _selected;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final current = ref.read(myProfileProvider).valueOrNull;
    final image = current?.image;
    if (image != null && image.isNotEmpty) {
      _selected = _avatars.contains(image) ? image : null;
    }
  }

  Future<void> _save() async {
    final url = _selected;
    if (url == null || _saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(authRepositoryProvider).updateAvatar(url);
      ref.invalidate(myProfileProvider);
      if (mounted) context.pop(true);
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Choose Photo'),
        actions: [
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
        child: GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 3,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
          ),
          itemCount: _avatars.length,
          itemBuilder: (context, index) {
            final url = _avatars[index];
            final isSelected = url == _selected;
            return InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: _saving ? null : () => setState(() => _selected = url),
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
                        border: Border.all(
                            color: theme.colorScheme.primary, width: 3),
                      ),
                    ),
                  if (isSelected)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: CircleAvatar(
                        radius: 12,
                        backgroundColor: theme.colorScheme.primary,
                        child: const Icon(Icons.check, size: 14, color: Colors.white),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
