import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'back_button.dart';
import 'page_title.dart';

/// Header for the bottom-nav tab pages — port of the web PageHeader:
/// round back button (→ Tổng quan), small subtitle over the title, and
/// optional round actions on the right. Same look as the pushed screens'
/// AppBar (AppBackButton + PageTitle), so every page reads the same.
class TabHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> actions;
  const TabHeader({super.key, required this.title, this.subtitle, this.actions = const []});

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 60,
        child: Row(children: [
          const AppBackButton(),
          const SizedBox(width: 16),
          Expanded(child: PageTitle(title, subtitle: subtitle)),
          for (var i = 0; i < actions.length; i++) ...[if (i > 0) const SizedBox(width: 8), actions[i]],
        ]),
      );
}

enum HeaderButtonStyle { brand, filled, neutral }

/// 40px round header action — brand tint (web RefreshButton), solid brand
/// (primary "+" action) or neutral slate (calendar month arrows).
class HeaderButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final HeaderButtonStyle style;
  final String? tooltip;
  const HeaderButton({super.key, required this.icon, required this.onTap, this.style = HeaderButtonStyle.brand, this.tooltip});

  @override
  Widget build(BuildContext context) {
    final (bg, fg, border) = switch (style) {
      HeaderButtonStyle.brand => (AppColors.brandLight.withValues(alpha: 0.6), AppColors.brand, AppColors.brand.withValues(alpha: 0.15)),
      HeaderButtonStyle.filled => (AppColors.brand, Colors.white, Colors.transparent),
      HeaderButtonStyle.neutral => (AppColors.slate100, const Color(0xFF6B7280), Colors.transparent),
    };
    final btn = GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: bg,
          shape: BoxShape.circle,
          border: Border.all(color: border),
          boxShadow: style == HeaderButtonStyle.neutral
              ? null
              : [BoxShadow(color: AppColors.brand.withValues(alpha: style == HeaderButtonStyle.filled ? 0.3 : 0.1), blurRadius: 3, offset: const Offset(0, 1))],
        ),
        child: Icon(icon, size: style == HeaderButtonStyle.neutral ? 20 : 19, color: fg),
      ),
    );
    return tooltip == null ? btn : Tooltip(message: tooltip!, child: btn);
  }
}
