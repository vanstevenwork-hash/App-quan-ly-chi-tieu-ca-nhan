import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.pageLight,
      body: Center(
        child: SizedBox(
          width: 34, height: 34,
          child: CircularProgressIndicator(strokeWidth: 2.6, color: AppColors.primary),
        ),
      ),
    );
  }
}
