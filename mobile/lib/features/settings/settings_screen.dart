import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../state/auth_provider.dart';
import '../../theme/app_theme.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  void _soon(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tính năng đang phát triển'), duration: Duration(seconds: 1)),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
          children: [
            const Text('Cài đặt',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.slate800)),
            const SizedBox(height: 16),

            // Profile card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: _cardDeco,
              child: Row(children: [
                Container(
                  width: 56, height: 56,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(colors: [Color(0xFF8B7CF6), Color(0xFF6C4DE6)]),
                  ),
                  child: Text(user?.initials ?? 'NN',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?.name.isNotEmpty == true ? user!.name : 'Người dùng',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                      Text(user?.email ?? '', style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
                    ],
                  ),
                ),
                GestureDetector(
                  onTap: () => _soon(context),
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.edit_outlined, size: 18, color: AppColors.brand),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 22),

            _group('QUẢN LÝ NHANH', [
              _row(context, Icons.credit_card, const Color(0xFF6C63FF), 'Quản lý thẻ', sub: 'Thẻ tín dụng, ghi nợ, ví', route: '/accounts'),
              _row(context, Icons.event_busy_outlined, const Color(0xFFF59E0B), 'Hạn thẻ', sub: 'Ngày sao kê & thanh toán'),
              _row(context, Icons.savings_outlined, const Color(0xFF10B981), 'Hoàn tiền', sub: 'Cashback theo thẻ'),
              _row(context, Icons.account_balance_outlined, const Color(0xFF3B82F6), 'Tiết kiệm', sub: 'Sổ tiết kiệm & kỳ hạn', route: '/accounts'),
            ]),
            const SizedBox(height: 18),

            _group('TÙY CHỈNH', [
              _row(context, Icons.language, const Color(0xFF06B6D4), 'Ngôn ngữ', trailing: 'Tiếng Việt'),
              _row(context, Icons.dark_mode_outlined, const Color(0xFF8B5CF6), 'Giao diện', trailing: 'Sáng'),
              _row(context, Icons.notifications_none_rounded, const Color(0xFFEC4899), 'Thông báo', route: '/notifications'),
            ]),
            const SizedBox(height: 18),

            _group('BẢO MẬT', [
              _row(context, Icons.mail_outline, const Color(0xFF6C63FF), 'Đổi email'),
              _row(context, Icons.lock_outline, const Color(0xFFEF4444), 'Đổi mật khẩu'),
            ]),
            const SizedBox(height: 18),

            _group('DỮ LIỆU', [
              _row(context, Icons.download_outlined, const Color(0xFF10B981), 'Xuất dữ liệu'),
              _row(context, Icons.delete_outline, const Color(0xFFEF4444), 'Xóa dữ liệu', danger: true),
            ]),
            const SizedBox(height: 24),

            GestureDetector(
              onTap: () => ref.read(authProvider.notifier).logout(),
              child: Container(
                height: 50,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: AppColors.expense.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
                child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.logout, size: 18, color: AppColors.expense),
                  SizedBox(width: 8),
                  Text('Đăng xuất', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold, fontSize: 15)),
                ]),
              ),
            ),
            const SizedBox(height: 16),
            const Center(child: Text('Chi Tiêu · phiên bản 1.0.0', style: TextStyle(fontSize: 11, color: AppColors.slate400))),
          ],
        ),
      ),
    );
  }

  static final _cardDeco = BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(18),
    boxShadow: kCardShadow,
  );

  Widget _group(String title, List<Widget> rows) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate400, letterSpacing: 1)),
          ),
          Container(
            decoration: _cardDeco,
            child: Column(
              children: [
                for (int i = 0; i < rows.length; i++) ...[
                  rows[i],
                  if (i < rows.length - 1) const Divider(height: 1, color: AppColors.slate100, indent: 60),
                ],
              ],
            ),
          ),
        ],
      );

  Widget _row(BuildContext context, IconData icon, Color color, String label,
      {String? sub, String? trailing, bool danger = false, String? route}) {
    return InkWell(
      onTap: () => route != null ? context.push(route) : _soon(context),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Row(children: [
          Container(
            width: 36, height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 19, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: danger ? AppColors.expense : AppColors.slate800)),
                if (sub != null) ...[
                  const SizedBox(height: 1),
                  Text(sub, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[
            Text(trailing, style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
            const SizedBox(width: 4),
          ],
          const Icon(Icons.chevron_right, size: 18, color: AppColors.slate400),
        ]),
      ),
    );
  }
}
