import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';
import '../features/transactions/add_transaction_sheet.dart';

/// Bottom-nav shell mirroring the web app's floating pill + center FAB.
/// Wraps the 5 main tab branches (StatefulShellRoute keeps each tab's state).
class AppScaffold extends StatelessWidget {
  final StatefulNavigationShell shell;
  const AppScaffold({super.key, required this.shell});

  static const _items = [
    (asset: 'assets/nav/home.svg', label: 'Tổng quan'),
    (asset: 'assets/nav/calendar.svg', label: 'Lịch'),
    (asset: 'assets/nav/asset.svg', label: 'Tài sản'),
    (asset: 'assets/nav/goal.svg', label: 'Mục tiêu'),
    (asset: 'assets/nav/settings.svg', label: 'Cài đặt'),
  ];

  void _go(int i) => shell.goBranch(i, initialLocation: i == shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      body: shell,
      extendBody: true,
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // ── Glass pill: the 5 destinations ──
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                decoration: BoxDecoration(
                  color: (dark ? const Color(0xFF20264A) : Colors.white).withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: Colors.white.withValues(alpha: dark ? 0.1 : 0.6)),
                  boxShadow: [
                    BoxShadow(color: const Color(0xFF1F1147).withValues(alpha: 0.20), blurRadius: 28, offset: const Offset(0, 10)),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(_items.length, (i) {
                    final active = i == shell.currentIndex;
                    final color = active ? AppColors.primary : (dark ? AppColors.slate500 : AppColors.slate400);
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _go(i),
                      child: SizedBox(
                        width: 54,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              SvgPicture.asset(_items[i].asset, width: 22, height: 22, colorFilter: ColorFilter.mode(color, BlendMode.srcIn)),
                              const SizedBox(height: 2),
                              Text(_items[i].label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w600, color: color)),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ),
              ),
              const SizedBox(width: 10),
              // ── Add-transaction button, inline beside the pill (like web) ──
              GestureDetector(
                onTap: () => showAddTransactionSheet(context),
                child: Container(
                  width: 56, height: 56,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.brand,
                    boxShadow: [
                      BoxShadow(color: AppColors.brand.withValues(alpha: 0.5), blurRadius: 18, offset: const Offset(0, 8)),
                    ],
                  ),
                  child: const Icon(Icons.add, color: Colors.white, size: 28),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
