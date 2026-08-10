import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../models/profile.dart';
import '../providers.dart';
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
            message: e.toString(),
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

class _Body extends StatelessWidget {
  const _Body({required this.me});

  final MyProfile me;

  @override
  Widget build(BuildContext context) {
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
                CircleAvatar(
                  radius: 40,
                  backgroundColor: theme.colorScheme.primary,
                  child: Text(
                    p.firstName.isEmpty
                        ? '?'
                        : p.firstName.characters.first.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A1A2E),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
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
