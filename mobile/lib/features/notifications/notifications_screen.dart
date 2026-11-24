import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../constants/categories.dart';
import '../../models/app_notification.dart';
import '../../state/finance_providers.dart';
import '../../state/important_alerts.dart';
import '../../theme/app_theme.dart';
import '../../widgets/alert_tiles.dart';
import '../../widgets/back_button.dart';
import '../../widgets/common.dart';

/// Port of client/app/(app)/notifications/page.tsx:
/// Tất cả / Quan trọng / Giao dịch tabs, unread count + "đọc hết", live
/// important reminders on the "Quan trọng" tab, per-notification icon
/// (stored emoji, or the transaction's real category icon), time-ago, unread
/// dot, tap = mark read (+ open its screen), swipe = delete.
class NotificationsScreen extends ConsumerStatefulWidget {
  final String? initialTab; // 'important' | 'transaction'
  const NotificationsScreen({super.key, this.initialTab});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

enum _Tab { all, important, transaction }

const _txTypes = {'transaction', 'payment', 'saving', 'transaction_expense', 'transaction_income'};
const _txIconTypes = {'transaction', 'transaction_expense', 'transaction_income', 'payment'};

// Same emoji/background fallbacks as the web TYPE_MAP.
const _typeMap = <String, (String, Color)>{
  'transaction_expense': ('💸', Color(0xFFFEE2E2)),
  'transaction_income': ('💰', Color(0xFFECFDF5)),
  'goal_milestone': ('🏆', Color(0xFFF0FDF4)),
  'goal_complete': ('🏆', Color(0xFFDCFCE7)),
  'system': ('🔔', Color(0xFFEFF6FF)),
  'general': ('📢', Color(0xFFF8FAFC)),
  'promo': ('🎁', Color(0xFFFFF1F2)),
};

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  late _Tab _tab = switch (widget.initialTab) {
    'important' => _Tab.important,
    'transaction' => _Tab.transaction,
    _ => _Tab.all,
  };
  // Optimistic local edits on top of the provider data.
  final Set<String> _readIds = {};
  final Set<String> _deletedIds = {};

  Future<void> _open(AppNotification n) async {
    if (!n.read && !_readIds.contains(n.id)) {
      setState(() => _readIds.add(n.id));
      ref.read(financeServiceProvider).markNotificationRead(n.id).catchError((_) {});
    }
    if (n.actionUrl == '/auto-actions') {
      context.push('/auto-actions');
    } else if (n.relatedModel == 'Card' && (n.relatedId ?? '').isNotEmpty) {
      context.push('/cards/${n.relatedId}');
    }
  }

  Future<void> _delete(AppNotification n) async {
    setState(() => _deletedIds.add(n.id));
    try {
      await ref.read(financeServiceProvider).deleteNotification(n.id);
    } catch (_) {
      if (mounted) {
        setState(() => _deletedIds.remove(n.id));
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Xóa thất bại')));
      }
    }
  }

  Future<void> _readAll() async {
    await ref.read(financeServiceProvider).markAllNotificationsRead().catchError((_) {});
    _readIds.clear();
    ref.invalidate(notificationsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(notificationsProvider);
    final alerts = ref.watch(importantAlertsProvider);
    final all = (async.value ?? const <AppNotification>[])
        .where((n) => !_deletedIds.contains(n.id))
        .map((n) => _readIds.contains(n.id) ? n.markedRead() : n)
        .toList();
    final unread = all.where((n) => !n.read).length;
    final filtered = all.where((n) => switch (_tab) {
          _Tab.important => n.isImportant,
          _Tab.transaction => _txTypes.contains(n.type),
          _Tab.all => true,
        }).toList();
    final showAlerts = _tab == _Tab.important && !alerts.isEmpty;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        leading: const AppBackButton(),
        titleSpacing: 0,
        title: Row(children: [
          const Text('Thông báo', style: TextStyle(color: AppColors.slate800, fontWeight: FontWeight.bold, fontSize: 19)),
          if (unread > 0) ...[
            const SizedBox(width: 8),
            Container(
              constraints: const BoxConstraints(minWidth: 20),
              height: 20,
              padding: const EdgeInsets.symmetric(horizontal: 5),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(10)),
              child: Text('$unread', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
            ),
          ],
        ]),
        actions: [
          TextButton(
            onPressed: () => context.push('/auto-actions'),
            style: TextButton.styleFrom(
              backgroundColor: AppColors.slate100,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              minimumSize: const Size(0, 34),
              shape: const StadiumBorder(),
            ),
            child: const Text('Giao dịch tự động', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          ),
          if (unread > 0)
            IconButton(
              tooltip: 'Đánh dấu đã đọc tất cả',
              onPressed: _readAll,
              icon: const Icon(Icons.done_all_rounded, size: 20, color: AppColors.slate500),
            ),
          const SizedBox(width: 8),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(40),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(children: [
              _tabBtn('Tất cả', _Tab.all),
              _tabBtn('Quan trọng', _Tab.important),
              _tabBtn('Giao dịch', _Tab.transaction),
            ]),
          ),
        ),
      ),
      body: async.isLoading && all.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : async.hasError && all.isEmpty
              ? ErrorRetry(onRetry: () => ref.invalidate(notificationsProvider))
              : RefreshIndicator(
                  onRefresh: () async {
                    _readIds.clear();
                    _deletedIds.clear();
                    ref.invalidate(notificationsProvider);
                    refreshFinance(ref);
                  },
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 40),
                    children: [
                      // Live reminders — same source as the dashboard section.
                      if (showAlerts)
                        Container(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.slate100))),
                          child: Column(children: [
                            for (final a in alerts.credit) ...[
                              CreditAlertTile(card: a.card, due: a.due, onTap: () => context.push('/cards/${a.card.id}')),
                              const SizedBox(height: 8),
                            ],
                            for (final s in alerts.savings) ...[
                              SavingsAlertTile(card: s, onTap: () => context.go('/accounts')),
                              const SizedBox(height: 8),
                            ],
                          ]),
                        ),
                      if (filtered.isEmpty && !showAlerts)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 80),
                          child: Column(children: [
                            Icon(Icons.notifications_none_rounded, size: 48, color: Color(0xFFE2E8F0)),
                            SizedBox(height: 10),
                            Text('Không có thông báo nào', style: TextStyle(color: AppColors.slate400, fontSize: 13)),
                          ]),
                        ),
                      for (final n in filtered) _tile(n),
                    ],
                  ),
                ),
    );
  }

  Widget _tabBtn(String label, _Tab t) {
    final active = _tab == t;
    return GestureDetector(
      onTap: () => setState(() => _tab = t),
      behavior: HitTestBehavior.opaque,
      child: Container(
        margin: const EdgeInsets.only(right: 20),
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: active ? AppColors.primary : Colors.transparent, width: 2))),
        child: Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: active ? AppColors.primary : AppColors.slate400)),
      ),
    );
  }

  static String _timeAgo(DateTime d) {
    final mins = DateTime.now().difference(d).inMinutes;
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return '$mins phút trước';
    final hours = mins ~/ 60;
    if (hours < 24) return '$hours giờ trước';
    final days = hours ~/ 24;
    if (days < 7) return '$days ngày trước';
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  /// Transaction notifications carry "«Danh mục»: 200.000đ…" — show that
  /// category's icon (like the web renderNotifIcon); otherwise the stored
  /// emoji on its background colour.
  Widget _icon(AppNotification n) {
    final isTx = _txIconTypes.contains(n.type) || RegExp('giao dịch', caseSensitive: false).hasMatch(n.title);
    if (isTx) {
      final label = n.message.split(':').first.trim();
      final cat = categoryByLabel(label);
      if (cat.label == label) return CategoryTile(iconType: cat.iconType, color: cat.color, size: 48);
      final income = n.type == 'transaction_income' || RegExp('thu nhập|nhận', caseSensitive: false).hasMatch(n.title);
      final color = income ? AppColors.income : AppColors.expense;
      return Container(
        width: 48, height: 48, alignment: Alignment.center,
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
        child: Icon(income ? Icons.south_west_rounded : Icons.north_east_rounded, color: color, size: 20),
      );
    }
    final fallback = _typeMap[n.type] ?? _typeMap['general']!;
    final bg = n.iconBg.isNotEmpty ? hexColor(n.iconBg, fallback: fallback.$2) : fallback.$2;
    return Container(
      width: 48, height: 48, alignment: Alignment.center,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
      child: Text(n.icon.isNotEmpty ? n.icon : fallback.$1, style: const TextStyle(fontSize: 22)),
    );
  }

  Widget _tile(AppNotification n) {
    return Dismissible(
      key: ValueKey(n.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        color: const Color(0xFFFEE2E2),
        child: const Icon(Icons.delete_outline, color: AppColors.expense),
      ),
      onDismissed: (_) => _delete(n),
      child: InkWell(
        onTap: () => _open(n),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Stack(clipBehavior: Clip.none, children: [
              _icon(n),
              if (!n.read)
                Positioned(
                  top: -2, right: -2,
                  child: Container(
                    width: 11, height: 11,
                    decoration: BoxDecoration(color: const Color(0xFFEF4444), shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2)),
                  ),
                ),
            ]),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(n.title,
                    style: TextStyle(fontSize: 14, height: 1.3,
                        fontWeight: n.read ? FontWeight.w500 : FontWeight.bold,
                        color: n.read ? AppColors.slate700 : AppColors.slate800)),
                if (n.message.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(n.message, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, height: 1.35,
                          color: n.isImportant ? const Color(0xFFEF4444) : AppColors.slate400,
                          fontWeight: n.isImportant ? FontWeight.w500 : FontWeight.normal)),
                ],
                const SizedBox(height: 4),
                Text(_timeAgo(n.createdAt), style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
