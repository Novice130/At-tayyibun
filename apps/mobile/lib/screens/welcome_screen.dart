import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final size = MediaQuery.sizeOf(context);

    final bgColor = isDark ? BrandColors.darkBg : BrandColors.lightBg;
    final headingColor = isDark ? BrandColors.darkText : BrandColors.lightText;
    final textSecondary =
        isDark ? BrandColors.darkTextSecondary : BrandColors.lightTextSecondary;

    return Scaffold(
      backgroundColor: bgColor,
      body: Stack(
        children: [
          // 1. HERO BACKGROUND IMAGE (Couple overlooking coastal sunset)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: size.height * 0.48,
            child: ClipRect(
              child: Transform.scale(
                scale: 1.25,
                alignment: const Alignment(0.0, -0.3),
                child: Image.asset(
                  isDark
                      ? 'assets/hero-couple-sunset.jpg'
                      : 'assets/hero-couple-sunset-light.jpg',
                  fit: BoxFit.cover,
                  alignment: const Alignment(0.0, -0.2),
                ),
              ),
            ),
          ),

          // 2. SEAMLESS GRADIENT BLEND
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: size.height * 0.52,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.0, 0.2, 0.45, 0.75, 1.0],
                  colors: [
                    bgColor.withValues(alpha: 0.1),
                    bgColor.withValues(alpha: 0.35),
                    bgColor.withValues(alpha: 0.75),
                    bgColor.withValues(alpha: 0.95),
                    bgColor,
                  ],
                ),
              ),
            ),
          ),

          // 3. MAIN SCROLLABLE CONTENT
          SafeArea(
            child: Column(
              children: [
                // Top Brand Header Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: BrandColors.gold500.withValues(alpha: 0.15),
                          border: Border.all(
                            color: BrandColors.gold500.withValues(alpha: 0.5),
                            width: 1,
                          ),
                        ),
                        child: Image.asset('assets/logo.png', fit: BoxFit.contain),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'At-Tayyibun',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                          color: BrandColors.gold500,
                        ),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: () => context.push('/login'),
                        style: TextButton.styleFrom(
                          foregroundColor: BrandColors.gold500,
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                        child: const Text('Sign In'),
                      ),
                    ],
                  ),
                ),

                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 36),

                        // Quranic Ayah Card with Gold Left Accent (Exact Web Replica)
                        Card(
                          elevation: 2,
                          color: isDark
                              ? const Color(0xFF1E1E34)
                              : Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: isDark
                                  ? BrandColors.darkBorder
                                  : BrandColors.lightBorder,
                            ),
                          ),
                          child: Stack(
                            children: [
                              Positioned(
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 4,
                                child: Container(
                                  decoration: const BoxDecoration(
                                    color: BrandColors.gold500,
                                    borderRadius: BorderRadius.horizontal(
                                      left: Radius.circular(12),
                                    ),
                                  ),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'الْطَّيِّبَاتُ لِلْطَّيِّبِينَ وَالْطَّيِّبُونَ لِلْطَّيِّبَاتِ',
                                      textDirection: TextDirection.rtl,
                                      style: TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFFC59A27),
                                        height: 1.4,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      '“Good women are for good men, and good men are for good women.”',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontStyle: FontStyle.italic,
                                        fontWeight: FontWeight.w500,
                                        color: textSecondary,
                                        height: 1.35,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '— Surah An-Nur (24:26)',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: textSecondary.withValues(alpha: 0.75),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 24),

                        // Hero Headline (Match Web: "Find Your Half, Preserving Sacred Values")
                        RichText(
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              height: 1.15,
                              color: headingColor,
                              letterSpacing: -0.5,
                            ),
                            children: const [
                              TextSpan(text: 'Find Your '),
                              TextSpan(
                                text: 'Half,',
                                style: TextStyle(
                                  color: BrandColors.gold500,
                                  fontStyle: FontStyle.italic,
                                  fontFamily: 'serif',
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              TextSpan(text: '\nPreserving Sacred Values'),
                            ],
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Hero Subtitle
                        Text(
                          'At-Tayyibun is a privacy-first matrimony platform designed for Muslims in the United States. Parents and guardians create profiles and connect on behalf of their families.',
                          style: TextStyle(
                            fontSize: 14.5,
                            color: textSecondary,
                            height: 1.45,
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Trust Indicators (Privacy-First, Family Involvement, Guardian-Led)
                        Wrap(
                          spacing: 16,
                          runSpacing: 10,
                          children: [
                            _buildTrustBadge(
                              icon: Icons.shield_outlined,
                              label: 'Privacy-First',
                              isDark: isDark,
                            ),
                            _buildTrustBadge(
                              icon: Icons.people_outline_rounded,
                              label: 'Family Involvement',
                              isDark: isDark,
                            ),
                            _buildTrustBadge(
                              icon: Icons.access_time_rounded,
                              label: 'Guardian-Led',
                              isDark: isDark,
                            ),
                          ],
                        ),

                        const SizedBox(height: 28),

                        // CTA Buttons
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
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text('Start Your Journey'),
                              SizedBox(width: 8),
                              Icon(Icons.chevron_right_rounded, size: 20),
                            ],
                          ),
                        ),

                        const SizedBox(height: 12),

                        OutlinedButton(
                          onPressed: () => context.push('/login'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: headingColor,
                            minimumSize: const Size.fromHeight(50),
                            side: BorderSide(
                              color: isDark ? BrandColors.darkBorder : BrandColors.lightBorder,
                              width: 1.5,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            textStyle: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          child: const Text('Sign In to Account'),
                        ),

                        const SizedBox(height: 16),

                        Center(
                          child: Text(
                            'By continuing, you agree to our Terms of Service & Privacy Policy',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 11,
                              color: textSecondary.withValues(alpha: 0.6),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrustBadge({
    required IconData icon,
    required String label,
    required bool isDark,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 16,
          color: BrandColors.gold500,
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: isDark ? const Color(0xFFA0A0B8) : const Color(0xFF6B6B7B),
          ),
        ),
      ],
    );
  }
}
