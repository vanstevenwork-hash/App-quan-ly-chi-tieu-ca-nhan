import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../widgets/back_button.dart';
import '../../constants/categories.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/transaction_row.dart';
import '../transactions/transaction_detail_sheet.dart';

enum _Period { thisWeek, thisMonth, lastMonth, custom }

const _periodLabels = {
  _Period.thisWeek: 'Tuần này',
  _Period.thisMonth: 'Tháng này',
  _Period.lastMonth: 'Tháng trước',
  _Period.custom: 'Tùy chỉnh',
};

class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});
  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  _Period _period = _Period.thisWeek;
  DateTime? _customStart;
  DateTime? _customEnd;

  (DateTime, DateTime) _range() {
    final now = DateTime.now();
    switch (_period) {
      case _Period.thisWeek:
        final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
        return (monday, monday.add(const Duration(days: 6, hours: 23, minutes: 59, seconds: 59)));
      case _Period.thisMonth:
        return (DateTime(now.year, now.month, 1), DateTime(now.year, now.month + 1, 0, 23, 59, 59));
      case _Period.lastMonth:
        return (DateTime(now.year, now.month - 1, 1), DateTime(now.year, now.month, 0, 23, 59, 59));
      case _Period.custom:
        final s = _customStart ?? DateTime(now.year, now.month, 1);
        final e = _customEnd ?? now;
        return (DateTime(s.year, s.month, s.day), DateTime(e.year, e.month, e.day, 23, 59, 59));
    }
  }

  @override
  Widget build(BuildContext context) {
    final txAsync = ref.watch(transactionsProvider);
    final all = txAsync.valueOrNull ?? const <TransactionModel>[];
    final (start, end) = _range();
    final periodTx = all.where((t) => !t.date.isBefore(start) && !t.date.isAfter(end)).toList()
      ..sort((a, b) => b.date.compareTo(a.date));

    num income = 0, expense = 0;
    final byCat = <String, num>{};
    for (final t in periodTx) {
      if (t.isIncome) {
        income += t.amount;
      } else {
        expense += t.amount;
        byCat[t.category] = (byCat[t.category] ?? 0) + t.amount;
      }
    }

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(),
        title: const Text('Báo cáo chi tiêu', style: TextStyle(color: AppColors.slate800, fontWeight: FontWeight.bold, fontSize: 18)),
        iconTheme: const IconThemeData(color: AppColors.slate700),
      ),
      body: txAsync.isLoading && all.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
              children: [
                _periodSelector(),
                if (_period == _Period.custom) ...[const SizedBox(height: 12), _customRange()],
                const SizedBox(height: 16),
                Row(children: [
                  _summaryTile('Thu nhập', income, AppColors.income),
                  const SizedBox(width: 10),
                  _summaryTile('Chi tiêu', expense, AppColors.expense),
                  const SizedBox(width: 10),
                  _summaryTile('Số dư', income - expense, (income - expense) >= 0 ? AppColors.blue : AppColors.expense),
                ]),
                const SizedBox(height: 20),
                _sectionLabel('XU HƯỚNG · ${_periodLabels[_period]!.toUpperCase()}'),
                const SizedBox(height: 8),
                _trendCard(periodTx, start, end),
                const SizedBox(height: 20),
                _sectionLabel('CƠ CẤU CHI TIÊU'),
                const SizedBox(height: 8),
                _breakdown(byCat, expense),
                const SizedBox(height: 20),
                _sectionLabel('GIAO DỊCH GẦN NHẤT'),
                const SizedBox(height: 8),
                _recent(periodTx),
              ],
            ),
    );
  }

  Widget _periodSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: kCardShadow),
      child: Row(children: [
        for (final p in _Period.values)
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _period = p),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 9),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _period == p ? AppColors.brand : Colors.transparent,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Text(_periodLabels[p]!, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _period == p ? Colors.white : AppColors.slate500)),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _customRange() {
    String fmt(DateTime? d) => d == null ? 'Chọn ngày' : '${d.day}/${d.month}/${d.year}';
    Future<void> pick(bool isStart) async {
      final picked = await showDatePicker(
        context: context,
        initialDate: (isStart ? _customStart : _customEnd) ?? DateTime.now(),
        firstDate: DateTime(2020),
        lastDate: DateTime.now().add(const Duration(days: 1)),
      );
      if (picked != null) setState(() => isStart ? _customStart = picked : _customEnd = picked);
    }

    Widget field(String label, bool isStart) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.slate400)),
              const SizedBox(height: 4),
              GestureDetector(
                onTap: () => pick(isStart),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate200)),
                  child: Text(fmt(isStart ? _customStart : _customEnd), style: const TextStyle(fontSize: 13, color: AppColors.slate700)),
                ),
              ),
            ],
          ),
        );
    return Row(children: [field('Từ ngày', true), const SizedBox(width: 10), field('Đến ngày', false)]);
  }

  Widget _sectionLabel(String t) => Text(t, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.slate400, letterSpacing: 1.2));

  Widget _summaryTile(String label, num value, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('${formatCompact(value)}đ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
          ]),
        ),
      );

  Widget _trendCard(List<TransactionModel> txs, DateTime start, DateTime end) {
    final totalDays = end.difference(start).inDays + 1;
    final days = totalDays.clamp(1, 31);
    final step = (totalDays / days).ceil();
    final income = List<double>.filled(days, 0);
    final expense = List<double>.filled(days, 0);
    for (final t in txs) {
      final idx = (t.date.difference(start).inDays / step).floor();
      if (idx < 0 || idx >= days) continue;
      if (t.isIncome) {
        income[idx] += t.amount.toDouble();
      } else {
        expense[idx] += t.amount.toDouble();
      }
    }
    final maxY = [...income, ...expense, 1.0].reduce((a, b) => a > b ? a : b);
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 16, 10, 8),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: kCardShadow),
      child: SizedBox(
        height: 150,
        child: LineChart(LineChartData(
          minY: 0,
          maxY: maxY * 1.2,
          gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: maxY / 2, getDrawingHorizontalLine: (_) => const FlLine(color: AppColors.slate100, strokeWidth: 1)),
          titlesData: const FlTitlesData(
            leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          ),
          borderData: FlBorderData(show: false),
          lineBarsData: [
            _line([for (int i = 0; i < days; i++) FlSpot(i.toDouble(), income[i])], AppColors.incomeLight),
            _line([for (int i = 0; i < days; i++) FlSpot(i.toDouble(), expense[i])], AppColors.expenseLight),
          ],
        )),
      ),
    );
  }

  LineChartBarData _line(List<FlSpot> spots, Color color) => LineChartBarData(
        spots: spots,
        isCurved: true,
        color: color,
        barWidth: 3,
        dotData: const FlDotData(show: false),
        belowBarData: BarAreaData(show: true, gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withValues(alpha: 0.25), color.withValues(alpha: 0)])),
      );

  Widget _breakdown(Map<String, num> byCat, num totalExpense) {
    final rows = byCat.entries.where((e) => e.value > 0).toList()..sort((a, b) => b.value.compareTo(a.value));
    if (rows.isEmpty) {
      return const WhiteCard(padding: EdgeInsets.all(28), child: Center(child: Text('Chưa có dữ liệu chi tiêu', style: TextStyle(color: AppColors.slate400))));
    }
    return WhiteCard(
      child: Column(children: [
        SizedBox(
          height: 180,
          child: PieChart(PieChartData(
            sectionsSpace: 2,
            centerSpaceRadius: 42,
            sections: [for (final r in rows) PieChartSectionData(value: r.value.toDouble(), color: categoryByLabel(r.key).color, radius: 46, showTitle: false)],
          )),
        ),
        const SizedBox(height: 12),
        for (final r in rows) _legendRow(r.key, r.value, totalExpense),
      ]),
    );
  }

  Widget _legendRow(String category, num value, num total) {
    final cat = categoryByLabel(category);
    final pct = total > 0 ? (value / total * 100) : 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        SvgPicture.asset(cat.iconAsset, width: 18, height: 18),
        const SizedBox(width: 10),
        Expanded(child: Text(category, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate700))),
        Text('${formatCompact(value)}đ', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
        const SizedBox(width: 8),
        SizedBox(width: 38, child: Text('${pct.round()}%', textAlign: TextAlign.right, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: cat.color))),
      ]),
    );
  }

  Widget _recent(List<TransactionModel> txs) {
    if (txs.isEmpty) {
      return const WhiteCard(padding: EdgeInsets.all(24), child: Center(child: Text('Không có giao dịch trong kỳ', style: TextStyle(color: AppColors.slate400, fontSize: 13))));
    }
    final show = txs.take(6).toList();
    return WhiteCard(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(children: [
        for (int i = 0; i < show.length; i++) ...[
          TransactionRow(tx: show[i], onTap: () => showTransactionDetailSheet(context, show[i])),
          if (i < show.length - 1) const Divider(height: 1, color: AppColors.slate100, indent: 62),
        ],
      ]),
    );
  }
}
