import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api_exception.dart';
import '../models/info_request.dart';
import '../models/profile.dart';
import '../providers.dart';
import '../widgets/profile_avatar.dart';
import '../widgets/states.dart';

class ProfileDetailScreen extends ConsumerStatefulWidget {
  const ProfileDetailScreen({super.key, required this.publicId});

  final String publicId;

  @override
  ConsumerState<ProfileDetailScreen> createState() =>
      _ProfileDetailScreenState();
}

class _ProfileDetailScreenState extends ConsumerState<ProfileDetailScreen> {
  ProfileSummary? _profile;
  InfoRequest? _active;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    // _error has to be cleared here, not only on success: build() returns
    // ErrorView whenever _error != null, so "Try again" fetched fine and then
    // kept showing the old error until the route was popped.
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile =
          await ref.read(profilesRepositoryProvider).byPublicId(widget.publicId);
      final active = await ref.read(requestsRepositoryProvider).active();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _active = active;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      // ApiClient._send only converts DioException, so anything thrown while
      // decoding the payload (a missing field in fromJson) escaped as a
      // TypeError and left the spinner running forever.
      if (!mounted) return;
      setState(() {
        _error = 'Something went wrong. Please try again.';
        _loading = false;
      });
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _sendRequest() async {
    setState(() => _busy = true);
    HapticFeedback.mediumImpact();
    try {
      await ref.read(requestsRepositoryProvider).send(widget.publicId);
      ref.invalidate(activeRequestProvider);
      ref.invalidate(outgoingRequestsProvider);
      await _load();
      _toast('Request sent. You will get an email when they respond.');
    } on ApiException catch (e) {
      if (e.isConflict) {
        await _load();
        _toast('You already have a pending request. Cancel it to send another.');
      } else {
        _toast(e.message);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancelRequest() async {
    final id = _active?.id;
    if (id == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(requestsRepositoryProvider).cancel(id);
      ref.invalidate(activeRequestProvider);
      ref.invalidate(outgoingRequestsProvider);
      await _load();
      _toast('Request cancelled. You can now send a new one.');
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _block() async {
    final p = _profile;
    if (p == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Block this person?'),
        content: Text(
          '${p.displayName} will disappear from your browse and neither of '
          'you will see the other again. Any pending request between you is '
          'cancelled.',
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
            child: const Text('Block'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(moderationRepositoryProvider)
          .block(widget.publicId);
      if (!mounted) return;
      // Grab the messenger BEFORE popping: it lives at the MaterialApp level
      // and survives this route, whereas _toast's `mounted` check fails once
      // the pop has torn this widget down, swallowing the snackbar.
      final messenger = ScaffoldMessenger.of(context);
      ref.invalidate(blockedAccountsProvider);
      // The blocked person must visibly disappear from browse.
      context.pop();
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text('${p.displayName} has been blocked.')),
        );
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _report() async {
    final p = _profile;
    if (p == null) return;

    const reasons = <(String, String)>[
      ('FAKE_PROFILE', 'Fake profile'),
      ('INAPPROPRIATE_CONTENT', 'Inappropriate content'),
      ('HARASSMENT', 'Harassment'),
      ('SPAM_OR_SCAM', 'Spam or scam'),
      ('UNDERAGE', 'Underage user'),
      ('OTHER', 'Other'),
    ];

    String? reason;
    final details = TextEditingController();

    final reported = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Report ${p.displayName}',
                  style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 12),
              RadioGroup<String>(
                groupValue: reason,
                onChanged: (v) => setSheetState(() => reason = v),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (code, label) in reasons)
                      RadioListTile<String>(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        title: Text(label),
                        value: code,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: details,
                maxLength: 500,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Details (optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: reason == null
                    ? null
                    : () => Navigator.pop(ctx, true),
                child: const Text('Submit Report'),
              ),
            ],
          ),
        ),
      ),
    );

    final chosen = reason;
    if (reported != true || chosen == null) {
      details.dispose();
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(moderationRepositoryProvider).report(
            widget.publicId,
            reason: chosen,
            details: details.text,
          );
      if (!mounted) return;
      final alsoBlock = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Report submitted'),
          content: const Text(
              'Thank you — our team reviews reports within 24 hours. '
              'Would you also like to block this person?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('No thanks'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Also block'),
            ),
          ],
        ),
      );
      if (alsoBlock == true) {
        await _block();
      }
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      details.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_loading) {
      return const Scaffold(body: LoadingView());
    }
    if (_error != null || _profile == null) {
      return Scaffold(
        appBar: AppBar(),
        body: ErrorView(message: _error ?? 'Profile not found', onRetry: _load),
      );
    }

    final p = _profile!;
    final pendingForThis = _active?.counterpart?.publicId == widget.publicId;
    final hasOtherPending = _active != null && !pendingForThis;

    return Scaffold(
      appBar: AppBar(
        title: Text(p.displayName),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'More',
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              if (value == 'block') {
                _block();
              } else if (value == 'report') {
                _report();
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(
                value: 'block',
                child: Row(
                  children: [
                    Icon(Icons.block, size: 20),
                    SizedBox(width: 12),
                    Text('Block'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'report',
                child: Row(
                  children: [
                    Icon(Icons.flag_outlined, size: 20),
                    SizedBox(width: 12),
                    Text('Report'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Center(
              child: SizedBox(
                width: 140,
                height: 140,
                child: ProfileAvatar(
                  url: p.avatarUrl,
                  fallbackLabel: p.displayName,
                  size: 140,
                  borderRadius: BorderRadius.circular(70),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              p.isAnonymous
                  ? '${p.displayName} · ${p.age}'
                  : '${p.displayName}, ${p.age}',
              textAlign: TextAlign.center,
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 16,
              runSpacing: 8,
              children: [
                _Meta(
                  icon: Icons.person_outline,
                  label: p.gender == 'MALE' ? 'Brother' : 'Sister',
                ),
                _Meta(icon: Icons.public, label: p.ethnicity),
                if (p.location.isNotEmpty)
                  _Meta(icon: Icons.location_on_outlined, label: p.location),
              ],
            ),
            if (p.bio != null && p.bio!.isNotEmpty) ...[
              const SizedBox(height: 24),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('About', style: theme.textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Text(p.bio!, style: theme.textTheme.bodyMedium),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.lock_outline,
                            size: 18, color: theme.colorScheme.primary),
                        const SizedBox(width: 8),
                        Text('Contact Information',
                            style: theme.textTheme.titleMedium),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (pendingForThis)
                      ..._pendingForThis(theme, p)
                    else if (hasOtherPending)
                      ..._lockedByOther(theme, p)
                    else
                      ..._canRequest(theme, p),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _pendingForThis(ThemeData theme, ProfileSummary p) => [
        Text(
          'Your contact request has been sent to ${p.displayName}. '
          "You'll receive an email when they respond.",
          style: theme.textTheme.bodyMedium,
        ),
        const SizedBox(height: 8),
        Text(
          'You can keep browsing while you wait. To request someone else '
          'instead, cancel this request first.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurface.withValues(alpha: 0.7),
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _busy ? null : _cancelRequest,
          icon: const Icon(Icons.close),
          label: const Text('Cancel Request'),
          style: OutlinedButton.styleFrom(
            foregroundColor: theme.colorScheme.error,
          ),
        ),
      ];

  List<Widget> _lockedByOther(ThemeData theme, ProfileSummary p) => [
        Text(
          'You already have a pending request for '
          '${_active?.counterpart?.displayName ?? 'another profile'}. '
          'Cancel it to request ${p.displayName} instead.',
          style: theme.textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _busy ? null : _cancelRequest,
          icon: const Icon(Icons.close),
          label: const Text('Cancel Pending Request'),
          style: OutlinedButton.styleFrom(
            foregroundColor: theme.colorScheme.error,
          ),
        ),
      ];

  List<Widget> _canRequest(ThemeData theme, ProfileSummary p) => [
        Text(
          'Contact details are private. Send a request and ${p.displayName} '
          'will decide whether to share their phone number and email with you.',
          style: theme.textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _busy ? null : _sendRequest,
          icon: _busy
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.send),
          label: const Text('Request Contact Info'),
        ),
        const SizedBox(height: 8),
        Text(
          'You can only have one active request at a time — you can cancel it '
          'whenever you like.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
          ),
        ),
      ];
}

class _Meta extends StatelessWidget {
  const _Meta({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: theme.colorScheme.onSurface.withValues(alpha: 0.7)),
        const SizedBox(width: 6),
        Text(label, style: theme.textTheme.bodyMedium),
      ],
    );
  }
}
