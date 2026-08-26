import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Temporary tab body until each feature screen is ported from the web client.
class PlaceholderScreen extends StatelessWidget {
  final String title;
  final IconData icon;
  const PlaceholderScreen({super.key, required this.title, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Text(title,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.slate800)),
            ),
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 48, color: AppColors.brandLight),
                    const SizedBox(height: 12),
                    Text('Màn "$title" sẽ được port tiếp',
                        style: const TextStyle(color: AppColors.slate400, fontSize: 13)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
