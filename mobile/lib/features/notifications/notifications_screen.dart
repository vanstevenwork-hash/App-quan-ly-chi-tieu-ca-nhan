import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../constants/categories.dart';
import '../../core/bank_logos.dart';
import '../../core/cashback.dart';
import '../../models/app_notification.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../state/important_alerts.dart';
import '../../theme/app_theme.dart';
import '../../widgets/alert_tiles.dart';
import '../../widgets/card_thumb.dart';
import '../../widgets/common.dart';
import '../cashback/cashback_screen.dart' show cashbackRecordsProvider;
import '../transactions/transaction_detail_sheet.dart';

/// Port of the web NotificationPanel: "Xem biến động số dư" banner,
/// Quan trọng / Ưu đãi / Giao dịch / Nhắc nhở pill tabs with unread counts,
/// Hôm nay / Hôm qua / Cũ hơn groups, bank-logo aware rows with a time rail,
/// tap → detail screen, swipe → delete, "Đánh dấu đã đọc tất cả".
class NotificationsScreen extends ConsumerStatefulWidget {
  final String? initialTab; // 'important' | 'promo' | 'transaction' | 'reminder'
  const NotificationsScreen({super.key, this.initialTab});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

enum _Tab { important, promo, transaction, reminder }

const _tabLabels = {_Tab.important: 'Quan trọng', _Tab.promo: 'Ưu đãi', _Tab.transaction: 'Giao dịch', _Tab.reminder: 'Nhắc nhở'};
const _tabTypes = <_Tab, Set<String>>{
  _Tab.important: {},
  _Tab.promo: {'promo'},
  _Tab.transaction: {'transaction', 'payment', 'saving', 'transaction_expense', 'transaction_income'},
  _Tab.reminder: {'reminder', 'security', 'system', 'general', 'goal_milestone', 'goal_complete'},
};
final _knownTypes = {for (final s in _tabTypes.values) ...s};
const _txIconTypes = {'transaction', 'transaction_expense', 'transaction_income', 'payment'};

// Background tints per type (web TYPE_MAP colours, no emoji).
const _typeBg = <String, Color>{
  'transaction_expense': Color(0xFFFEE2E2),
  'transaction_income': Color(0xFFECFDF5),
  'goal_milestone': Color(0xFFF0FDF4),
  'goal_complete': Color(0xFFDCFCE7),
  'system': Color(0xFFEFF6FF),
  'general': Color(0xFFF8FAFC),
  'promo': Color(0xFFFFF1F2),
};

const _soft = Color(0xFFF8F9FB);
const _gray900 = Color(0xFF111827);
const _gray500 = Color(0xFF6B7280);
const _gray400 = Color(0xFF9CA3AF);
const _gray100 = Color(0xFFF3F4F6);

bool _inTab(AppNotification n, _Tab t) => t == _Tab.important
    ? n.isImportant
    : _tabTypes[t]!.contains(n.type) || (t == _Tab.transaction && !_knownTypes.contains(n.type));

String _p2(int n) => n.toString().padLeft(2, '0');
String _dmy(DateTime d) => '${_p2(d.day)}/${_p2(d.month)}/${d.year}';
String _fmtDateTime(DateTime d) => '${_p2(d.hour)}:${_p2(d.minute)} ${_dmy(d)}';

/// "2,8tr" / "20k" — compact amount (web fmtViShort).
String _fmtShort(num n) {
  final a = n.abs();
  if (a >= 1e9) return '${(a / 1e9).toStringAsFixed(1).replaceAll('.', ',')}tỷ'.replaceAll(',0tỷ', 'tỷ');
  if (a >= 1e6) return '${(a / 1e6).toStringAsFixed(a >= 1e7 ? 1 : 2).replaceAll('.', ',')}tr'.replaceFirst(RegExp(r',?0+tr$'), 'tr');
  if (a >= 1e3) return '${(a / 1e3).round()}k';
  return '${a.round()}';
}

bool _isTxNotif(AppNotification n) => _txIconTypes.contains(n.type) || RegExp('giao dịch', caseSensitive: false).hasMatch(n.title);
String? _notifLogo(AppNotification n) => bankLogoInText(n.title) ?? bankLogoInText(n.message);

/// Avatar for a notification: bank logo → the transaction's category icon →
/// a tinted circle with the title's first letter (no emoji / stock icons).
Widget notifIcon(AppNotification n, {double size = 40}) {
  final logo = _notifLogo(n);
  if (logo != null) {
    return Container(
      width: size,
      height: size,
      padding: EdgeInsets.all(size * 0.15),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(size * 0.3), border: Border.all(color: _gray100)),
      child: Image.network(logo, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox()),
    );
  }
  if (_isTxNotif(n)) {
    final label = n.message.split(':').first.trim();
    final cat = categoryByLabel(label);
    if (cat.label == label) {
      return ClipOval(child: Container(width: size, height: size, color: cat.color.withValues(alpha: 0.12), alignment: Alignment.center, child: CategoryTile(iconType: cat.iconType, color: Colors.transparent, size: size)));
    }
    final income = n.type == 'transaction_income' || RegExp('thu nhập|nhận', caseSensitive: false).hasMatch(n.title);
    return _letter(n, size, (income ? AppColors.income : AppColors.expense).withValues(alpha: 0.12), income ? AppColors.income : AppColors.expense);
  }
  final fallback = _typeBg[n.type] ?? _typeBg['general']!;
  return _letter(n, size, n.iconBg.isNotEmpty ? hexColor(n.iconBg, fallback: fallback) : fallback, _gray500);
}

Widget _letter(AppNotification n, double size, Color bg, Color fg) {
  final t = n.title.replaceAll(RegExp(r'^[^A-Za-zÀ-ỹ0-9]+'), '');
  return Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
    child: Text(t.isEmpty ? '•' : t.substring(0, 1).toUpperCase(), style: TextStyle(fontSize: size * 0.4, fontWeight: FontWeight.w700, color: fg)),
  );
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  late _Tab _tab = switch (widget.initialTab) {
    'important' => _Tab.important,
    'promo' => _Tab.promo,
    'reminder' => _Tab.reminder,
    _ => _Tab.transaction,
  };
  // Optimistic local edits on top of the provider data.
  final Set<String> _readIds = {};
  final Set<String> _deletedIds = {};

  void _markRead(AppNotification n) {
    if (n.read || _readIds.contains(n.id)) return;
    setState(() => _readIds.add(n.id));
    ref.read(financeServiceProvider).markNotificationRead(n.id).catchError((_) {});
  }

  void _open(AppNotification n) {
    _markRead(n);
    if (n.actionUrl == '/auto-actions') {
      context.push('/auto-actions');
      return;
    }
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => NotificationDetailScreen(n: n.markedRead())));
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
    final all = ref.read(notificationsProvider).valueOrNull ?? const <AppNotification>[];
    setState(() => _readIds.addAll(all.map((n) => n.id)));
    await ref.read(financeServiceProvider).markAllNotificationsRead().catchError((_) {});
    ref.invalidate(notificationsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(notificationsProvider);
    final alerts = ref.watch(importantAlertsProvider);
    final all = (async.valueOrNull ?? const <AppNotification>[])
        .where((n) => !_deletedIds.contains(n.id))
        .map((n) => _readIds.contains(n.id) ? n.markedRead() : n)
        .toList();
    final filtered = all.where((n) => _inTab(n, _tab)).toList();
    final alertCount = alerts.gameInvites.length + alerts.invites.length + alerts.credit.length + alerts.savings.length;
    final showAlerts = _tab == _Tab.important && alertCount > 0;

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final groups = <String, List<AppNotification>>{'Hôm nay': [], 'Hôm qua': [], 'Cũ hơn': []};
    for (final n in filtered) {
      final d = DateTime(n.createdAt.year, n.createdAt.month, n.createdAt.day);
      groups[d == today ? 'Hôm nay' : d == yesterday ? 'Hôm qua' : 'Cũ hơn']!.add(n);
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left_rounded, size: 30, color: _gray900),
          onPressed: () => context.canPop() ? context.pop() : context.go('/dashboard'),
        ),
        title: const Text('Thông báo', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _gray900)),
        actions: [
          IconButton(
            tooltip: 'Giao dịch tự động',
            icon: const Icon(Icons.settings_rounded, size: 24, color: _gray900),
            onPressed: () => context.push('/auto-actions'),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Stack(children: [
        RefreshIndicator(
          onRefresh: () async {
            _readIds.clear();
            _deletedIds.clear();
            ref.invalidate(notificationsProvider);
            refreshFinance(ref);
          },
          child: ListView(
            padding: const EdgeInsets.only(bottom: 110),
            children: [
              // Banner → balance history
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Material(
                  color: _soft,
                  borderRadius: BorderRadius.circular(20),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BalanceHistoryScreen())),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(children: [
                        const Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('Xem biến động số dư', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _gray900)),
                            SizedBox(height: 2),
                            Text('Theo dõi lịch sử thay đổi số dư của bạn', style: TextStyle(fontSize: 13, color: _gray500)),
                          ]),
                        ),
                        const Icon(Icons.chevron_right_rounded, size: 22, color: _gray900),
                      ]),
                    ),
                  ),
                ),
              ),
              // Pill tabs with unread counts
              SizedBox(
                height: 52,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  children: [
                    for (final t in _Tab.values) _pill(t, all, alertCount),
                  ],
                ),
              ),
              if (async.isLoading && all.isEmpty)
                const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Đang tải...', style: TextStyle(color: _gray400, fontSize: 13))))
              else if (async.hasError && all.isEmpty)
                ErrorRetry(onRetry: () => ref.invalidate(notificationsProvider))
              else if (filtered.isEmpty && !showAlerts)
                const Padding(
                  padding: EdgeInsets.only(top: 80),
                  child: Column(children: [
                    Text('Không có thông báo nào', style: TextStyle(color: _gray400, fontSize: 14)),
                  ]),
                ),
              if (showAlerts) ...[
                _groupTitle('Cần chú ý'),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Column(children: [
                    for (final g in alerts.gameInvites) _gap(GameInviteTile(match: g, onRespond: (ok) => respondToGameInvite(context, ref, g, ok))),
                    for (final i in alerts.invites) _gap(InviteTile(invite: i, onRespond: (ok) => respondToInvite(context, ref, i, ok))),
                    for (final a in alerts.credit) _gap(CreditAlertTile(card: a.card, due: a.due, onTap: () => context.push('/cards/${a.card.id}'))),
                    for (final s in alerts.savings) _gap(SavingsAlertTile(card: s, onTap: () => context.push('/savings'))),
                  ]),
                ),
                const SizedBox(height: 8),
              ],
              for (final e in groups.entries)
                if (e.value.isNotEmpty) ...[
                  _groupTitle(e.key),
                  for (final n in e.value) _row(n),
                  const SizedBox(height: 8),
                ],
            ],
          ),
        ),
        if (filtered.isNotEmpty)
          Positioned(
            left: 16,
            right: 16,
            bottom: MediaQuery.paddingOf(context).bottom + 16,
            child: Material(
              color: _soft,
              borderRadius: BorderRadius.circular(20),
              elevation: 0,
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: _readAll,
                child: Container(
                  height: 56,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _gray100),
                    boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 8, offset: Offset(0, 2))],
                  ),
                  child: const Text('Đánh dấu đã đọc tất cả', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _gray900)),
                ),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _gap(Widget w) => Padding(padding: const EdgeInsets.only(bottom: 8), child: w);

  Widget _groupTitle(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
        child: Text(t, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _gray500)),
      );

  Widget _pill(_Tab t, List<AppNotification> all, int alertCount) {
    final count = t == _Tab.important
        ? alertCount + all.where((n) => !n.read && n.isImportant).length
        : all.where((n) => !n.read && _inTab(n, t)).length;
    final active = _tab == t;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: GestureDetector(
        onTap: () => setState(() => _tab = t),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: active ? _gray100 : Colors.white, borderRadius: BorderRadius.circular(999)),
          child: Text('${_tabLabels[t]}${count > 0 ? ' ($count)' : ''}',
              style: TextStyle(fontSize: 14, fontWeight: active ? FontWeight.w600 : FontWeight.w500, color: active ? _gray900 : _gray500)),
        ),
      ),
    );
  }

  Widget _row(AppNotification n) {
    final d = n.createdAt;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Dismissible(
        key: ValueKey(n.id),
        direction: DismissDirection.endToStart,
        background: Container(
          alignment: Alignment.centerRight,
          padding: const EdgeInsets.only(right: 24),
          decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(16)),
          child: const Icon(Icons.delete_outline, color: AppColors.expense),
        ),
        onDismissed: (_) => _delete(n),
        child: Material(
          color: n.read ? Colors.white : const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => _open(n),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(children: [
                notifIcon(n),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(n.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 14, height: 1.3, fontWeight: n.read ? FontWeight.w600 : FontWeight.w700, color: _gray900)),
                    if (n.message.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(n.message, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, color: _gray500)),
                    ],
                  ]),
                ),
                const SizedBox(width: 8),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text('${_p2(d.hour)}:${_p2(d.minute)}',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _gray500, fontFeatures: [FontFeature.tabularFigures()])),
                  const SizedBox(height: 2),
                  Text('${_p2(d.day)}/${_p2(d.month)}', style: const TextStyle(fontSize: 10, color: _gray400, fontFeatures: [FontFeature.tabularFigures()])),
                ]),
                if (!n.read) ...[
                  const SizedBox(width: 8),
                  Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFFA855F7), shape: BoxShape.circle)),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Detail
// ═══════════════════════════════════════════════════════════════════════

/// Full-screen detail of one notification (web "Detail View Modal"), plus
/// shortcuts to the related transaction / card when the server linked one.
class NotificationDetailScreen extends ConsumerWidget {
  final AppNotification n;
  const NotificationDetailScreen({super.key, required this.n});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isTx = _isTxNotif(n);
    final tabLabel = _Tab.values.where((t) => t != _Tab.important && _tabTypes[t]!.contains(n.type)).map((t) => _tabLabels[t]).firstOrNull ?? 'Hệ thống';
    TransactionModel? tx;
    if (n.relatedModel == 'Transaction' && (n.relatedId ?? '').isNotEmpty) {
      tx = (ref.watch(transactionsProvider).valueOrNull ?? const <TransactionModel>[]).where((t) => t.id == n.relatedId).firstOrNull;
    }
    final cardId = n.relatedModel == 'Card' ? n.relatedId : null;

    Widget infoRow(String k, Widget v, {bool last = false}) => Container(
          padding: const EdgeInsets.only(bottom: 16),
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: _gray100))),
          child: Row(children: [
            Text(k, style: const TextStyle(fontSize: 15, color: _gray500)),
            const Spacer(),
            v,
          ]),
        );

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        centerTitle: true,
        leading: IconButton(icon: const Icon(Icons.chevron_left_rounded, size: 30, color: _gray900), onPressed: () => Navigator.pop(context)),
        title: Text(isTx ? 'Chi tiết giao dịch' : 'Chi tiết thông báo', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _gray900)),
        bottom: const PreferredSize(preferredSize: Size.fromHeight(1), child: Divider(height: 1, color: Color(0xFFF9FAFB))),
      ),
      body: ListView(padding: const EdgeInsets.all(24), children: [
        Center(
          child: Container(
            decoration: BoxDecoration(boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 3, offset: Offset(0, 1))], borderRadius: BorderRadius.circular(24)),
            child: notifIcon(n, size: 80),
          ),
        ),
        const SizedBox(height: 24),
        Text(n.title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: _gray900, height: 1.3)),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(color: _soft, borderRadius: BorderRadius.circular(20)),
          child: SelectableText(n.message.isNotEmpty ? n.message : n.title, style: const TextStyle(fontSize: 15, height: 1.6, color: Color(0xFF4B5563))),
        ),
        const SizedBox(height: 32),
        infoRow('Thời gian', Text(_fmtDateTime(n.createdAt), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _gray900))),
        infoRow('Loại thông báo', Text(tabLabel, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _gray900))),
        infoRow('Trạng thái', const Text('Thành công', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF16A34A))), last: true),
        if (tx != null || cardId != null || n.actionUrl == '/auto-actions') ...[
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () {
              if (tx != null) {
                showTransactionDetailSheet(context, tx);
              } else if (cardId != null) {
                context.push('/cards/$cardId');
              } else {
                context.push('/auto-actions');
              }
            },
            child: Container(
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [AppColors.brand, Color(0xFF9B4DE8)]),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(tx != null ? 'Xem giao dịch' : cardId != null ? 'Xem thẻ' : 'Xem giao dịch tự động',
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ]),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Balance history ("Xem biến động số dư")
// ═══════════════════════════════════════════════════════════════════════

enum _HTab { all, payment, credit, cashback }

const _teal = Color(0xFFCCFBF1);
const _tealText = Color(0xFF0F766E);
const _slate600 = Color(0xFF475569);
const _slate700 = Color(0xFF334155);

/// "Lịch sử" — web NotificationPanel balance_history view:
/// Tổng quan (transaction notifications), Tài khoản thanh toán / Tín dụng
/// (real transactions split by account type), Hoàn tiền (cashback per card
/// per month, with received/pending status).
class BalanceHistoryScreen extends ConsumerStatefulWidget {
  const BalanceHistoryScreen({super.key});
  @override
  ConsumerState<BalanceHistoryScreen> createState() => _BalanceHistoryScreenState();
}

class _BalanceHistoryScreenState extends ConsumerState<BalanceHistoryScreen> {
  _HTab _tab = _HTab.all;
  String _q = '';
  bool _searching = false;

  bool _match(String s) => _q.isEmpty || s.toLowerCase().contains(_q.toLowerCase());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _soft,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        centerTitle: true,
        elevation: 0.5,
        shadowColor: const Color(0x14000000),
        leading: IconButton(icon: const Icon(Icons.chevron_left_rounded, size: 30, color: _gray900), onPressed: () => Navigator.pop(context)),
        title: _searching
            ? TextField(
                autofocus: true,
                onChanged: (v) => setState(() => _q = v.trim()),
                style: const TextStyle(fontSize: 15),
                decoration: const InputDecoration(hintText: 'Tìm giao dịch…', border: InputBorder.none, isDense: true),
              )
            : const Text('Lịch sử', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
        actions: [
          IconButton(
            icon: Icon(_searching ? Icons.close_rounded : Icons.search_rounded, size: 22, color: _slate600),
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) _q = '';
            }),
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(52),
          child: SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              children: [
                for (final (t, l) in [(_HTab.all, 'Tổng quan'), (_HTab.payment, 'Tài khoản thanh toán'), (_HTab.credit, 'Tín dụng'), (_HTab.cashback, 'Hoàn tiền')])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: GestureDetector(
                      onTap: () => setState(() => _tab = t),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _tab == t ? _teal : Colors.transparent,
                          borderRadius: BorderRadius.circular(999),
                          border: _tab == t ? null : Border.all(color: _gray100),
                        ),
                        child: Text(l,
                            style: TextStyle(fontSize: 14, fontWeight: _tab == t ? FontWeight.w600 : FontWeight.w500, color: _tab == t ? _tealText : _gray500)),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(notificationsProvider);
          ref.invalidate(cashbackRecordsProvider);
          refreshFinance(ref);
        },
        child: switch (_tab) {
          _HTab.all => _overview(),
          _HTab.payment || _HTab.credit => _transactions(credit: _tab == _HTab.credit),
          _HTab.cashback => _cashback(),
        },
      ),
    );
  }

  Widget _empty(String text) => ListView(children: [
        const SizedBox(height: 80),
        Text(text, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: _gray400)),
      ]);

  Widget _dayGroups<T>(Map<String, List<T>> groups, Widget Function(T) row) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          for (final e in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
              child: Text(e.key, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _slate600)),
            ),
            Container(
              padding: const EdgeInsets.all(6),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFF9FAFB)),
                boxShadow: const [BoxShadow(color: Color(0x05000000), blurRadius: 10, offset: Offset(0, 2))],
              ),
              child: Column(children: [
                for (var i = 0; i < e.value.length; i++) ...[
                  if (i > 0) const Divider(height: 1, color: Color(0xFFF9FAFB)),
                  row(e.value[i]),
                ],
              ]),
            ),
          ],
        ],
      );

  Map<String, List<T>> _byDay<T>(List<T> items, DateTime Function(T) date) {
    final out = <String, List<T>>{};
    for (final it in items) {
      out.putIfAbsent(_dmy(date(it)), () => []).add(it);
    }
    return out;
  }

  Widget _histRow({required Widget lead, required String title, required String sub, required String amount, required bool income, VoidCallback? onTap}) => InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          child: Row(children: [
            lead,
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500, color: _slate700)),
                const SizedBox(height: 2),
                Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: _gray400)),
              ]),
            ),
            const SizedBox(width: 8),
            Text(amount,
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: income ? AppColors.income : _slate700, fontFeatures: const [FontFeature.tabularFigures()])),
          ]),
        ),
      );

  /// Tổng quan — transaction-type notifications, amount parsed from the text.
  Widget _overview() {
    final async = ref.watch(notificationsProvider);
    final list = (async.valueOrNull ?? const <AppNotification>[])
        .where((n) => _inTab(n, _Tab.transaction) && (_match(n.title) || _match(n.message)))
        .toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    if (async.isLoading && list.isEmpty) return ListView(children: const [Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Đang tải...', style: TextStyle(color: _gray400))))]);
    if (list.isEmpty) return _empty('Không có giao dịch nào');
    return _dayGroups<AppNotification>(_byDay(list, (n) => n.createdAt), (n) {
      final m = RegExp(r'([\d.,]+)\s*đ').firstMatch(n.message);
      final income = n.type == 'transaction_income' || RegExp('thu nhập|nhận', caseSensitive: false).hasMatch(n.title);
      return _histRow(
        lead: notifIcon(n),
        title: n.title,
        sub: n.message,
        amount: m == null ? '' : '${income ? '+' : '-'}${m.group(1)} đ',
        income: income,
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => NotificationDetailScreen(n: n))),
      );
    });
  }

  /// Tài khoản thanh toán (cash + debit/ví) / Tín dụng — real transactions.
  Widget _transactions({required bool credit}) {
    final txs = ref.watch(transactionsProvider).valueOrNull ?? const <TransactionModel>[];
    final cards = ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[];
    final byId = {for (final c in cards) c.id: c};
    final list = txs.where((t) {
      final isCredit = t.paymentMethod == 'card' && byId[t.cardId]?.isCredit == true;
      return isCredit == credit && (_match(t.note) || _match(t.category));
    }).toList()
      ..sort((a, b) => b.date.compareTo(a.date));
    if (list.isEmpty) return _empty('Chưa có giao dịch');
    return _dayGroups<TransactionModel>(_byDay(list, (t) => t.date), (t) {
      final cat = categoryByLabel(t.category);
      return _histRow(
        lead: CategoryTile(iconType: cat.iconType, color: cat.color, size: 40),
        title: t.note.isNotEmpty ? t.note : t.category,
        sub: '${t.category}${t.feeAmount > 0 ? ' · phí ${_fmtShort(t.feeAmount)}' : ''}',
        amount: '${t.isIncome ? '+' : '-'}${_fmtShort(t.amount)}',
        income: t.isIncome,
        onTap: () => showTransactionDetailSheet(context, t),
      );
    });
  }

  /// Hoàn tiền — capped cashback per credit card per month (net of fees).
  Widget _cashback() {
    final txs = ref.watch(transactionsProvider).valueOrNull ?? const <TransactionModel>[];
    final cards = (ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[]).where((c) => c.isCredit).toList();
    final records = ref.watch(cashbackRecordsProvider).valueOrNull ?? const <Map<String, dynamic>>[];
    final rows = <({BankCard card, int year, int month, num amount, bool received})>[];
    for (final card in cards) {
      if (!_match(card.bankShortName) && !_match(card.bankName)) continue;
      final byMonth = <String, List<TransactionModel>>{};
      for (final t in txs) {
        if (t.isIncome || t.paymentMethod != 'card' || t.cardId != card.id) continue;
        byMonth.putIfAbsent('${t.date.year}-${t.date.month}', () => []).add(t);
      }
      for (final list in byMonth.values) {
        final amount = cappedCashbackTotal(list, card.cashbackRate, card.cashbackCap, card.cashbackMinSpend);
        if (amount <= 0) continue;
        final y = list.first.date.year, m = list.first.date.month;
        final rec = records.where((r) => r['cardId']?.toString() == card.id && r['year'] == y && r['month'] == m - 1).firstOrNull;
        rows.add((card: card, year: y, month: m, amount: amount, received: rec?['status'] == 'received'));
      }
    }
    rows.sort((a, b) => b.year != a.year ? b.year.compareTo(a.year) : b.month.compareTo(a.month));
    if (rows.isEmpty) return _empty('Chưa có lịch sử hoàn tiền');
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
      children: [
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => context.push('/cashback'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: _gray100)),
                  child: Row(children: [
                    CardThumb(card: r.card, size: CardThumbSize.md, showLast4: true),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Hoàn tiền ${r.card.bankShortName.isNotEmpty ? r.card.bankShortName : r.card.bankName}',
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _gray900)),
                        const SizedBox(height: 2),
                        Text('Tháng ${r.month}/${r.year}', style: const TextStyle(fontSize: 11.5, color: _gray500)),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('+${_fmtShort(r.amount)}',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF059669), fontFeatures: [FontFeature.tabularFigures()])),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: r.received ? const Color(0xFFECFDF5) : const Color(0xFFFFFBEB),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: r.received ? const Color(0xFFA7F3D0) : const Color(0xFFFDE68A)),
                        ),
                        child: Text(r.received ? 'Đã nhận' : 'Chờ nhận',
                            style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: r.received ? const Color(0xFF059669) : const Color(0xFFD97706))),
                      ),
                    ]),
                  ]),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
