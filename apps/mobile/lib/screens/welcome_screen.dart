import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 40,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // --- TOP BRANDING & HERO ---
                    Column(
                      children: [
                        const SizedBox(height: 16),
                        // Logo with ambient aura
                        Container(
                          width: 88,
                          height: 88,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: BrandColors.gold500.withValues(alpha: 0.12),
                            border: Border.all(
                              color: BrandColors.gold500.withValues(alpha: 0.3),
                              width: 1.5,
                            ),
                          ),
                          child: Image.asset(
                            'assets/logo.png',
                            fit: BoxFit.contain,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'At-Tayyibun',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                            color: theme.colorScheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Dignified Halal Matrimony',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: BrandColors.gold500,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 14),
                        // Quranic Subtitle Badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isDark
                                ? BrandColors.darkSurfaceHover
                                : BrandColors.lightSurfaceHover,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isDark
                                  ? BrandColors.darkBorder
                                  : BrandColors.lightBorder,
                            ),
                          ),
                          child: Text(
                            '“Good women are for good men, and good men are for good women”',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontStyle: FontStyle.italic,
                              color: theme.colorScheme.onSurface
                                  .withValues(alpha: 0.75),
                            ),
                          ),
                        ),
                      ],
                    ),

                    // --- PILLARS / VALUE PROPOSITIONS ---
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 28),
                      child: Column(
                        children: [
                          _buildFeatureRow(
                            context: context,
                            icon: Icons.shield_rounded,
                            title: 'Privacy & Guardian First',
                            description:
                                'Curated diaspora anime avatars — no public real photos. Families and Walis integrated with dignity.',
                          ),
                          const SizedBox(height: 18),
                          _buildFeatureRow(
                            context: context,
                            icon: Icons.verified_user_rounded,
                            title: 'Verified Muslim Community',
                            description:
                                'Phone-verified profiles seeking serious marriage, free from casual dating culture.',
                          ),
                          const SizedBox(height: 18),
                          _buildFeatureRow(
                            context: context,
                            icon: Icons.favorite_rounded,
                            title: 'Pure Intentions & Values',
                            description:
                                'Detailed religious practice, halal values, and background alignment for lifelong companionship.',
                          ),
                        ],
                      ),
                    ),

                    // --- BOTTOM CTA BUTTONS ---
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        FilledButton(
                          onPressed: () => context.push('/signup'),
                          style: FilledButton.styleFrom(
                            backgroundColor: BrandColors.gold500,
                            foregroundColor: const Color(0xFF1A1A2E),
                            elevation: 0,
                            minimumSize: const Size.fromHeight(52),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            textStyle: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.2,
                            ),
                          ),
                          child: const Text('Create Account'),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: () => context.push('/login'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: theme.colorScheme.onSurface,
                            minimumSize: const Size.fromHeight(52),
                            side: BorderSide(
                              color: isDark
                                  ? BrandColors.darkBorder
                                  : BrandColors.lightBorder,
                              width: 1.5,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            textStyle: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          child: const Text('Sign In'),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'By continuing, you agree to our Terms of Service & Privacy Policy',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontSize: 11,
                            color: theme.colorScheme.onSurface
                                .withValues(alpha: 0.5),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildFeatureRow({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String description,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? BrandColors.darkSurface : BrandColors.lightSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? BrandColors.darkBorder : BrandColors.lightBorder,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: BrandColors.gold500.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              size: 20,
              color: BrandColors.gold500,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  description,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.65),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
