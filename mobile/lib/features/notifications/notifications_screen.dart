import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/app_notification.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/back_button.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  IconData _iconFor(String type) => switch (type) {
        'warning' => Icons.warning_amber_rounded,
        'success' => Icons.check_circle_outline,
        'payment' => Icons.receipt_long_outlined,
        _ => Icons.notifications_none_rounded,
      };

  Color _colorFor(String type) => switch (type) {
        'warning' => AppColors.gold,
        'success' => AppColors.income,
        'payment' => AppColors.expense,
        _ => AppColors.primary,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(),
        title: const Text('Thông báo', style: TextStyle(color: AppColors.slate800, fontWeight: FontWeight.bold, fontSize: 18)),
        iconTheme: const IconThemeData(color: AppColors.slate700),
        actions: [
          TextButton(
            onPressed: () async {
              await ref.read(financeServiceProvider).markAllNotificationsRead().catchError((_) {});
              ref.invalidate(notificationsProvider);
            },
            child: const Text('Đọc hết'),
          ),
        ],
      ),
      body: async.when(
        data: (items) => items.isEmpty
            ? const Center(child: Text('Không có thông báo', style: TextStyle(color: AppColors.slate400)))
            : ListView.separated(
                padding: const EdgeInsets.all(20),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (_, i) => _tile(items[i]),
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(notificationsProvider)),
      ),
    );
  }

  Widget _tile(AppNotification n) {
    final color = _colorFor(n.type);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: n.read ? Colors.white : color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: n.read ? AppColors.slate100 : color.withValues(alpha: 0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40, height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
            child: Icon(_iconFor(n.type), color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(n.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                if (n.message.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(n.message, style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
