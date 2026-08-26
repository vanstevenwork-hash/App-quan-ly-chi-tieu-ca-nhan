import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Design tokens ported from the web client (tailwind.config.ts + globals.css).
/// Change a value here and it flows through the whole app, same as the web app's
/// `brand` / `surface` tokens.
class AppColors {
  // Brand (violet) — bg-brand / text-brand on web
  static const brand = Color(0xFF36255C);
  static const brandDark = Color(0xFF2B1E4A);
  static const brandLight = Color(0xFFD2C3F6);

  // Primary purple (#6C63FF) + the login/gradient family
  static const primary = Color(0xFF6C63FF);
  static const gradientStart = Color(0xFF6C63FF);
  static const gradientMid = Color(0xFF8E7CFF);
  static const gradientEnd = Color(0xFFC084FC);

  // Login backdrop gradient (deep violet → lavender)
  static const loginTop = Color(0xFF0B0828);
  static const loginMid = Color(0xFF4A3A9E);
  static const loginBottom = Color(0xFF6F5BC9);

  // Page / surface
  static const pageLight = Color(0xFFF8F9FF);
  static const surface = Color(0xFF121829); // dark card
  static const surfaceDeep = Color(0xFF0B0F1E); // dark page

  // Semantic
  static const income = Color(0xFF10B981);
  static const incomeLight = Color(0xFF34D399);
  static const expense = Color(0xFFEF4444);
  static const expenseLight = Color(0xFFF87171);
  static const gold = Color(0xFFF59E0B);
  static const blue = Color(0xFF3B82F6);

  // Slate text scale
  static const slate900 = Color(0xFF0F172A);
  static const slate800 = Color(0xFF1E293B);
  static const slate700 = Color(0xFF334155);
  static const slate500 = Color(0xFF64748B);
  static const slate400 = Color(0xFF94A3B8);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate100 = Color(0xFFF1F5F9);
}

/// Soft purple-tinted elevation, matching the web's
/// `shadow-[0_4px_20px_-2px_rgba(139,92,246,0.12)]`.
final List<BoxShadow> kCardShadow = [
  BoxShadow(color: const Color(0xFF8B5CF6).withValues(alpha: 0.12), blurRadius: 22, spreadRadius: -4, offset: const Offset(0, 8)),
  BoxShadow(color: Colors.black.withValues(alpha: 0.025), blurRadius: 6, offset: const Offset(0, 2)),
];

class AppTheme {
  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.pageLight,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        brightness: Brightness.light,
      ),
    );
    return base.copyWith(
      textTheme: GoogleFonts.manropeTextTheme(base.textTheme),
      splashFactory: InkRipple.splashFactory,
    );
  }

  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.surfaceDeep,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        primary: AppColors.primary,
        brightness: Brightness.dark,
        surface: AppColors.surface,
      ),
    );
    return base.copyWith(
      textTheme: GoogleFonts.manropeTextTheme(base.textTheme),
    );
  }
}

/// Vietnamese money helpers (mirror client `formatNumber` / compact `fmt`).
String formatMoney(num n) {
  final s = n.round().abs().toString();
  final buf = StringBuffer();
  for (int i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return (n < 0 ? '-' : '') + buf.toString();
}

String formatCompact(num n) {
  final abs = n.abs();
  String out;
  if (abs >= 1000000000) {
    out = '${(abs / 1000000000).toStringAsFixed(1)} tỷ';
  } else if (abs >= 1000000) {
    out = '${(abs / 1000000).toStringAsFixed(1)}tr';
  } else if (abs >= 1000) {
    out = '${(abs / 1000).round()}k';
  } else {
    out = abs.round().toString();
  }
  return (n < 0 ? '-' : '') + out;
}
