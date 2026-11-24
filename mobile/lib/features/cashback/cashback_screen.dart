import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/cashback.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/card_thumb.dart';

final cashbackRecordsProvider = FutureProvider.autoDispose((ref) => ref.read(financeServiceProvider).getCashbackRecords());

// Palette of the web cashback page (green "money back" theme).
const _green = Color(0xFF3B7D44); // bars, amounts
const _greenText = Color(0xFF2F7A3E);
const _mintBorder = Color(0xFFD1F0DC);
const _amber = Color(0xFFD97706);
const _amberBg = Color(0xFFFEF3C7);
const _violet = Color(0xFF6366F1);

/// "Hoàn tiền" — port of client/app/(app)/cashback/page.tsx: total (received +
/// pending + shared cards), 6-month trend, per-month / per-card detail with the
/// "đã nhận" toggle (cashback-records), and every card's cashback this month.
class CashbackScreen extends ConsumerStatefulWidget {
  const CashbackScreen({super.key});
  @override
  ConsumerState<CashbackScreen> createState() => _CashbackScreenState();
}

class _Row {
  final BankCard card;
  final int year, month0;
  final num estimated, fee, raw;
  final bool capped;
  final Map<String, dynamic>? record;
  const _Row(this.card, this.year, this.month0, this.estimated, this.fee, this.raw, this.capped, this.record);
  bool get received => record?['status'] == 'received';
  num get display => received ? ((record?['receivedAmount'] as num?) ?? estimated) : estimated;
}

class _CashbackScreenState extends ConsumerState<CashbackScreen> {
  static const _window = 6;
  bool _byCard = false;
  String? _expanded;
  String? _updating;

  Future<void> _toggle(_Row r) async {
    final key = '${r.card.id}-${r.year}-${r.month0}';
    setState(() => _updating = key);
    try {
      await ref.read(financeServiceProvider).upsertCashbackRecord(
          cardId: r.card.id, year: r.year, month0: r.month0, status: r.received ? 'pending' : 'received', estimatedAmount: r.estimated);
      ref.invalidate(cashbackRecordsProvider);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Cập nhật thất bại')));
    } finally {
      if (mounted) setState(() => _updating = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = (ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[]).where((c) => c.isCredit).toList();
    final txs = ref.watch(transactionsProvider).valueOrNull ?? const <TransactionModel>[];
    final records = ref.watch(cashbackRecordsProvider).valueOrNull ?? const [];
    final shared = ref.watch(sharedCashbackProvider).valueOrNull ?? const [];
    final now = DateTime.now();
    final months = List.generate(_window, (i) => DateTime(now.year, now.month - (_window - 1 - i), 1));

    Map<String, dynamic>? recordOf(String cardId, int y, int m0) {
      for (final r in records) {
        if (r['cardId']?.toString() == cardId && r['year'] == y && r['month'] == m0) return r;
      }
      return null;
    }

    final rows = <_Row>[];
    for (final c in cards) {
      final cardTxs = txs.where((t) => t.type == 'expense' && t.paymentMethod == 'card' && t.cardId == c.id).toList();
      for (final m in months) {
        final mt = cardTxs.where((t) => t.date.year == m.year && t.date.month == m.month).toList();
        final est = cappedCashbackTotal(mt, c.cashbackRate, c.cashbackCap, c.cashbackMinSpend);
        final raw = mt.fold<num>(0, (s, t) => s + t.amount) * c.cashbackRate / 100;
        final fee = mt.fold<num>(0, (s, t) => s + t.feeAmount);
        rows.add(_Row(c, m.year, m.month - 1, est, fee, raw, c.cashbackCap > 0 && raw > c.cashbackCap, recordOf(c.id, m.year, m.month - 1)));
      }
    }
    final active = rows.where((r) => r.estimated > 0 || r.record != null).toList();
    final received = active.where((r) => r.received).fold<num>(0, (s, r) => s + r.display);
    final pending = active.where((r) => !r.received).fold<num>(0, (s, r) => s + r.estimated);
    final sharedTotal = shared.fold<num>(0, (s, x) => s + x.amount);
    final total = received + pending + sharedTotal;
    final totalFees = rows.fold<num>(0, (s, r) => s + r.fee);
    final cur = months.last;
    final perMonth = [for (final m in months) rows.where((r) => r.year == m.year && r.month0 == m.month - 1).fold<num>(0, (s, r) => s + r.display)];
    final maxMonth = perMonth.fold<num>(1, (m, v) => v > m ? v : m);
    final thisMonth = rows.where((r) => r.year == cur.year && r.month0 == cur.month - 1).toList()..sort((a, b) => b.display.compareTo(a.display));

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        toolbarHeight: 64,
        leading: const AppBackButton(),
        titleSpacing: 4,
        title: const PageTitle('Hoàn tiền', subtitle: 'Quản lý'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(cashbackRecordsProvider);
          refreshFinance(ref);
        },
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 40), children: [
          _hero(total, sharedTotal, totalFees, received, pending),
          const SizedBox(height: 22),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: const [
            Text('Xu hướng 6 tháng', style: AppText.section),
            SizedBox(width: 6),
            Text('· đơn vị: nghìn đ', style: AppText.caption),
          ]),
          const SizedBox(height: 10),
          _trend(months, perMonth, maxMonth),
          const SizedBox(height: 22),
          Row(children: [
            Expanded(child: Text(_byCard ? 'Chi tiết tháng ${cur.month}' : 'Chi tiết theo tháng', style: AppText.section)),
            Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: AppColors.slate100)),
              child: Row(children: [
                _seg('Theo tháng', !_byCard, () => setState(() => _byCard = false)),
                _seg('Theo thẻ', _byCard, () => setState(() => _byCard = true)),
              ]),
            ),
          ]),
          const SizedBox(height: 12),
          if (active.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Center(child: Text('Chưa có hoàn tiền trong 6 tháng qua', style: TextStyle(color: AppColors.slate400))),
            )
          else if (_byCard)
            _bordered(Column(children: [
              for (final (i, r) in thisMonth.where((r) => r.estimated > 0 || r.record != null).indexed) _cardRow(r, divider: i > 0, showCap: true),
            ]))
          else
            for (final m in months.reversed) _monthGroup(m, active.where((r) => r.year == m.year && r.month0 == m.month - 1).toList()),
          const SizedBox(height: 22),
          const Text('Tất cả thẻ hoàn tiền', style: AppText.section),
          const SizedBox(height: 10),
          _bordered(Column(children: [
            for (final (i, x) in shared.indexed) _allRow(x.share.card, 'Thẻ chung · của ${x.share.ownerName}', x.amount, divider: i > 0, sharedTag: true),
            for (final (i, r) in thisMonth.indexed) _allRow(r.card, 'Hoàn ${_pct(r.card.cashbackRate)}', r.display, divider: shared.isNotEmpty || i > 0),
          ])),
        ]),
      ),
    );
  }

  static String _pct(num v) => '${v % 1 == 0 ? v.toInt() : v}%';
  static String _k(num v) => formatMoney((v / 1000).round());

  // ── Hero ────────────────────────────────────────────────────────────────
  Widget _hero(num total, num shared, num fees, num received, num pending) => Container(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: _mintBorder, width: 1.5),
          gradient: const LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFFF2FBF5), Color(0xFFFFFFFF), Color(0xFFEAF8EF)],
            stops: [0, 0.55, 1],
          ),
          boxShadow: const [BoxShadow(color: Color(0x1410B981), blurRadius: 20, offset: Offset(0, 8))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Expanded(child: Text('Tổng hoàn tiền', style: TextStyle(fontSize: 15, color: AppColors.slate500))),
            Container(
              width: 34, height: 34,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFFDE68A)),
              alignment: Alignment.center,
              child: Container(
                width: 18, height: 18,
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: const Color(0xFFF59E0B), width: 3.5)),
              ),
            ),
          ]),
          const SizedBox(height: 6),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(formatMoney(total), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.slate800, letterSpacing: -0.4)),
            const Padding(padding: EdgeInsets.only(bottom: 5, left: 3), child: Text('đ', style: TextStyle(fontSize: 13, color: AppColors.slate400, decoration: TextDecoration.underline))),
          ]),
          if (shared > 0)
            Text('Gồm +${formatMoney(shared)}đ từ thẻ chung', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _violet)),
          if (fees > 0)
            Text('Đã trừ ${formatMoney(fees)}đ phí giao dịch (hoàn ròng)', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: _amber)),
          const SizedBox(height: 18),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              _heroStat(Icons.check_circle_rounded, const Color(0xFF34A853), const Color(0xFFE3F4E8), 'Đã nhận', '${formatMoney(received)}đ', _greenText),
              const SizedBox(width: 18),
              _heroStat(Icons.schedule_rounded, const Color(0xFFF59E0B), const Color(0xFFFDF1DB), 'Đang chờ', '${formatMoney(pending)}đ', _amber),
              if (shared > 0) ...[
                const SizedBox(width: 18),
                _heroStat(Icons.adjust_rounded, const Color(0xFFF59E0B), const Color(0xFFFDF1DB), 'Thẻ chung', '${formatMoney(shared)}đ', _violet),
              ],
            ]),
          ),
        ]),
      );

  Widget _heroStat(IconData icon, Color iconColor, Color bg, String label, String value, Color valueColor) => Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: iconColor, size: 22),
        ),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
          Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: valueColor)),
        ]),
      ]);

  // ── Trend ───────────────────────────────────────────────────────────────
  Widget _trend(List<DateTime> months, List<num> values, num maxV) => Container(
        height: 210,
        padding: const EdgeInsets.fromLTRB(14, 18, 14, 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: AppColors.slate100)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (final (i, m) in months.indexed)
            Expanded(
              child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                Text(_k(values[i]), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: values[i] > 0 ? const Color(0xFF6CC08A) : AppColors.slate400)),
                const SizedBox(height: 4),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 5),
                  height: values[i] <= 0 ? 6 : 8 + 120 * (values[i] / maxV).toDouble(),
                  decoration: BoxDecoration(
                    color: values[i] <= 0 ? AppColors.slate200 : (i == months.length - 1 ? null : _green),
                    gradient: values[i] > 0 && i == months.length - 1
                        ? const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF9BE1B5), Color(0xFF5CBF85)])
                        : null,
                    borderRadius: BorderRadius.circular(7),
                  ),
                ),
                const SizedBox(height: 8),
                Text('T${m.month}', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
              ]),
            ),
        ]),
      );

  Widget _seg(String label, bool active, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: active ? AppColors.brand : Colors.transparent,
            borderRadius: BorderRadius.circular(20),
            boxShadow: active ? const [BoxShadow(color: Color(0x4D36255C), blurRadius: 8, offset: Offset(0, 3))] : null,
          ),
          child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: active ? Colors.white : AppColors.slate500)),
        ),
      );

  Widget _bordered(Widget child) => Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: _mintBorder, width: 1.5)),
        clipBehavior: Clip.antiAlias,
        child: child,
      );

  // ── Month group ─────────────────────────────────────────────────────────
  Widget _monthGroup(DateTime m, List<_Row> rows) {
    if (rows.isEmpty) return const SizedBox.shrink();
    final key = '${m.year}-${m.month}';
    final now = DateTime.now();
    final open = _expanded == key || (_expanded == null && m.year == now.year && m.month == now.month);
    final total = rows.fold<num>(0, (s, r) => s + r.display);
    final pending = rows.where((r) => !r.received).fold<num>(0, (s, r) => s + r.estimated);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _bordered(Column(children: [
        InkWell(
          onTap: () => setState(() => _expanded = open ? '' : key),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
            child: Row(children: [
              Container(
                width: 48, height: 48,
                decoration: BoxDecoration(color: const Color(0xFFE8F8EE), borderRadius: BorderRadius.circular(14), border: Border.all(color: _mintBorder)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Text('THG', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: _greenText)),
                  Text('${m.month}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: _greenText, height: 1.1)),
                ]),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Tháng ${m.month}, ${m.year}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                  Text('${rows.length} thẻ phát sinh hoàn tiền', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('+${formatMoney(total)}đ', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _greenText)),
                const SizedBox(height: 4),
                pending > 0
                    ? _pill('Chờ nhận ${formatCompact(pending)}', _amber, _amberBg)
                    : _pill('Đã nhận', _greenText, const Color(0xFFE3F4E8)),
              ]),
              Icon(open ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: AppColors.slate400),
            ]),
          ),
        ),
        if (open)
          for (final r in rows) _cardRow(r, divider: true),
      ])),
    );
  }

  Widget _pill(String t, Color fg, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
        child: Text(t, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
      );

  Widget _cardRow(_Row r, {bool divider = false, bool showCap = false}) {
    final key = '${r.card.id}-${r.year}-${r.month0}';
    final capPct = r.card.cashbackCap > 0 ? (r.raw / r.card.cashbackCap).clamp(0.0, 1.0).toDouble() : null;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: divider ? const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFEFF6F1)))) : null,
      child: Row(children: [
        CardThumb(card: r.card, size: CardThumbSize.lg, showLast4: true),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${r.card.bankName} •••• ${r.card.cardNumber}', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
            Text('Hoàn ${_pct(r.card.cashbackRate)}${r.capped ? ' · chạm trần' : ''}${r.fee > 0 ? ' · phí ${formatCompact(r.fee)}' : ''}',
                style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
            if (showCap && capPct != null) ...[
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(value: capPct, minHeight: 4, backgroundColor: const Color(0xFFEFF6F1), valueColor: const AlwaysStoppedAnimation(_green)),
              ),
              const SizedBox(height: 2),
              Text('Trần ${formatCompact(r.card.cashbackCap)}đ/tháng', style: const TextStyle(fontSize: 10, color: AppColors.slate400)),
            ],
          ]),
        ),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('+${formatMoney(r.display)}đ', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: _greenText)),
          const SizedBox(height: 5),
          GestureDetector(
            onTap: _updating == key ? null : () => _toggle(r),
            child: _updating == key
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : r.received
                    ? _pill('✓ Đã nhận', _greenText, const Color(0xFFE3F4E8))
                    : _pill('Chờ nhận', _amber, _amberBg),
          ),
        ]),
      ]),
    );
  }

  Widget _allRow(BankCard card, String sub, num amount, {bool divider = false, bool sharedTag = false}) => Container(
        padding: const EdgeInsets.all(14),
        decoration: divider ? const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFFEFF6F1)))) : null,
        child: Row(children: [
          CardThumb(card: card, size: CardThumbSize.md, showLast4: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${card.bankName} •••• ${card.cardNumber}', maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              Text(sub, style: TextStyle(fontSize: 11, color: sharedTag ? _violet : AppColors.slate400)),
            ]),
          ),
          Text(amount > 0 ? '+${formatMoney(amount)}đ' : '0đ',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: amount > 0 ? _greenText : AppColors.slate400)),
        ]),
      );
}
