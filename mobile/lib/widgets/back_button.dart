import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

/// Always-present back button for pushed screens: pops the stack when possible,
/// otherwise falls back to a route (so deep-linked screens still have a way out).
class AppBackButton extends StatelessWidget {
  final String fallback;
  const AppBackButton({super.key, this.fallback = '/dashboard'});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back, color: AppColors.slate700),
      onPressed: () => context.canPop() ? context.pop() : context.go(fallback),
    );
  }
}
