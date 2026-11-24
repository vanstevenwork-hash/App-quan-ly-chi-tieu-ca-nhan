import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/cashback.dart';
import '../../core/statement.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../models/user.dart';
import '../../state/auth_provider.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../state/important_alerts.dart';
import '../../widgets/alert_tiles.dart';
import '../../widgets/common.dart';
import '../../widgets/transaction_row.dart';
import '../transactions/add_transaction_sheet.dart';
import '../transactions/transaction_detail_sheet.dart';
import 'spending_trend_chart.dart';

/// Home — mirrors client/app/(app)/dashboard/page.tsx: identity + month
/// cashback, boxless net worth with hide toggle and Thu/Chi, scrollable
/// shortcut tiles (Tiết kiệm · Dư nợ · Trả góp), important alerts (real
/// amount due this cycle + urgency), trend chart, day-grouped recent list.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});
  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  bool _hide = true;

  Future<void> _refresh() async {
    refreshFinance(ref);
    ref.invalidate(notificationsProvider);
    try {
      await Future.wait<Object>([
        ref.read(summaryProvider.future),
        ref.read(cardsProvider.future),
        ref.read(transactionsProvider.future),
      ]);
    } catch (_) {
      // Errors surface per-section; refresh just waits.
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final summary = ref.watch(summaryProvider).value;
    final cards = ref.watch(cardsProvider).value ?? const <BankCard>[];
    final txAsync = ref.watch(transactionsProvider);
    final txs = txAsync.value ?? const <TransactionModel>[];
    final wealth = ref.watch(wealthTotalProvider).value ?? 0;
    final unread = (ref.watch(notificationsProvider).value ?? const []).where((n) => !n.read).length;
    final now = DateTime.now();

    // ── Derived (same formulas as the web dashboard) ──
    num assets = 0, debt = 0, savings = 0;
    var savingsCount = 0, creditCount = 0;
    for (final c in cards) {
      if (c.isCredit) {
        debt += c.balance;
        creditCount++;
      } else {
        assets += c.balance;
        if (c.isSavings) {
          savings += c.balance;
          savingsCount++;
        }
      }
    }
    final netWorth = assets + wealth - debt;
    final cashback = monthCashback(cards, txs, now);

    final creditIds = {for (final c in cards.where((c) => c.isCredit)) c.id};
    final plans = [for (final id in creditIds) ...installmentPlans(txs, id, now)];
    final installmentMonthly = plans.fold<num>(0, (s, p) => s + p.monthly);

    // Same live reminders as the notifications screen (shared provider).
    final alerts = ref.watch(importantAlertsProvider);

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFF3EEFF), Color(0xFFF8F9FF), Color(0xFFF5F3FF)],
          ),
        ),
        child: Stack(children: [
          // Soft brand glows behind everything (web "page ambience").
          Positioned(top: -120, left: -40, right: -40, child: _glow(320, const Color(0xFF7C3AED), 0.16)),
          Positioned(top: 110, right: -90, child: _glow(280, const Color(0xFFA78BFA), 0.14)),
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              onRefresh: _refresh,
              color: AppColors.primary,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 120),
                children: [
                  _header(user, cashback, unread),
                  const SizedBox(height: 14),
                  _netWorth(netWorth, summary?.income, summary?.expense),
                  const SizedBox(height: 14),
                  _tiles(savings, savingsCount, debt, creditCount, plans.isEmpty ? null : (monthly: installmentMonthly, count: plans.length)),
                  const SizedBox(height: 18),
                  if (!alerts.isEmpty) ...[
                    _alerts(alerts),
                    const SizedBox(height: 18),
                  ],
                  SectionHeader(
                    'Xu hướng thu chi',
                    trailing: GestureDetector(
                      onTap: () => context.push('/analytics'),
                      child: Container(
                        width: 28, height: 28, alignment: Alignment.center,
                        decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(8)),
                        child: const UiIcon('arrow_right', size: 15, color: AppColors.brand),
                      ),
                    ),
                  ),
                  txAsync.when(
                    data: (list) => SpendingTrendChart(transactions: list),
                    loading: () => const LoadingBox(height: 236),
                    error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(transactionsProvider)),
                  ),
                  const SizedBox(height: 20),
                  _recentHeader(),
                  txAsync.when(
                    data: (list) => _recent(list, cards),
                    loading: () => const LoadingBox(height: 160),
                    error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(transactionsProvider)),
                  ),
                ],
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _glow(double size, Color c, double alpha) => IgnorePointer(
        child: ImageFiltered(
          imageFilter: ui.ImageFilter.blur(sigmaX: 50, sigmaY: 50),
          child: Container(width: size, height: size * 0.8, decoration: BoxDecoration(shape: BoxShape.circle, color: c.withValues(alpha: alpha))),
        ),
      );

  // ── Header: avatar + name + month cashback · scan + bell ──────────────────
  Widget _header(User? user, num cashback, int unread) {
    final avatar = user?.avatar ?? '';
    return Row(children: [
      Container(
        width: 42, height: 42,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2.5),
          gradient: const RadialGradient(center: Alignment(-0.36, -0.44), colors: [Color(0xFFB8A6FF), Color(0xFF8B7CF6), Color(0xFF6C63FF), Color(0xFF5B21B6)], stops: [0, 0.35, 0.65, 1]),
          boxShadow: const [BoxShadow(color: Color(0x736D28D9), blurRadius: 14, offset: Offset(0, 6), spreadRadius: -4)],
          image: avatar.startsWith('http') ? DecorationImage(image: NetworkImage(avatar), fit: BoxFit.cover) : null,
        ),
        alignment: Alignment.center,
        child: avatar.startsWith('http')
            ? null
            : Text(user?.initials ?? 'NN', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(user?.name.isNotEmpty == true ? user!.name : 'Người dùng',
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          const SizedBox(height: 4),
          // Cashback this month, right under the name (web pill).
          Container(
            padding: const EdgeInsets.fromLTRB(4, 2, 8, 2),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFEF3C7)),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Text('🪙', style: TextStyle(fontSize: 12, height: 1)),
              const SizedBox(width: 3),
              Text(cashback > 0 ? '+${formatMoney(cashback)}đ' : '0đ',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFB45309))),
            ]),
          ),
        ]),
      ),
      _circleBtn(Icons.document_scanner_outlined, () => showAddTransactionSheet(context)),
      const SizedBox(width: 8),
      Stack(clipBehavior: Clip.none, children: [
        _circleBtn(null, () => context.push('/notifications'), svg: 'bell'),
        if (unread > 0)
          Positioned(
            top: 8, right: 9,
            child: Container(width: 9, height: 9, decoration: BoxDecoration(color: const Color(0xFFF87171), shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2))),
          ),
      ]),
    ]);
  }

  Widget _circleBtn(IconData? icon, VoidCallback onTap, {String? svg}) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40, height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.slate100),
            boxShadow: const [BoxShadow(color: Color(0x0F0F172A), blurRadius: 3, offset: Offset(0, 1))],
          ),
          child: svg != null ? UiIcon(svg, size: 18, color: AppColors.slate500) : Icon(icon, size: 19, color: AppColors.slate500),
        ),
      );

  // ── Net worth: boxless, label + eye, big number, Thu / Chi ────────────────
  Widget _netWorth(num netWorth, num? income, num? expense) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          GestureDetector(
            onTap: () => context.go('/accounts'),
            child: const Text('Tài sản ròng', style: TextStyle(fontSize: 15, color: AppColors.slate800)),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: () => setState(() => _hide = !_hide),
            behavior: HitTestBehavior.opaque,
            child: Padding(padding: const EdgeInsets.all(6), child: UiIcon(_hide ? 'eye_off' : 'eye', size: 19, color: AppColors.slate400)),
          ),
        ]),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: () => context.go('/accounts'),
          child: Text(_hide ? '*******' : '${formatMoney(netWorth)}đ',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: -0.4, color: AppColors.slate800, height: 1.1)),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: () => context.push('/analytics'),
          child: Row(children: [
            const UiIcon('trending_up', size: 15, color: Color(0xFF10B981)),
            const SizedBox(width: 3),
            Text('+${income == null ? '—' : formatCompact(income)}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF059669))),
            const SizedBox(width: 16),
            const UiIcon('trending_down', size: 15, color: Color(0xFFEF4444)),
            const SizedBox(width: 3),
            Text('-${expense == null ? '—' : formatCompact(expense)}',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFFEF4444))),
          ]),
        ),
      ]),
    );
  }

  // ── Shortcut tiles (horizontal scroll when there are 3) ───────────────────
  Widget _tiles(num savings, int savingsCount, num debt, int creditCount, ({num monthly, int count})? inst) {
    final items = <Widget>[
      _tile(Icons.savings_outlined, const Color(0xFF10B981), _hide ? '••••' : '${formatCompact(savings)}đ',
          'Tiết kiệm · ${savingsCount > 0 ? '$savingsCount sổ' : 'Chưa có sổ'}', () => context.go('/accounts')),
      _tile(Icons.credit_card, const Color(0xFFEF4444), _hide ? '••••' : (debt > 0 ? '-${formatCompact(debt)}đ' : '0đ'),
          'Dư nợ · ${creditCount > 0 ? '$creditCount thẻ' : 'Chưa có thẻ'}', () => context.go('/accounts')),
      if (inst != null)
        _tile(Icons.calendar_month_outlined, const Color(0xFF6366F1), _hide ? '••••' : '${formatCompact(inst.monthly)}đ',
            'Trả góp · ${inst.count} khoản', () => context.push('/statements')),
    ];
    if (inst == null) {
      return Row(children: [Expanded(child: items[0]), const SizedBox(width: 12), Expanded(child: items[1])]);
    }
    return SizedBox(
      height: 58,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (ctx, i) => SizedBox(width: (MediaQuery.sizeOf(ctx).width - 40) * 0.42 + 20, child: items[i]),
      ),
    );
  }

  Widget _tile(IconData icon, Color color, String value, String sub, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          height: 58,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.7)),
            boxShadow: const [BoxShadow(color: Color(0x0F0F172A), blurRadius: 4, offset: Offset(0, 1))],
          ),
          child: Row(children: [
            Container(
              width: 36, height: 36, alignment: Alignment.center,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(11)),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 9),
            Expanded(
              child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(value, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.bold, color: Color.lerp(color, Colors.black, 0.08), height: 1.15)),
                Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10.5, color: AppColors.slate400)),
              ]),
            ),
            const Icon(Icons.chevron_right, size: 15, color: AppColors.slate200),
          ]),
        ),
      );

  // ── Important alerts (top 2, count → notifications) ───────────────────────
  Widget _alerts(ImportantAlerts alerts) {
    // Like the web: every alert opens the notifications screen on "Quan trọng".
    void open() => context.push('/notifications?tab=important');
    // Top 2 only (web VISIBLE_ALERTS); the count links to the full list.
    final shown = <Widget>[
      for (final a in alerts.credit) CreditAlertTile(card: a.card, due: a.due, onTap: open),
      for (final s in alerts.savings) SavingsAlertTile(card: s, onTap: open),
    ].take(2).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Expanded(child: Text('Thông báo quan trọng', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800))),
        GestureDetector(
          onTap: open,
          child: Row(children: [
            Container(
              width: 20, height: 20, alignment: Alignment.center,
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), shape: BoxShape.circle),
              child: Text('${alerts.count}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
            ),
            const Icon(Icons.chevron_right, size: 18, color: AppColors.slate400),
          ]),
        ),
      ]),
      const SizedBox(height: 10),
      for (final w in shown) ...[w, const SizedBox(height: 8)],
    ]);
  }

  // ── Recent transactions, grouped by day with each day's net ───────────────
  Widget _recentHeader() => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(children: [
          const Expanded(child: Text('Giao dịch gần đây', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800))),
          GestureDetector(
            onTap: () => context.push('/analytics'),
            child: Container(
              width: 28, height: 28, alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.brandLight.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.brand.withValues(alpha: 0.25)),
              ),
              child: const UiIcon('arrow_right', size: 15, color: AppColors.brand),
            ),
          ),
        ]),
      );

  static const _weekdays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

  String _dayLabel(DateTime d) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(d.year, d.month, d.day);
    if (day == today) return 'Hôm nay';
    if (day == today.subtract(const Duration(days: 1))) return 'Hôm qua';
    return _weekdays[d.weekday - 1];
  }

  String _source(TransactionModel t, List<BankCard> cards) {
    if (t.paymentMethod != 'card') return 'Tiền mặt';
    for (final c in cards) {
      if (c.id == t.cardId) return c.isWallet ? 'Ví ${c.bankShortName}' : 'Thẻ ${c.bankShortName} ••${c.cardNumber}';
    }
    return 'Thẻ';
  }

  Widget _recent(List<TransactionModel> list, List<BankCard> cards) {
    if (list.isEmpty) {
      return WhiteCard(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Column(children: [
            const Text('Chưa có giao dịch nào', style: TextStyle(color: AppColors.slate400, fontSize: 13)),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => showAddTransactionSheet(context),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(12)),
                child: const Text('+ Thêm giao dịch đầu tiên', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary)),
              ),
            ),
          ]),
        ),
      );
    }

    // Same window as the web: the latest 6, grouped by calendar day.
    final groups = <({DateTime day, List<TransactionModel> items, num net})>[];
    for (final t in list.take(6)) {
      final day = DateTime(t.date.year, t.date.month, t.date.day);
      final signed = t.isIncome ? t.amount : -t.amount;
      if (groups.isNotEmpty && groups.last.day == day) {
        final g = groups.removeLast();
        groups.add((day: day, items: [...g.items, t], net: g.net + signed));
      } else {
        groups.add((day: day, items: [t], net: signed));
      }
    }

    return Column(children: [
      for (final g in groups) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
          child: Row(children: [
            Text.rich(TextSpan(children: [
              TextSpan(text: _dayLabel(g.day), style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.slate800)),
              TextSpan(text: ' · ${g.day.day.toString().padLeft(2, '0')}/${g.day.month.toString().padLeft(2, '0')}',
                  style: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.slate400)),
            ]), style: const TextStyle(fontSize: 13)),
            const Spacer(),
            Text('${g.net < 0 ? '-' : '+'}${formatCompact(g.net.abs())}',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: g.net < 0 ? const Color(0xFFF87171) : AppColors.income)),
          ]),
        ),
        for (final t in g.items)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.slate100),
              boxShadow: const [BoxShadow(color: Color(0x0A0F172A), blurRadius: 3, offset: Offset(0, 1))],
            ),
            child: TransactionRow(tx: t, source: _source(t, cards), onTap: () => showTransactionDetailSheet(context, t)),
          ),
        const SizedBox(height: 6),
      ],
    ]);
  }
}
