import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

/// Back button styled like the web PageHeader: 40px circle, brand-light tint,
/// faint brand border, brand arrow. Pops when possible, else goes to [fallback]
/// so deep-linked screens still have a way out.
class AppBackButton extends StatelessWidget {
  final String fallback;
  const AppBackButton({super.key, this.fallback = '/dashboard'});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        onTap: () => context.canPop() ? context.pop() : context.go(fallback),
        child: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: AppColors.brandLight.withValues(alpha: 0.6),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.brand.withValues(alpha: 0.15)),
            boxShadow: const [BoxShadow(color: Color(0x0F0F172A), blurRadius: 3, offset: Offset(0, 1))],
          ),
          child: const Icon(Icons.arrow_back_rounded, size: 20, color: AppColors.brand),
        ),
      ),
    );
  }
}
