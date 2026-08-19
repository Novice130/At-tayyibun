import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api_exception.dart';
import '../core/constants.dart';
import '../models/profile.dart';
import '../providers.dart';
import '../widgets/profile_avatar.dart';
import '../widgets/states.dart';

/// Fields stored inside the encrypted `biodata` blob that are worth surfacing.
/// The website used to save all of these and then render none of them.
const _biodataLabels = <String, String>{
  'education': 'Education',
  'profession': 'Profession',
  'legalStatus': 'Legal Status',
  'relocate': 'Open to Relocate',
  'religiousPractice': 'Religious Practice',
  'prayerFrequency': 'Prayer',
  'dietaryPreference': 'Diet',
  'sect': 'Sect',
};

class MyProfileScreen extends ConsumerWidget {
  const MyProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(myProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Sign out?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancel'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Sign out'),
                    ),
                  ],
                ),
              );
              if (confirmed != true) return;
              await ref.read(authControllerProvider.notifier).signOut();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: SafeArea(
        child: async.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(
            message: e is ApiException
                ? e.message
                : 'Something went wrong. Please try again.',
            onRetry: () => ref.invalidate(myProfileProvider),
          ),
          data: (me) => RefreshIndicator(
            onRefresh: () async => ref.invalidate(myProfileProvider),
            child: _Body(me: me),
          ),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.me});

  final MyProfile me;

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final first = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text(
          'This is permanent and immediate. Your profile, photos, requests '
          'and messages are removed right away and cannot be recovered.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (first != true || !context.mounted) return;

    final controller = TextEditingController();
    final second = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Type DELETE to confirm'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'DELETE'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () =>
                Navigator.pop(ctx, controller.text.trim() == 'DELETE'),
            child: const Text('Delete permanently'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (second != true) return;

    try {
      await ref.read(authControllerProvider.notifier).deleteAccount();
      if (context.mounted) context.go('/login');
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final p = me.profile;

    if (p == null || !p.profileComplete) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 40),
          EmptyView(
            icon: Icons.edit_note,
            title: 'Finish your profile',
            message:
                'Complete your profile so families can find you in Browse.',
            action: FilledButton(
              onPressed: () => context.push('/profile/edit'),
              child: const Text('Complete Profile'),
            ),
          ),
        ],
      );
    }

    final fullName = [p.firstName, p.lastName]
        .where((e) => e.isNotEmpty)
        .join(' ');
    final location =
        [p.city, p.state].where((e) => e != null && e.isNotEmpty).join(', ');

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                ProfileAvatar(
                  url: me.image ?? '',
                  fallbackLabel: p.firstName,
                  size: 80,
                  borderRadius: BorderRadius.circular(40),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => context.push(
                    '/profile/avatar?gender=${p.gender ?? 'MALE'}',
                  ),
                  child: const Text('Change photo'),
                ),
                const SizedBox(height: 4),
                Text(
                  p.age > 0 ? '$fullName, ${p.age}' : fullName,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 14,
                  runSpacing: 4,
                  children: [
                    if (location.isNotEmpty) Text(location),
                    Text(p.ethnicity),
                  ],
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () => context.push('/profile/edit'),
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Edit Profile'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _Section(
          title: 'About Me',
          child: Text(
            (p.bio == null || p.bio!.isEmpty) ? 'No bio added yet.' : p.bio!,
            style: theme.textTheme.bodyMedium,
          ),
        ),
        const SizedBox(height: 16),
        _Section(
          title: 'Details',
          child: Column(
            children: [
              _Row(label: 'Gender', value: p.gender ?? '—'),
              _Row(label: 'Ethnicity', value: p.ethnicity),
              _Row(label: 'Public ID', value: me.publicId),
              for (final entry in _biodataLabels.entries)
                if (_display(p.biodata[entry.key]) != null)
                  _Row(
                    label: entry.value,
                    value: _display(p.biodata[entry.key])!,
                  ),
            ],
          ),
        ),
        if (_display(p.biodata['partnerPreferences']) != null ||
            _display(p.biodata['dealBreakers']) != null) ...[
          const SizedBox(height: 16),
          _Section(
            title: 'Match Preferences',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_display(p.biodata['partnerPreferences']) != null) ...[
                  Text("What I'm Looking For",
                      style: theme.textTheme.labelMedium),
                  const SizedBox(height: 4),
                  Text(_display(p.biodata['partnerPreferences'])!),
                  const SizedBox(height: 12),
                ],
                if (_display(p.biodata['dealBreakers']) != null) ...[
                  Text('Deal Breakers', style: theme.textTheme.labelMedium),
                  const SizedBox(height: 4),
                  Text(_display(p.biodata['dealBreakers'])!),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        _Section(
          title: 'Blocked Accounts',
          child: _BlockedList(),
        ),
        const SizedBox(height: 16),
        _Section(
          title: 'Legal',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextButton(
                onPressed: () => launchUrl(Uri.parse('$kBaseUrl/privacy'),
                    mode: LaunchMode.externalApplication),
                child: const Text('Privacy Policy'),
              ),
              TextButton(
                onPressed: () => launchUrl(Uri.parse('$kBaseUrl/terms'),
                    mode: LaunchMode.externalApplication),
                child: const Text('Terms of Service'),
              ),
              TextButton(
                onPressed: () => launchUrl(Uri.parse('$kBaseUrl/contact'),
                    mode: LaunchMode.externalApplication),
                child: const Text('Contact Us'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Danger zone — visually separated, error colour. App Review checks
        // that deletion is reachable in at most two taps from a persistent tab.
        Card(
          color: theme.colorScheme.error.withValues(alpha: 0.06),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Danger Zone',
                    style: theme.textTheme.titleMedium
                        ?.copyWith(color: theme.colorScheme.error)),
                const SizedBox(height: 8),
                Text(
                  'Deleting your account is permanent and cannot be undone.',
                  style: theme.textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: theme.colorScheme.error,
                  ),
                  onPressed: () => _confirmDelete(context, ref),
                  icon: const Icon(Icons.delete_forever_outlined, size: 18),
                  label: const Text('Delete account'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  static String? _display(Object? value) {
    if (value == null) return null;
    if (value is bool) return value ? 'Yes' : 'No';
    final s = value.toString().trim();
    return s.isEmpty ? null : s;
  }
}

class _BlockedList extends ConsumerWidget {
  const _BlockedList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blocked = ref.watch(blockedAccountsProvider);
    return blocked.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(8),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => const Text('Could not load blocked accounts.'),
      data: (list) {
        if (list.isEmpty) {
          return const Text('No blocked accounts.',
              style: TextStyle(fontStyle: FontStyle.italic));
        }
        return Column(
          children: [
            for (final entry in list)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(entry.name ?? entry.targetPublicId),
                subtitle: Text(entry.email ?? ''),
                trailing: TextButton(
                  onPressed: () async {
                    try {
                      await ref
                          .read(moderationRepositoryProvider)
                          .unblock(entry.targetPublicId);
                      ref.invalidate(blockedAccountsProvider);
                    } on ApiException catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(e.message)));
                      }
                    }
                  },
                  child: const Text('Unblock'),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              child,
            ],
          ),
        ),
      );
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: theme.textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
