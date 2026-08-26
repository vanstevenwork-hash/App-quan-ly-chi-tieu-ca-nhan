import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../theme/app_theme.dart';

/// Parse a web hex string like "#8B5CF6" (or "8B5CF6") into a Color.
Color hexColor(String hex, {Color fallback = AppColors.brand}) {
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final v = int.tryParse(h, radix: 16);
  return v == null ? fallback : Color(v);
}

/// A UI glyph ported from the web's CustomIcon set (assets/icons/ui_*.svg).
/// Single-colour icons are tinted via [color]; two-tone ones (eye) bake their
/// own colours, so pass color: null for those.
class UiIcon extends StatelessWidget {
  final String name;
  final double size;
  final Color? color;
  const UiIcon(this.name, {super.key, this.size = 18, this.color});

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      'assets/icons/ui_$name.svg',
      width: size,
      height: size,
      colorFilter: color != null ? ColorFilter.mode(color!, BlendMode.srcIn) : null,
    );
  }
}

/// Rounded tile showing the category's SVG glyph (ported from the web's
/// CustomIcon set) on a tinted background — same look as the web app.
class CategoryTile extends StatelessWidget {
  final String iconType;
  final Color color;
  final double size;
  const CategoryTile({super.key, required this.iconType, required this.color, this.size = 40});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      child: SvgPicture.asset('assets/icons/$iconType.svg', width: size * 0.58, height: size * 0.58),
    );
  }
}

class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;
  const SectionHeader(this.title, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          ?trailing,
        ],
      ),
    );
  }
}

/// Compact error state with a retry button, for FutureProvider failures.
class ErrorRetry extends StatelessWidget {
  final VoidCallback onRetry;
  final String message;
  const ErrorRetry({super.key, required this.onRetry, this.message = 'Không tải được dữ liệu'});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, color: AppColors.slate400, size: 32),
          const SizedBox(height: 8),
          Text(message, style: const TextStyle(color: AppColors.slate500, fontSize: 13)),
          const SizedBox(height: 8),
          TextButton(onPressed: onRetry, child: const Text('Thử lại')),
        ],
      ),
    );
  }
}

class LoadingBox extends StatelessWidget {
  final double height;
  const LoadingBox({super.key, this.height = 80});
  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.slate100),
      ),
      child: const Center(
        child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4)),
      ),
    );
  }
}

class WhiteCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const WhiteCard({super.key, required this.child, this.padding = const EdgeInsets.all(16)});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white),
        boxShadow: kCardShadow,
      ),
      child: child,
    );
  }
}
