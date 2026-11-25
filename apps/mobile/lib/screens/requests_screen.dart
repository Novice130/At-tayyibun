import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api_exception.dart';
import '../core/marital.dart';
import '../models/info_request.dart';
import '../providers.dart';
import '../widgets/states.dart';

class RequestsScreen extends ConsumerStatefulWidget {
  const RequestsScreen({super.key});

  @override
  ConsumerState<RequestsScreen> createState() => _RequestsScreenState();
}

class _RequestsScreenState extends ConsumerState<RequestsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  String? _busyId;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  void _refreshAll() {
    ref.invalidate(incomingRequestsProvider);
    ref.invalidate(outgoingRequestsProvider);
    ref.invalidate(activeRequestProvider);
  }

  /// Mirrors the API: the signup form pre-fills the phone with a country code.
  bool _hasGuardianContact(Map<String, dynamic>? biodata) {
    final phone = biodata?['guardianPhone'];
    final email = biodata?['guardianEmail'];
    final digits = phone is String ? phone.replaceAll(RegExp(r'\D'), '') : '';
    return digits.length >= 7 || (email is String && email.trim().isNotEmpty);
  }

  Future<void> _accept(InfoRequest request) async {
    var guardianSaved = false;
    try {
      final me = await ref.read(myProfileProvider.future);
      guardianSaved = _hasGuardianContact(me.profile?.biodata);
    } on ApiException {
      // Unknown: the own-contact choice still works, and the API re-checks.
    }
    if (!mounted) return;

    final source = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Whose contact should they receive?'),
        content: Text(
          guardianSaved
              ? 'They can view it once. After that, it cannot be taken back.'
              : 'They can view it once. After that, it cannot be taken back.\n\n'
                  'No guardian contact is saved on your profile.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: guardianSaved ? () => Navigator.pop(ctx, 'GUARDIAN') : null,
            child: const Text("My guardian's"),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, 'SELF'),
            child: const Text('My own'),
          ),
        ],
      ),
    );
    if (source != null) await _respond(request, true, shareSource: source);
  }

  Future<void> _resend(InfoRequest request) async {
    final publicId = request.counterpart?.publicId;
    if (publicId == null || publicId.isEmpty) return;
    setState(() => _busyId = request.id);
    try {
      await ref.read(requestsRepositoryProvider).send(publicId);
      _refreshAll();
      _toast('Request sent again.');
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _revealContact(InfoRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('View contact details?'),
        content: const Text(
          'These details can be viewed once. Have somewhere ready to save them.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Not yet'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Show contact details'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyId = request.id);
    try {
      final contact =
          await ref.read(requestsRepositoryProvider).revealContact(request.id);
      _refreshAll();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: const Text('Contact details'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Please save these now. They will not be shown again.'),
              const SizedBox(height: 12),
              if (contact.name != null) SelectableText(contact.name!),
              if (contact.phone != null) SelectableText(contact.phone!),
              if (contact.email != null) SelectableText(contact.email!),
            ],
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Done'),
            ),
          ],
        ),
      );
    } on ApiException catch (e) {
      _refreshAll();
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _respond(InfoRequest request, bool approved, {String? shareSource}) async {
    setState(() => _busyId = request.id);
    try {
      await ref
          .read(requestsRepositoryProvider)
          .respond(request.id, approved: approved, shareSource: shareSource);
      _refreshAll();
      _toast(approved
          ? 'Request accepted. They can now view the contact you chose, once.'
          : 'Request declined.');
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _cancel(InfoRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel request?'),
        content: Text(
          'Your request to ${request.counterpart?.displayName ?? 'this profile'} '
          'will be withdrawn and they will no longer see it.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep it'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel request'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyId = request.id);
    try {
      await ref.read(requestsRepositoryProvider).cancel(request.id);
      _refreshAll();
      _toast('Request cancelled. You can now send a new one.');
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _blockParty(InfoRequest request) async {
    final party = request.counterpart;
    if (party == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Block this person?'),
        content: Text(
          '${party.displayName} will disappear from your browse and neither '
          'of you will see the other again.',
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

    try {
      await ref.read(moderationRepositoryProvider).block(party.publicId);
      _refreshAll();
      // Browse filters against this list, so it has to be refetched here too.
      ref.invalidate(blockedAccountsProvider);
      _toast('${party.displayName} has been blocked.');
    } on ApiException catch (e) {
      _toast(e.message);
    }
  }

  Future<void> _reportParty(InfoRequest request) async {
    final party = request.counterpart;
    if (party == null) return;

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
              Text('Report ${party.displayName}',
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
                onPressed: reason == null ? null : () => Navigator.pop(ctx, true),
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

    try {
      await ref.read(moderationRepositoryProvider).report(
            party.publicId,
            reason: chosen,
            details: details.text,
          );
      _toast('Report submitted. Our team reviews reports within 24 hours.');
    } on ApiException catch (e) {
      _toast(e.message);
    } finally {
      details.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final incoming = ref.watch(incomingRequestsProvider);
    final outgoing = ref.watch(outgoingRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Requests'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'Incoming'), Tab(text: 'Outgoing')],
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabs,
          children: [
            _RequestList(
              async: incoming,
              onRefresh: () async => ref.invalidate(incomingRequestsProvider),
              emptyIcon: Icons.inbox_outlined,
              emptyTitle: 'No incoming requests',
              emptyMessage:
                  'When someone wants to connect with you, their request appears here.',
              builder: (request) => _IncomingTile(
                request: request,
                busy: _busyId == request.id,
                onAccept: () => _accept(request),
                onDecline: () => _respond(request, false),
                onBlock: () => _blockParty(request),
                onReport: () => _reportParty(request),
              ),
            ),
            _RequestList(
              async: outgoing,
              onRefresh: () async => ref.invalidate(outgoingRequestsProvider),
              emptyIcon: Icons.send_outlined,
              emptyTitle: 'No outgoing requests',
              emptyMessage:
                  'Browse profiles and send a contact request to get started.',
              emptyAction: FilledButton(
                onPressed: () => context.go('/browse'),
                child: const Text('Browse Profiles'),
              ),
              builder: (request) => _OutgoingTile(
                request: request,
                busy: _busyId == request.id,
                onCancel: () => _cancel(request),
                onRevealContact: () => _revealContact(request),
                onResend: () => _resend(request),
                onBlock: () => _blockParty(request),
                onReport: () => _reportParty(request),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RequestList extends StatelessWidget {
  const _RequestList({
    required this.async,
    required this.onRefresh,
    required this.builder,
    required this.emptyIcon,
    required this.emptyTitle,
    required this.emptyMessage,
    this.emptyAction,
  });

  final AsyncValue<List<InfoRequest>> async;
  final Future<void> Function() onRefresh;
  final Widget Function(InfoRequest) builder;
  final IconData emptyIcon;
  final String emptyTitle;
  final String emptyMessage;
  final Widget? emptyAction;

  @override
  Widget build(BuildContext context) {
    return async.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(
        message: e is ApiException
            ? e.message
            : 'Something went wrong. Please try again.',
        onRetry: onRefresh,
      ),
      data: (items) {
        if (items.isEmpty) {
          return RefreshIndicator(
            onRefresh: onRefresh,
            child: ListView(
              children: [
                SizedBox(
                  height: MediaQuery.of(context).size.height * 0.6,
                  child: EmptyView(
                    icon: emptyIcon,
                    title: emptyTitle,
                    message: emptyMessage,
                    action: emptyAction,
                  ),
                ),
              ],
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (_, i) => builder(items[i]),
          ),
        );
      },
    );
  }
}

class _RequestCardShell extends StatelessWidget {
  const _RequestCardShell({
    required this.request,
    required this.footer,
    this.onBlock,
    this.onReport,
    this.showMarital = false,
  });

  final InfoRequest request;
  final Widget footer;
  final VoidCallback? onBlock;
  final VoidCallback? onReport;

  /// Shown on incoming cards only; the API sends these fields only to the receiver.
  final bool showMarital;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final party = request.counterpart;
    final name = party?.displayName ?? 'Unknown';
    final maritalLine = showMarital && party != null
        ? formatMaritalLine(
            party.maritalStatus, party.hasChildren, party.childrenCount)
        : null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: theme.colorScheme.primary,
                  child: Text(
                    name.isEmpty ? '?' : name.characters.first.toUpperCase(),
                    style: TextStyle(
                      color: theme.colorScheme.onPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(name,
                              style: theme.textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                          StatusBadge(status: request.status),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 12,
                        runSpacing: 2,
                        children: [
                          if (party?.ethnicity != null)
                            Text(party!.ethnicity!,
                                style: theme.textTheme.bodySmall),
                          if (party != null && party.location.isNotEmpty)
                            Text(party.location,
                                style: theme.textTheme.bodySmall),
                          Text(timeAgo(request.createdAt),
                              style: theme.textTheme.bodySmall),
                        ],
                      ),
                      if (maritalLine != null) ...[
                        const SizedBox(height: 4),
                        Text(maritalLine, style: theme.textTheme.bodySmall),
                      ],
                    ],
                  ),
                ),
                if (onBlock != null || onReport != null)
                  PopupMenuButton<String>(
                    tooltip: 'More',
                    icon: const Icon(Icons.more_vert),
                    onSelected: (value) {
                      if (value == 'block') onBlock?.call();
                      if (value == 'report') onReport?.call();
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
            footer,
          ],
        ),
      ),
    );
  }
}

class _IncomingTile extends StatelessWidget {
  const _IncomingTile({
    required this.request,
    required this.busy,
    required this.onAccept,
    required this.onDecline,
    required this.onBlock,
    required this.onReport,
  });

  final InfoRequest request;
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final VoidCallback onBlock;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _RequestCardShell(
      request: request,
      onBlock: onBlock,
      onReport: onReport,
      showMarital: true,
      footer: request.isPending
          ? Padding(
              padding: const EdgeInsets.only(top: 16),
              // Full-width stacked buttons: the website's side-by-side row left
              // almost no room for the name on a narrow screen.
              child: Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: busy ? null : onAccept,
                      icon: busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.check, size: 18),
                      label: const Text('Accept'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: busy ? null : onDecline,
                      icon: const Icon(Icons.close, size: 18),
                      label: const Text('Decline'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: theme.colorScheme.error,
                      ),
                    ),
                  ),
                ],
              ),
            )
          : const SizedBox.shrink(),
    );
  }
}

class _OutgoingTile extends StatelessWidget {
  const _OutgoingTile({
    required this.request,
    required this.busy,
    required this.onCancel,
    required this.onRevealContact,
    required this.onResend,
    required this.onBlock,
    required this.onReport,
  });

  final InfoRequest request;
  final bool busy;
  final VoidCallback onCancel;
  final VoidCallback onRevealContact;
  final VoidCallback onResend;
  final VoidCallback onBlock;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurface.withValues(alpha: 0.65);

    final status = switch (request.status) {
      'PENDING' => 'Waiting for response…',
      'APPROVED' => switch (request.contactState) {
          'AVAILABLE' => 'Accepted. You can view the contact details once.',
          'VIEWED' => 'You have viewed these contact details.',
          'EXPIRED' =>
            'The contact link expired. You can send a new request from their profile.',
          _ => 'Contact info has been sent to your email.',
        },
      'DENIED' => 'You can now send a request to another profile.',
      _ => 'This request expired.',
    };

    return _RequestCardShell(
      request: request,
      onBlock: onBlock,
      onReport: onReport,
      footer: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(status, style: theme.textTheme.bodySmall?.copyWith(color: muted)),
            if (request.status == 'APPROVED' && request.contactState == 'AVAILABLE') ...[
              const SizedBox(height: 8),
              FilledButton(
                onPressed: busy ? null : onRevealContact,
                child: const Text('View contact details'),
              ),
            ],
            if (request.status == 'EXPIRED') ...[
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: busy ? null : onResend,
                child: const Text('Send again'),
              ),
            ],
            if (request.isPending) ...[
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: busy ? null : onCancel,
                icon: busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.close, size: 18),
                label: const Text('Cancel request'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: theme.colorScheme.error,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
