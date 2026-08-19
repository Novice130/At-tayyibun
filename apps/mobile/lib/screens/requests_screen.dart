import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api_exception.dart';
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

  Future<void> _respond(InfoRequest request, bool approved) async {
    setState(() => _busyId = request.id);
    try {
      await ref
          .read(requestsRepositoryProvider)
          .respond(request.id, approved: approved);
      _refreshAll();
      _toast(approved
          ? 'Request accepted. Your contact details have been emailed to them.'
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
                onAccept: () => _respond(request, true),
                onDecline: () => _respond(request, false),
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
  const _RequestCardShell({required this.request, required this.footer});

  final InfoRequest request;
  final Widget footer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final party = request.counterpart;
    final name = party?.displayName ?? 'Unknown';

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
                    ],
                  ),
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
  });

  final InfoRequest request;
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _RequestCardShell(
      request: request,
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
  });

  final InfoRequest request;
  final bool busy;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.colorScheme.onSurface.withValues(alpha: 0.65);

    final status = switch (request.status) {
      'PENDING' => 'Waiting for response…',
      'APPROVED' => 'Contact info has been sent to your email.',
      'DENIED' => 'You can now send a request to another profile.',
      _ => 'This request expired.',
    };

    return _RequestCardShell(
      request: request,
      footer: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(status, style: theme.textTheme.bodySmall?.copyWith(color: muted)),
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
