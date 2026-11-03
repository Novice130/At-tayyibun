import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/constants.dart';
import '../providers.dart';

const _supportEmail = 'support@attayyibun.com';

/// Mirrors apps/web/src/app/suspended/page.tsx. A suspended member cannot reach
/// the profile screen, where deletion normally lives, so it is offered here:
/// they keep the right to erase their data.
class SuspendedScreen extends ConsumerStatefulWidget {
  const SuspendedScreen({super.key});

  @override
  ConsumerState<SuspendedScreen> createState() => _SuspendedScreenState();
}

class _SuspendedScreenState extends ConsumerState<SuspendedScreen> {
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).deleteAccount();
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Could not delete your account. Please try again, or email '
              '$_supportEmail.';
        });
      }
    }
  }

  Future<void> _signOut() async {
    setState(() => _busy = true);
    await ref.read(authControllerProvider.notifier).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final canDelete = _confirm.text == 'DELETE' && !_busy;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Icon(Icons.shield_outlined,
                      size: 44, color: theme.colorScheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    'Your account is suspended',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'You cannot use At-Tayyibun while suspended, and your '
                    'profile is hidden from other members.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'To ask about this, email us:',
                    textAlign: TextAlign.center,
                  ),
                  TextButton(
                    onPressed: () =>
                        launchUrl(Uri.parse('mailto:$_supportEmail')),
                    child: const Text(_supportEmail),
                  ),
                  TextButton(
                    onPressed: () => launchUrl(Uri.parse('$kBaseUrl/terms'),
                        mode: LaunchMode.externalApplication),
                    child: const Text('Terms of Use'),
                  ),
                  OutlinedButton(
                    onPressed: _busy ? null : _signOut,
                    child: const Text('Sign out'),
                  ),
                  const SizedBox(height: 32),
                  const Divider(),
                  const SizedBox(height: 16),
                  Text(
                    'Delete your account',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text('This is permanent. Type DELETE to confirm.'),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _confirm,
                    autocorrect: false,
                    enableSuggestions: false,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      labelText: 'Type DELETE to confirm',
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!,
                        style: TextStyle(color: theme.colorScheme.error)),
                  ],
                  const SizedBox(height: 12),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: theme.colorScheme.error,
                      foregroundColor: theme.colorScheme.onError,
                    ),
                    onPressed: canDelete ? _delete : null,
                    child: const Text('Delete my account'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
