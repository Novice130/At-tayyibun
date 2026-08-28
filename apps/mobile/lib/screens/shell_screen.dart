import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers.dart';

/// Bottom-nav shell. The Requests tab carries a badge for pending incoming
/// requests — the thing the client specifically asked for on the web app.
class ShellScreen extends ConsumerWidget {
  const ShellScreen({super.key, required this.child});

  final Widget child;

  static const _tabs = ['/browse', '/requests', '/profile'];

  int _indexFor(String location) {
    final i = _tabs.indexWhere((t) => location.startsWith(t));
    return i < 0 ? 0 : i;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).uri.path;
    final index = _indexFor(location);
    final pending = ref.watch(pendingIncomingCountProvider);

    return Scaffold(
      extendBody: true,
      body: child,
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: NavigationBar(
            backgroundColor: Theme.of(context).colorScheme.surface.withValues(alpha: 0.65),
            elevation: 0,
            indicatorColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
            selectedIndex: index,
            onDestinationSelected: (i) {
              if (i != index) {
                // Light tactile feedback on tab switch — an iOS-native touch.
                HapticFeedback.selectionClick();
                context.go(_tabs[i]);
              }
            },
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.search_outlined),
                selectedIcon: Icon(Icons.search),
                label: 'Browse',
              ),
              NavigationDestination(
                icon: Badge.count(
                  count: pending,
                  isLabelVisible: pending > 0,
                  child: const Icon(Icons.inbox_outlined),
                ),
                selectedIcon: Badge.count(
                  count: pending,
                  isLabelVisible: pending > 0,
                  child: const Icon(Icons.inbox),
                ),
                label: 'Requests',
              ),
              const NavigationDestination(
                icon: Icon(Icons.person_outline),
                selectedIcon: Icon(Icons.person),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

