import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Stylised gradient "W" brand mark (placeholder for the web app's folded-ribbon
/// SVG — can be swapped for an SVG asset later via flutter_svg).
class BrandLogo extends StatelessWidget {
  final double size;
  const BrandLogo({super.key, this.size = 56});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.gradientStart, AppColors.gradientMid, AppColors.gradientEnd],
        ),
        boxShadow: [
          BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.45),
              blurRadius: 24,
              offset: const Offset(0, 10)),
        ],
      ),
      child: Text('W',
          style: TextStyle(
              color: Colors.white,
              fontSize: size * 0.5,
              fontWeight: FontWeight.w900,
              letterSpacing: -1)),
    );
  }
}
