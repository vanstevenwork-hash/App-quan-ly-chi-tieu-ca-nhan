import 'dart:io';
import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../constants/categories.dart';
import '../../core/cashback.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/common.dart';
import '../../widgets/page_title.dart';
import '../transactions/transaction_detail_sheet.dart';

/// "Báo cáo chi tiêu" — port of client/app/(app)/analytics/page.tsx:
/// period tabs (Tuần này = last 7 days, like the web), coloured summary
/// cards, stats table (salary / other income / cashback / fees / net),
/// trend chart with axes, filterable + paginated transaction list with CSV
/// export, category breakdown, and a 6-month history.
enum _Period { thisWeek, thisMonth, lastMonth, custom }

const _periodLabels = {
  _Period.thisWeek: 'Tuần này',
  _Period.thisMonth: 'Tháng này',
  _Period.lastMonth: 'Tháng trước',
  _Period.custom: 'Tùy chỉnh',
};
const _pageSize = 10;
const _emerald = Color(0xFF10B981);
const _rose = Color(0xFFF43F5E);

String _p2(int n) => n.toString().padLeft(2, '0');

String _fmtShort(num n) {
  final a = n.abs();
  if (a >= 1e9) return '${(a / 1e9).toStringAsFixed(1).replaceAll('.', ',')}tỷ'.replaceAll(',0tỷ', 'tỷ');
  if (a >= 1e6) return '${(a / 1e6).toStringAsFixed(a >= 1e7 ? 1 : 2).replaceAll('.', ',')}tr'.replaceFirst(RegExp(r',?0+tr$'), 'tr');
  if (a >= 1e3) return '${(a / 1e3).round()}k';
  return '${a.round()}';
}

class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});
  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  _Period _period = _Period.thisWeek;
  DateTime? _customStart;
  DateTime _customEnd = DateTime.now();
  String _filter = 'all'; // all | expense | income
  int _page = 1;

  /// Inclusive day range of the selected period (null = custom not set yet).
  (DateTime, DateTime)? _range() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    switch (_period) {
      case _Period.thisWeek:
        return (today.subtract(const Duration(days: 6)), today);
      case _Period.thisMonth:
        return (DateTime(now.year, now.month, 1), today);
      case _Period.lastMonth:
        return (DateTime(now.year, now.month - 1, 1), DateTime(now.year, now.month, 0));
      case _Period.custom:
        if (_customStart == null) return null;
        final s = DateTime(_customStart!.year, _customStart!.month, _customStart!.day);
        final e = DateTime(_customEnd.year, _customEnd.month, _customEnd.day);
        return e.isBefore(s) ? null : (s, e);
    }
  }

  void _setPeriod(_Period p) => setState(() {
        _period = p;
        _page = 1;
      });

  @override
  Widget build(BuildContext context) {
    final txAsync = ref.watch(transactionsProvider);
    final all = txAsync.valueOrNull ?? const <TransactionModel>[];
    final cards = ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[];
    final range = _range();
    final periodTx = range == null
        ? <TransactionModel>[]
        : (all.where((t) {
            final d = DateTime(t.date.year, t.date.month, t.date.day);
            return !d.isBefore(range.$1) && !d.isAfter(range.$2);
          }).toList()
          ..sort((a, b) => b.date.compareTo(a.date)));

    num income = 0, expense = 0, salary = 0, fees = 0;
    final byCat = <String, num>{};
    for (final t in periodTx) {
      if (t.isIncome) {
        income += t.amount;
        if (t.category == 'Lương') salary += t.amount;
      } else {
        expense += t.amount;
        byCat[t.category] = (byCat[t.category] ?? 0) + t.amount;
      }
      if (t.paymentMethod == 'card') fees += t.feeAmount;
    }
    // Gross cashback per credit card in the period (capped / min-spend gated).
    num gross = 0;
    for (final c in cards.where((c) => c.isCredit)) {
      final cardTx = periodTx.where((t) => !t.isIncome && t.paymentMethod == 'card' && t.cardId == c.id).toList();
      if (cardTx.isEmpty) continue;
      // cappedCashbackTotal nets fees out — add them back for the gross figure.
      gross += cappedCashbackTotal(cardTx, c.cashbackRate, c.cashbackCap, c.cashbackMinSpend) + cardTx.fold<num>(0, (s, t) => s + t.feeAmount);
    }

    final filtered = periodTx.where((t) => _filter == 'all' || (_filter == 'income') == t.isIncome).toList();
    final pages = math.max(1, (filtered.length / _pageSize).ceil());
    final page = _page.clamp(1, pages);
    final paged = filtered.skip((page - 1) * _pageSize).take(_pageSize).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FF),
        leading: const AppBackButton(),
        title: const PageTitle('Báo cáo chi tiêu', subtitle: 'Thống kê'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: GestureDetector(
                onTap: () => refreshFinance(ref),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.brandLight.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.brand.withValues(alpha: 0.15)),
                  ),
                  child: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.brand),
                ),
              ),
            ),
          ),
        ],
      ),
      body: txAsync.isLoading && all.isEmpty
          ? const Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                CircularProgressIndicator(color: Color(0xFFA855F7)),
                SizedBox(height: 12),
                Text('Đang tải dữ liệu...', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF9CA3AF))),
              ]),
            )
          : txAsync.hasError && all.isEmpty
              ? ErrorRetry(onRetry: () => ref.invalidate(transactionsProvider))
              : RefreshIndicator(
                  onRefresh: () async => refreshFinance(ref),
                  child: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 48), children: [
                    _periodSelector(),
                    if (_period == _Period.custom) ...[const SizedBox(height: 12), _customRange()],
                    const SizedBox(height: 16),
                    Row(children: [
                      _summary('Thu nhập', income, _emerald, const Color(0xFFECFDF5), const Color(0xFFD1FAE5), ''),
                      const SizedBox(width: 10),
                      _summary('Chi tiêu', expense, _rose, const Color(0xFFFFF1F2), const Color(0xFFFFE4E6), ''),
                      const SizedBox(width: 10),
                      income - expense >= 0
                          ? _summary('Số dư', income - expense, const Color(0xFF3B82F6), const Color(0xFFEFF6FF), const Color(0xFFDBEAFE), '+')
                          : _summary('Số dư', income - expense, _rose, const Color(0xFFFFF1F2), const Color(0xFFFFE4E6), '−'),
                    ]),
                    const SizedBox(height: 20),
                    _stats(salary, income - salary, gross, fees),
                    const SizedBox(height: 16),
                    _trend(periodTx, range),
                    const SizedBox(height: 16),
                    _txHeader(filtered),
                    const SizedBox(height: 12),
                    if (filtered.isEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.slate200)),
                        child: const Column(children: [
                          Text('Không tìm thấy giao dịch nào', style: TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: AppColors.slate400)),
                        ]),
                      )
                    else
                      for (final t in paged) Padding(padding: const EdgeInsets.only(bottom: 8), child: _txRow(t, cards)),
                    if (pages > 1) _pager(page, pages),
                    if (byCat.isNotEmpty) ...[const SizedBox(height: 16), _breakdown(byCat, expense)],
                    const SizedBox(height: 16),
                    _history(all),
                  ]),
                ),
    );
  }

  // ── Period tabs + custom range ─────────────────────────────────────────
  Widget _periodSelector() => Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
          boxShadow: kCardShadow,
        ),
        child: Row(children: [
          for (final p in _Period.values)
            Expanded(
              child: GestureDetector(
                onTap: () => _setPeriod(p),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: _period == p ? AppColors.brand : Colors.transparent, borderRadius: BorderRadius.circular(16)),
                  child: Text(_periodLabels[p]!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _period == p ? Colors.white : AppColors.slate500)),
                ),
              ),
            ),
        ]),
      );

  Widget _customRange() {
    String fmt(DateTime? d) => d == null ? 'dd/mm/yyyy' : '${_p2(d.day)}/${_p2(d.month)}/${d.year}';
    Widget field(String label, DateTime? value, bool isStart) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.slate400, letterSpacing: 0.5)),
            const SizedBox(height: 4),
            GestureDetector(
              onTap: () async {
                final now = DateTime.now();
                final d = await showDatePicker(
                  context: context,
                  initialDate: value ?? now,
                  firstDate: isStart ? DateTime(2020) : (_customStart ?? DateTime(2020)),
                  lastDate: isStart ? _customEnd : now,
                );
                if (d != null) {
                  setState(() {
                    if (isStart) {
                      _customStart = d;
                    } else {
                      _customEnd = d;
                    }
                    _page = 1;
                  });
                }
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate200)),
                child: Text(fmt(value), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: value == null ? AppColors.slate400 : AppColors.slate900)),
              ),
            ),
          ]),
        );
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(20), boxShadow: kCardShadow),
      child: Row(children: [field('TỪ NGÀY', _customStart, true), const SizedBox(width: 10), field('ĐẾN NGÀY', _customEnd, false)]),
    );
  }

  // ── Summary cards ──────────────────────────────────────────────────────
  Widget _summary(String label, num value, Color color, Color bg, Color ring, String prefix) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16), border: Border.all(color: ring), boxShadow: kCardShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.slate500, letterSpacing: 0.4)),
            const SizedBox(height: 8),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text('$prefix${formatMoney(value.abs())}₫',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: color, fontFeatures: const [FontFeature.tabularFigures()])),
            ),
          ]),
        ),
      );

  Widget _card({required Widget child}) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: AppColors.slate100),
          boxShadow: const [BoxShadow(color: Color(0x14E2E8F0), blurRadius: 3, offset: Offset(0, 1))],
        ),
        child: child,
      );

  Widget _h(String t) => Text(t.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.slate400, letterSpacing: 1.5));

  // ── Stats table ────────────────────────────────────────────────────────
  Widget _stats(num salary, num otherIncome, num gross, num fees) {
    final net = gross - fees;
    Widget line(String label, String value, Color color) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(children: [
            Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.slate600))),
            Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color, fontFeatures: const [FontFeature.tabularFigures()])),
          ]),
        );
    Widget total(String label, String value, Color color) => Container(
          margin: const EdgeInsets.only(top: 4),
          padding: const EdgeInsets.only(top: 6),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.slate100))),
          child: Row(children: [
            Expanded(child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.slate500))),
            Text(value, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: color, fontFeatures: const [FontFeature.tabularFigures()])),
          ]),
        );
    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 12), child: _h('Bảng thống kê · ${_periodLabels[_period]}')),
        line('Lương', '${formatMoney(salary)}đ', AppColors.slate800),
        line('Thu nhập khác', '${formatMoney(otherIncome)}đ', AppColors.slate800),
        total('Tổng thu nhập', '${formatMoney(salary + otherIncome)}đ', const Color(0xFF059669)),
        const SizedBox(height: 12),
        const _DashedLine(),
        const SizedBox(height: 10),
        line('Tổng hoàn tiền', '+${formatMoney(gross.round())}đ', const Color(0xFF059669)),
        line('Phí giao dịch', '-${formatMoney(fees)}đ', const Color(0xFFEF4444)),
        total('Hoàn ròng', '${net >= 0 ? '+' : ''}${formatMoney(net.round())}đ', net >= 0 ? const Color(0xFF059669) : const Color(0xFFEF4444)),
      ]),
    );
  }

  // ── Trend chart (daily buckets; weekly for very long custom ranges) ─────
  Widget _trend(List<TransactionModel> txs, (DateTime, DateTime)? range) {
    final buckets = <({String name, double income, double expense})>[];
    if (range != null) {
      final span = range.$2.difference(range.$1).inDays + 1;
      final step = span > 92 ? 7 : 1;
      final n = (span / step).ceil();
      final inc = List<double>.filled(n, 0), exp = List<double>.filled(n, 0);
      for (final t in txs) {
        final d = DateTime(t.date.year, t.date.month, t.date.day);
        final idx = d.difference(range.$1).inDays ~/ step;
        if (idx < 0 || idx >= n) continue;
        if (t.isIncome) {
          inc[idx] += t.amount.toDouble();
        } else {
          exp[idx] += t.amount.toDouble();
        }
      }
      for (var i = 0; i < n; i++) {
        final d = range.$1.add(Duration(days: i * step));
        buckets.add((name: '${d.day}/${d.month}', income: inc[i], expense: exp[i]));
      }
    }
    final hasData = buckets.any((b) => b.income > 0 || b.expense > 0);
    final maxY = [...buckets.map((b) => b.income), ...buckets.map((b) => b.expense), 1.0].reduce(math.max);
    final tickEvery = math.max(1, (buckets.length / 8).ceil());
    Widget legend(Color c, String l) => Row(children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text(l, style: const TextStyle(fontSize: 9, color: AppColors.slate400)),
        ]);
    LineChartBarData line(List<FlSpot> spots, Color color) => LineChartBarData(
          spots: spots,
          isCurved: true,
          preventCurveOverShooting: true,
          color: color,
          barWidth: 3,
          dotData: FlDotData(show: true, checkToShowDot: (s, _) => s.x == buckets.length - 1 && s.y > 0),
          belowBarData: BarAreaData(show: true, gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withValues(alpha: 0.28), color.withValues(alpha: 0)])),
        );
    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Padding(padding: const EdgeInsets.only(left: 4), child: _h('Xu hướng · ${_periodLabels[_period]}'))),
          legend(const Color(0xFF10B981), 'Thu'),
          const SizedBox(width: 8),
          legend(const Color(0xFFF43F5E), 'Chi'),
        ]),
        const SizedBox(height: 16),
        SizedBox(
          height: 160,
          child: !hasData
              ? const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text('Chưa có giao dịch trong kỳ này', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.slate400)),
                ])
              : LineChart(LineChartData(
                  minY: 0,
                  maxY: maxY * 1.2,
                  gridData: const FlGridData(show: false),
                  borderData: FlBorderData(show: false),
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipColor: (_) => Colors.white,
                      getTooltipItems: (spots) => [
                        for (final s in spots)
                          LineTooltipItem('${s.barIndex == 0 ? 'Thu' : 'Chi'}: ${formatMoney(s.y)}₫',
                              TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: s.barIndex == 0 ? const Color(0xFF059669) : _rose)),
                      ],
                    ),
                  ),
                  titlesData: FlTitlesData(
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 32,
                        interval: maxY * 1.2 / 3,
                        getTitlesWidget: (v, meta) => v == meta.max
                            ? const SizedBox.shrink()
                            : Text(v <= 0 ? '0' : _fmtShort(v), style: const TextStyle(fontSize: 9, color: AppColors.slate400)),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        interval: 1,
                        reservedSize: 22,
                        getTitlesWidget: (v, meta) {
                          final i = v.toInt();
                          if (i < 0 || i >= buckets.length || v != i.toDouble() || i % tickEvery != 0) return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(buckets[i].name, style: const TextStyle(fontSize: 10, color: AppColors.slate400)),
                          );
                        },
                      ),
                    ),
                  ),
                  lineBarsData: [
                    line([for (var i = 0; i < buckets.length; i++) FlSpot(i.toDouble(), buckets[i].income)], const Color(0xFF34D399)),
                    line([for (var i = 0; i < buckets.length; i++) FlSpot(i.toDouble(), buckets[i].expense)], const Color(0xFFF87171)),
                  ],
                )),
        ),
      ]),
    );
  }

  // ── Transactions ───────────────────────────────────────────────────────
  Widget _txHeader(List<TransactionModel> filtered) => Row(children: [
        Expanded(child: Padding(padding: const EdgeInsets.only(left: 4), child: _h('Giao dịch gần nhất'))),
        GestureDetector(
          onTap: () => _export(filtered),
          child: Container(
            height: 28,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.slate200.withValues(alpha: 0.5))),
            child: const Text('CSV', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.slate500)),
          ),
        ),
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate200.withValues(alpha: 0.5))),
          child: Row(children: [
            for (final (k, l) in [('all', 'TẤT CẢ'), ('expense', 'CHI'), ('income', 'THU')])
              GestureDetector(
                onTap: () => setState(() {
                  _filter = k;
                  _page = 1;
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: _filter == k ? AppColors.brand : Colors.transparent, borderRadius: BorderRadius.circular(8)),
                  child: Text(l, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _filter == k ? Colors.white : AppColors.slate400)),
                ),
              ),
          ]),
        ),
      ]);

  String _source(TransactionModel t, List<BankCard> cards) {
    if (t.paymentMethod != 'card' || t.cardId == null) return 'Tiền mặt';
    final c = cards.where((c) => c.id == t.cardId).firstOrNull;
    if (c == null) return 'Thẻ';
    return '${c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName}${c.cardNumber.isNotEmpty ? ' ••${c.cardNumber}' : ''}';
  }

  Widget _txRow(TransactionModel t, List<BankCard> cards) {
    final cat = categoryByLabel(t.category);
    final d = t.date;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => showTransactionDetailSheet(context, t),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.slate100)),
          child: Row(children: [
            CategoryTile(iconType: cat.iconType, color: cat.color, size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.note.isNotEmpty ? t.note : t.category,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate800, height: 1.2)),
                const SizedBox(height: 2),
                Text.rich(
                  TextSpan(style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppColors.slate400), children: [
                    TextSpan(text: t.category),
                    TextSpan(text: '  ·  ${_p2(d.day)}/${_p2(d.month)} ${_p2(d.hour)}:${_p2(d.minute)}'),
                    if (t.feeAmount > 0) TextSpan(text: '  ·  phí ${_fmtShort(t.feeAmount)}', style: const TextStyle(color: Color(0xFFD97706), fontWeight: FontWeight.w600)),
                  ]),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ]),
            ),
            const SizedBox(width: 8),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('${t.isIncome ? '+' : '-'}${_fmtShort(t.amount)}',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: t.isIncome ? _emerald : const Color(0xFFF87171), fontFeatures: const [FontFeature.tabularFigures()])),
              const SizedBox(height: 2),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 120),
                child: Text(_source(t, cards), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: AppColors.slate400)),
              ),
            ]),
          ]),
        ),
      ),
    );
  }

  Widget _pager(int page, int pages) {
    Widget btn(String label, bool enabled, VoidCallback onTap) => Opacity(
          opacity: enabled ? 1 : 0.4,
          child: GestureDetector(
            onTap: enabled ? onTap : null,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate100)),
              child: Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate600)),
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
      child: Row(children: [
        btn('Trước', page > 1, () => setState(() => _page = page - 1)),
        Expanded(child: Text('Trang $page/$pages', textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.slate400))),
        btn('Sau', page < pages, () => setState(() => _page = page + 1)),
      ]),
    );
  }

  Future<void> _export(List<TransactionModel> txs) async {
    if (txs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không có giao dịch nào để xuất')));
      return;
    }
    String q(String s) => '"${s.replaceAll('"', '""')}"';
    final rows = [
      'Ngày,Loại,Danh mục,Số tiền,Phương thức,Ghi chú',
      for (final t in txs)
        ['${_p2(t.date.day)}/${_p2(t.date.month)}/${t.date.year}', t.isIncome ? 'Thu nhập' : 'Chi tiêu', q(t.category), t.amount, t.paymentMethod, q(t.note)].join(','),
    ];
    final r = _range();
    final label = _period == _Period.custom && r != null
        ? '${r.$1.year}-${_p2(r.$1.month)}-${_p2(r.$1.day)}_den_${r.$2.year}-${_p2(r.$2.month)}-${_p2(r.$2.day)}'
        : _periodLabels[_period]!.toLowerCase().replaceAll(' ', '-');
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/giao-dich_$label.csv');
    await f.writeAsString('﻿${rows.join('\n')}');
    await SharePlus.instance.share(ShareParams(files: [XFile(f.path, mimeType: 'text/csv')], subject: 'Giao dịch ${_periodLabels[_period]}'));
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Đã xuất ${txs.length} giao dịch')));
  }

  // ── Category breakdown ─────────────────────────────────────────────────
  Widget _breakdown(Map<String, num> byCat, num totalExpense) {
    final rows = byCat.entries.where((e) => e.value > 0).toList()..sort((a, b) => b.value.compareTo(a.value));
    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 16), child: _h('Cơ cấu chi tiêu')),
        SizedBox(
          height: 200,
          child: PieChart(PieChartData(
            sectionsSpace: 0,
            centerSpaceRadius: 50,
            sections: [
              for (final r in rows)
                PieChartSectionData(
                  value: r.value.toDouble(),
                  color: categoryByLabel(r.key).color,
                  radius: 50,
                  title: totalExpense > 0 && r.value / totalExpense >= 0.06 ? '${(r.value / totalExpense * 100).round()}%' : '',
                  titleStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white),
                ),
            ],
          )),
        ),
        const SizedBox(height: 16),
        for (final r in rows) ...[
          () {
            final cat = categoryByLabel(r.key);
            final pct = totalExpense > 0 ? (r.value / totalExpense * 100).round() : 0;
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0x80F8FAFC), borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                CategoryTile(iconType: cat.iconType, color: cat.color, size: 32),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(children: [
                    Row(children: [
                      Expanded(child: Text(r.key, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.slate700))),
                      Text('${formatMoney(r.value)}₫', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppColors.slate900)),
                    ]),
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(value: pct / 100, minHeight: 6, backgroundColor: AppColors.slate200.withValues(alpha: 0.5), color: cat.color),
                    ),
                  ]),
                ),
                const SizedBox(width: 8),
                SizedBox(width: 32, child: Text('$pct%', textAlign: TextAlign.right, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: AppColors.slate400))),
              ]),
            );
          }(),
        ],
      ]),
    );
  }

  // ── 6-month history ────────────────────────────────────────────────────
  Widget _history(List<TransactionModel> all) {
    final now = DateTime.now();
    final months = [
      for (var i = 5; i >= 0; i--)
        () {
          final d = DateTime(now.year, now.month - i, 1);
          num inc = 0, exp = 0;
          for (final t in all) {
            if (t.date.year != d.year || t.date.month != d.month) continue;
            if (t.isIncome) {
              inc += t.amount;
            } else {
              exp += t.amount;
            }
          }
          return (label: 'Th${d.month}/${d.year}', income: inc, expense: exp);
        }(),
    ];
    return _card(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.fromLTRB(4, 0, 4, 16), child: _h('Lịch sử theo tháng')),
        for (var i = 0; i < months.length; i++)
          () {
            final m = months[i];
            final prev = i > 0 ? months[i - 1] : null;
            final delta = prev != null && prev.expense > 0 ? (m.expense - prev.expense) / prev.expense * 100 : null;
            final current = i == months.length - 1;
            return Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: current ? const Color(0x99FAF5FF) : null,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: current ? const Color(0xFFF3E8FF) : Colors.transparent),
              ),
              child: Row(children: [
                SizedBox(width: 64, child: Text(m.label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.slate700))),
                Expanded(child: Text('+${formatMoney(m.income)}₫', textAlign: TextAlign.right, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _emerald))),
                Expanded(child: Text('-${formatMoney(m.expense)}₫', textAlign: TextAlign.right, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _rose))),
                SizedBox(
                  width: 44,
                  child: Text(
                    delta == null ? '—' : '${delta <= 0 ? '↓' : '↑'}${delta.abs().toStringAsFixed(0)}%',
                    textAlign: TextAlign.right,
                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: delta == null ? AppColors.slate300 : delta <= 0 ? _emerald : _rose),
                  ),
                ),
              ]),
            );
          }(),
        const SizedBox(height: 6),
        const Center(child: Text('Chi tiêu so với tháng liền trước', style: TextStyle(fontSize: 9, color: AppColors.slate300))),
      ]),
    );
  }
}

class _DashedLine extends StatelessWidget {
  const _DashedLine();
  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (_, c) {
        final n = (c.maxWidth / 8).floor();
        return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          for (var i = 0; i < n; i++) Container(width: 4, height: 1, color: AppColors.slate200),
        ]);
      });
}
