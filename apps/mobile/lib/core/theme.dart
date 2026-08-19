import 'package:flutter/material.dart';

/// Palette lifted verbatim from the web app's design tokens
/// (apps/web/src/app/globals.css) so the two clients look like one product.
abstract class BrandColors {
  static const gold500 = Color(0xFFD4AF37);
  static const gold400 = Color(0xFFE8C547);

  // Light
  static const lightBg = Color(0xFFFAF8F5);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSurfaceHover = Color(0xFFF5F2ED);
  static const lightText = Color(0xFF1A1A2E);
  static const lightTextSecondary = Color(0xFF6B6B7B);
  static const lightBorder = Color(0xFFE8E4DD);

  // Dark
  static const darkBg = Color(0xFF0F0F1A);
  static const darkSurface = Color(0xFF1A1A2E);
  static const darkSurfaceHover = Color(0xFF252540);
  static const darkText = Color(0xFFFFFFFF);
  static const darkTextSecondary = Color(0xFFA0A0B8);
  static const darkBorder = Color(0x1AFFFFFF);
}

ThemeData buildLightTheme() => _build(
      brightness: Brightness.light,
      bg: BrandColors.lightBg,
      surface: BrandColors.lightSurface,
      surfaceHover: BrandColors.lightSurfaceHover,
      text: BrandColors.lightText,
      textSecondary: BrandColors.lightTextSecondary,
      border: BrandColors.lightBorder,
    );

ThemeData buildDarkTheme() => _build(
      brightness: Brightness.dark,
      bg: BrandColors.darkBg,
      surface: BrandColors.darkSurface,
      surfaceHover: BrandColors.darkSurfaceHover,
      text: BrandColors.darkText,
      textSecondary: BrandColors.darkTextSecondary,
      border: BrandColors.darkBorder,
    );

ThemeData _build({
  required Brightness brightness,
  required Color bg,
  required Color surface,
  required Color surfaceHover,
  required Color text,
  required Color textSecondary,
  required Color border,
}) {
  final scheme = ColorScheme(
    brightness: brightness,
    primary: BrandColors.gold500,
    onPrimary: const Color(0xFF1A1A2E),
    secondary: BrandColors.gold400,
    onSecondary: const Color(0xFF1A1A2E),
    error: const Color(0xFFE5484D),
    onError: Colors.white,
    surface: surface,
    onSurface: text,
    surfaceContainerHighest: surfaceHover,
    outline: border,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      surfaceTintColor: Colors.transparent,
      foregroundColor: text,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: text,
        fontSize: 20,
        fontWeight: FontWeight.w700,
      ),
    ),
    cardTheme: CardThemeData(
      color: surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: BrandColors.gold500, width: 1.6),
      ),
      labelStyle: TextStyle(color: textSecondary),
      hintStyle: TextStyle(color: textSecondary),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: BrandColors.gold500,
        foregroundColor: const Color(0xFF1A1A2E),
        // 48dp keeps every primary action above the 44dp touch-target floor.
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: text,
        minimumSize: const Size.fromHeight(48),
        side: BorderSide(color: border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: BrandColors.gold500),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: surface,
      side: BorderSide(color: border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    dividerTheme: DividerThemeData(color: border, thickness: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: surfaceHover,
      contentTextStyle: TextStyle(color: text),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    // Pass the real platform so iOS gets SF-metric text styles instead of
    // Roboto metrics (previously hardcoded to Android).
    textTheme: Typography.material2021().black.apply(
          bodyColor: text,
          displayColor: text,
        ),
  );
}
