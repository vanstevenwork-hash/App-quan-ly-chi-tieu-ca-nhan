import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../models/transaction.dart';
import '../../theme/app_theme.dart';

/// Income vs expense trend with a Tuần/Tháng/Năm range switch, mirroring the
/// web dashboard's recharts AreaChart.
class SpendingTrendChart extends StatefulWidget {
  final List<TransactionModel> transactions;
  const SpendingTrendChart({super.key, required this.transactions});
  @override
  State<SpendingTrendChart> createState() => _SpendingTrendChartState();
}

enum _Range { week, month, year }

class _Bucket {
  final String label;
  double income = 0, expense = 0;
  _Bucket(this.label);
}

class _SpendingTrendChartState extends State<SpendingTrendChart> {
  _Range _range = _Range.week;

  List<_Bucket> _buckets() {
    final now = DateTime.now();
    if (_range == _Range.year) {
      final list = List.generate(12, (i) {
        final d = DateTime(now.year, now.month - (11 - i), 1);
        return (bucket: _Bucket(i == 11 ? 'Nay' : 'T${d.month}'), key: '${d.year}-${d.month}');
      });
      final byKey = {for (final e in list) e.key: e.bucket};
      for (final t in widget.transactions) {
        final b = byKey['${t.date.year}-${t.date.month}'];
        if (b == null) continue;
        if (t.isIncome) {
          b.income += t.amount.toDouble();
        } else {
          b.expense += t.amount.toDouble();
        }
      }
      return list.map((e) => e.bucket).toList();
    }
    final days = _range == _Range.week ? 7 : 30;
    final list = List.generate(days, (i) {
      final d = DateTime(now.year, now.month, now.day - (days - 1 - i));
      return (bucket: _Bucket(i == days - 1 ? 'Nay' : '${d.day}/${d.month}'), key: '${d.year}-${d.month}-${d.day}');
    });
    final byKey = {for (final e in list) e.key: e.bucket};
    for (final t in widget.transactions) {
      final b = byKey['${t.date.year}-${t.date.month}-${t.date.day}'];
      if (b == null) continue;
      if (t.isIncome) {
        b.income += t.amount.toDouble();
      } else {
        b.expense += t.amount.toDouble();
      }
    }
    return list.map((e) => e.bucket).toList();
  }

  @override
  Widget build(BuildContext context) {
    final data = _buckets();
    final maxY = [
      ...data.map((b) => b.income),
      ...data.map((b) => b.expense),
      1.0,
    ].reduce((a, b) => a > b ? a : b);
    final tickEvery = _range == _Range.week ? 1 : (_range == _Range.month ? 5 : 1);

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF3F4F6)),
        boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 10, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Range segmented control
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.slate200.withValues(alpha: 0.7)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _rangeTab('Tuần', _Range.week),
                _rangeTab('Tháng', _Range.month),
                _rangeTab('Năm', _Range.year),
              ],
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 118,
            child: LineChart(
              LineChartData(
                minY: 0,
                maxY: maxY * 1.2,
                gridData: FlGridData(show: true, drawVerticalLine: false, horizontalInterval: maxY * 1.2 / 2, getDrawingHorizontalLine: (_) => const FlLine(color: AppColors.slate100, strokeWidth: 1)),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      interval: maxY * 1.2 / 2,
                      getTitlesWidget: (v, meta) => v == meta.max
                          ? const SizedBox.shrink()
                          : Text(v <= 0 ? '0' : formatCompact(v), style: const TextStyle(fontSize: 9, color: AppColors.slate400)),
                    ),
                  ),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 1,
                      getTitlesWidget: (value, meta) {
                        final i = value.toInt();
                        if (i < 0 || i >= data.length) return const SizedBox.shrink();
                        final isLast = i == data.length - 1;
                        if (!isLast && i % tickEvery != 0) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(data[i].label,
                              style: TextStyle(fontSize: 9, fontWeight: isLast ? FontWeight.bold : FontWeight.normal, color: isLast ? AppColors.primary : AppColors.slate400)),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineTouchData: const LineTouchData(enabled: true),
                lineBarsData: [
                  _line([for (int i = 0; i < data.length; i++) FlSpot(i.toDouble(), data[i].income)], AppColors.incomeLight),
                  _line([for (int i = 0; i < data.length; i++) FlSpot(i.toDouble(), data[i].expense)], AppColors.expenseLight),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _rangeTab(String label, _Range r) {
    final active = _range == r;
    return GestureDetector(
      onTap: () => setState(() => _range = r),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: active ? AppColors.brand : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          boxShadow: active ? [BoxShadow(color: AppColors.brand.withValues(alpha: 0.3), blurRadius: 6, offset: const Offset(0, 2))] : null,
        ),
        child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: active ? Colors.white : AppColors.slate500)),
      ),
    );
  }

  LineChartBarData _line(List<FlSpot> spots, Color color) => LineChartBarData(
        spots: spots,
        isCurved: true,
        preventCurveOverShooting: true,
        color: color,
        barWidth: 3,
        dotData: const FlDotData(show: false),
        belowBarData: BarAreaData(
          show: true,
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [color.withValues(alpha: 0.28), color.withValues(alpha: 0)]),
        ),
      );
}
