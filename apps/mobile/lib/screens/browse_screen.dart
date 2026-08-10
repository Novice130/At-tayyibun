import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api_exception.dart';
import '../core/constants.dart';
import '../models/profile.dart';
import '../providers.dart';
import '../repositories/profiles_repository.dart';
import '../widgets/profile_avatar.dart';
import '../widgets/states.dart';

class BrowseScreen extends ConsumerStatefulWidget {
  const BrowseScreen({super.key});

  @override
  ConsumerState<BrowseScreen> createState() => _BrowseScreenState();
}

class _BrowseScreenState extends ConsumerState<BrowseScreen> {
  final _scroll = ScrollController();
  final _items = <ProfileSummary>[];

  BrowseFilters _filters = const BrowseFilters();
  int _page = 1;
  int _pages = 1;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _bootstrap();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  /// Derive the opposite-gender filter from the signed-in user's own profile,
  /// matching the website's behaviour.
  Future<void> _bootstrap() async {
    try {
      final me = await ref.read(profilesRepositoryProvider).me();
      final gender = me.profile?.gender;
      final opposite = switch (gender) {
        'MALE' => 'FEMALE',
        'FEMALE' => 'MALE',
        _ => null,
      };
      _filters = _filters.copyWith(gender: opposite);
    } catch (_) {
      // No profile yet — fall through and show everyone.
    }
    await _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
      });
    }

    try {
      final result = await ref
          .read(profilesRepositoryProvider)
          .browse(filters: _filters, page: reset ? 1 : _page);
      if (!mounted) return;
      setState(() {
        if (reset) _items.clear();
        _items.addAll(result.items);
        _page = result.page;
        _pages = result.pages;
        _loading = false;
        _loadingMore = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  void _onScroll() {
    final atEnd = _scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 400;
    if (atEnd && !_loadingMore && !_loading && _page < _pages) {
      setState(() {
        _loadingMore = true;
        _page += 1;
      });
      _load();
    }
  }

  Future<void> _openFilters() async {
    final result = await showModalBottomSheet<BrowseFilters>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _FilterSheet(initial: _filters),
    );
    if (result != null) {
      _filters = result;
      await _load(reset: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Browse'),
        actions: [
          IconButton(
            onPressed: _openFilters,
            icon: const Icon(Icons.tune),
            tooltip: 'Filters',
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            const _ActiveRequestBanner(),
            Expanded(child: _buildBody()),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const LoadingView();
    if (_error != null) {
      return ErrorView(message: _error!, onRetry: () => _load(reset: true));
    }
    if (_items.isEmpty) {
      return EmptyView(
        icon: Icons.search_off,
        title: 'No profiles found',
        message: 'Try widening your filters.',
        action: OutlinedButton(
          onPressed: () {
            _filters = BrowseFilters(gender: _filters.gender);
            _load(reset: true);
          },
          child: const Text('Clear filters'),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: GridView.builder(
        controller: _scroll,
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 220,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.68,
        ),
        itemCount: _items.length + (_page < _pages ? 1 : 0),
        itemBuilder: (context, i) {
          if (i >= _items.length) {
            return const Center(child: CircularProgressIndicator());
          }
          return _ProfileCard(profile: _items[i]);
        },
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.profile});

  final ProfileSummary profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => context.push('/profiles/${profile.publicId}'),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AspectRatio(
                  aspectRatio: 1,
                  child: ProfileAvatar(
                    url: profile.avatarUrl,
                    fallbackLabel: profile.displayName,
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                profile.isAnonymous
                    ? '${profile.displayName} · ${profile.age}'
                    : '${profile.displayName}, ${profile.age}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontFamily: profile.isAnonymous ? 'monospace' : null,
                ),
              ),
              Text(
                profile.ethnicity,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.primary),
              ),
              if (profile.location.isNotEmpty)
                Text(
                  profile.location,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shows the one outstanding request and offers to cancel it. Browsing stays
/// fully open while a request is pending — only sending a new one is blocked.
class _ActiveRequestBanner extends ConsumerWidget {
  const _ActiveRequestBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = ref.watch(activeRequestProvider);
    return active.maybeWhen(
      data: (request) {
        if (request == null) return const SizedBox.shrink();
        final theme = Theme.of(context);
        final name = request.counterpart?.displayName ?? 'someone';
        return Container(
          margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: theme.colorScheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: theme.colorScheme.primary.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              Icon(Icons.lock_clock, size: 18, color: theme.colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Pending request for $name. Cancel it to request someone else.',
                  style: theme.textTheme.bodySmall,
                ),
              ),
              TextButton(
                onPressed: () async {
                  try {
                    await ref
                        .read(requestsRepositoryProvider)
                        .cancel(request.id);
                    ref.invalidate(activeRequestProvider);
                    ref.invalidate(outgoingRequestsProvider);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Request cancelled.')),
                      );
                    }
                  } on ApiException catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.message)),
                      );
                    }
                  }
                },
                child: const Text('Cancel'),
              ),
            ],
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.initial});

  final BrowseFilters initial;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String? _ethnicity = widget.initial.ethnicity;
  late RangeValues _age = RangeValues(
    (widget.initial.minAge ?? 18).toDouble(),
    (widget.initial.maxAge ?? 60).toDouble(),
  );

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Filters', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 20),
            DropdownButtonFormField<String?>(
              initialValue: _ethnicity,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Ethnicity'),
              items: [
                const DropdownMenuItem(value: null, child: Text('Any')),
                ...kEthnicities.map(
                  (e) => DropdownMenuItem(value: e, child: Text(e)),
                ),
              ],
              onChanged: (v) => setState(() => _ethnicity = v),
            ),
            const SizedBox(height: 20),
            Text('Age: ${_age.start.round()} – ${_age.end.round()}'),
            RangeSlider(
              values: _age,
              min: 18,
              max: 80,
              divisions: 62,
              labels: RangeLabels(
                '${_age.start.round()}',
                '${_age.end.round()}',
              ),
              onChanged: (v) => setState(() => _age = v),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.pop(
                context,
                widget.initial.copyWith(
                  ethnicity: _ethnicity,
                  minAge: _age.start.round(),
                  maxAge: _age.end.round(),
                ),
              ),
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }
}
