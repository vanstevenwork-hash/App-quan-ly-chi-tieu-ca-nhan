import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/transaction_row.dart';
import '../transactions/transaction_detail_sheet.dart';

const _months = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];
const _weekdayHeaders = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

String _fmtCell(num n) {
  if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}tr';
  if (n >= 1000) return '${(n / 1000).round()}k';
  return '${n.round()}';
}

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});
  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late int _month; // 1-12
  late int _year;
  int? _selectedDay;
  String _filter = 'all'; // all | expense | income

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = now.month;
    _year = now.year;
    _selectedDay = now.day;
  }

  void _prevMonth() => setState(() {
        if (_month == 1) {
          _month = 12;
          _year--;
        } else {
          _month--;
        }
        _selectedDay = null;
      });

  void _nextMonth() => setState(() {
        if (_month == 12) {
          _month = 1;
          _year++;
        } else {
          _month++;
        }
        _selectedDay = null;
      });

  @override
  Widget build(BuildContext context) {
    final txAsync = ref.watch(transactionsProvider);
    final all = txAsync.valueOrNull ?? const <TransactionModel>[];

    // Aggregate this month's transactions per day.
    final byDay = <int, ({num expense, num income, List<TransactionModel> txs})>{};
    for (final t in all) {
      if (t.date.month != _month || t.date.year != _year) continue;
      final d = t.date.day;
      final cur = byDay[d] ?? (expense: 0, income: 0, txs: <TransactionModel>[]);
      byDay[d] = (
        expense: cur.expense + (t.isIncome ? 0 : t.amount),
        income: cur.income + (t.isIncome ? t.amount : 0),
        txs: cur.txs..add(t),
      );
    }
    num mExpense = 0, mIncome = 0;
    for (final e in byDay.values) {
      mExpense += e.expense;
      mIncome += e.income;
    }
    final total = mExpense + mIncome;
    final expensePct = total > 0 ? (mExpense / total * 100) : 0.0;

    final now = DateTime.now();
    bool isToday(int d) => d == now.day && _month == now.month && _year == now.year;

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: SafeArea(
        bottom: false,
        child: txAsync.isLoading && all.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
                children: [
                  _monthHeader(),
                  const SizedBox(height: 16),
                  _summaryCard(mExpense, mIncome, expensePct),
                  const SizedBox(height: 16),
                  _filterTabs(),
                  const SizedBox(height: 14),
                  _grid(byDay, isToday),
                  const SizedBox(height: 20),
                  _selectedPanel(byDay),
                ],
              ),
      ),
    );
  }

  Widget _monthHeader() => Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('LỊCH GIAO DỊCH', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.slate400, letterSpacing: 1)),
                const SizedBox(height: 2),
                Text('${_months[_month - 1]}, $_year',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              ],
            ),
          ),
          _navBtn(Icons.chevron_left, _prevMonth),
          const SizedBox(width: 8),
          _navBtn(Icons.chevron_right, _nextMonth),
        ],
      );

  Widget _navBtn(IconData icon, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40, height: 40,
          decoration: const BoxDecoration(color: AppColors.slate100, shape: BoxShape.circle),
          child: Icon(icon, size: 22, color: AppColors.slate500),
        ),
      );

  Widget _summaryCard(num expense, num income, double expensePct) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: kCardShadow),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Container(
                      width: 26, height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: AppColors.expense.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                      child: const UiIcon('trending_down', size: 13, color: AppColors.expense),
                    ),
                    const SizedBox(width: 6),
                    const Text('Chi tiêu', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.slate500)),
                  ]),
                  const SizedBox(height: 6),
                  Text('đ${formatMoney(expense)}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.slate800)),
                ],
              ),
            ),
            SizedBox(width: 92, height: 92, child: _Donut(expensePct: expensePct)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    const Text('Thu nhập', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.slate500)),
                    const SizedBox(width: 6),
                    Container(
                      width: 26, height: 26,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: AppColors.income.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                      child: const UiIcon('trending_up', size: 13, color: AppColors.income),
                    ),
                  ]),
                  const SizedBox(height: 6),
                  Text('đ${formatMoney(income)}',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.slate800)),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _filterTabs() {
    const items = [(v: 'all', l: 'Tất cả'), (v: 'expense', l: 'Chi tiêu'), (v: 'income', l: 'Thu nhập')];
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        for (final it in items)
          Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _filter = it.v),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _filter == it.v ? Colors.white : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: _filter == it.v ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 5)] : null,
                ),
                child: Text(it.l, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _filter == it.v ? AppColors.primary : AppColors.slate400)),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _grid(Map<int, ({num expense, num income, List<TransactionModel> txs})> byDay, bool Function(int) isToday) {
    final first = DateTime(_year, _month, 1);
    final startOffset = (first.weekday + 6) % 7; // Monday-first, 0-based
    final daysInMonth = DateTime(_year, _month + 1, 0).day;
    final totalCells = ((startOffset + daysInMonth) / 7).ceil() * 7;

    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: kCardShadow),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Row(
            children: [
              for (int i = 0; i < 7; i++)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Text(_weekdayHeaders[i],
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: i == 6 ? AppColors.expense.withValues(alpha: 0.7) : AppColors.slate400)),
                  ),
                ),
            ],
          ),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, childAspectRatio: 0.68),
            itemCount: totalCells,
            itemBuilder: (_, i) {
              final day = i - startOffset + 1;
              if (day < 1 || day > daysInMonth) return const SizedBox.shrink();
              return _dayCell(day, byDay[day], isToday(day));
            },
          ),
        ],
      ),
    );
  }

  Widget _dayCell(int day, ({num expense, num income, List<TransactionModel> txs})? data, bool today) {
    final selected = _selectedDay == day;
    final showExp = (_filter == 'all' || _filter == 'expense') && (data?.expense ?? 0) > 0;
    final showInc = (_filter == 'all' || _filter == 'income') && (data?.income ?? 0) > 0;
    return GestureDetector(
      onTap: () => setState(() => _selectedDay = day),
      child: Container(
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: selected ? AppColors.brandLight.withValues(alpha: 0.25) : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: selected ? Border.all(color: AppColors.primary.withValues(alpha: 0.5), width: 1.5) : null,
        ),
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          children: [
            Text('$day',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: (selected || today) ? FontWeight.w800 : FontWeight.w600,
                  color: (selected || today) ? AppColors.primary : AppColors.slate500,
                )),
            const SizedBox(height: 2),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (showExp)
                    Text('-${_fmtCell(data!.expense)}',
                        style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: AppColors.expense), maxLines: 1),
                  if (showInc)
                    Text('+${_fmtCell(data!.income)}',
                        style: const TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: AppColors.income), maxLines: 1),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _selectedPanel(Map<int, ({num expense, num income, List<TransactionModel> txs})> byDay) {
    final day = _selectedDay;
    if (day == null) return const SizedBox.shrink();
    final data = byDay[day];
    var txs = data?.txs ?? const <TransactionModel>[];
    if (_filter != 'all') txs = txs.where((t) => t.type == _filter).toList();
    txs = [...txs]..sort((a, b) => b.date.compareTo(a.date));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Text('Ngày $day/$_month/$_year',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate700)),
          const SizedBox(width: 8),
          if (txs.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(20)),
              child: Text('${txs.length} giao dịch', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.brand)),
            ),
        ]),
        const SizedBox(height: 10),
        if (txs.isEmpty)
          WhiteCard(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Text('📅', style: TextStyle(fontSize: 26)),
                const SizedBox(height: 8),
                Text(
                  _filter != 'all'
                      ? 'Không có giao dịch ${_filter == 'expense' ? 'chi tiêu' : 'thu nhập'} ngày này'
                      : 'Chưa có giao dịch ngày này',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.slate400, fontSize: 13),
                ),
              ]),
            ),
          )
        else
          WhiteCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(children: [
              for (int i = 0; i < txs.length; i++) ...[
                TransactionRow(tx: txs[i], onTap: () => showTransactionDetailSheet(context, txs[i])),
                if (i < txs.length - 1) const Divider(height: 1, color: AppColors.slate100, indent: 62),
              ],
            ]),
          ),
      ],
    );
  }
}

/// Two-arc donut (expense vs income) with the expense-% in the centre — mirrors
/// the web calendar's DonutChart.
class _Donut extends StatelessWidget {
  final double expensePct;
  const _Donut({required this.expensePct});

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        CustomPaint(size: const Size.square(92), painter: _DonutPainter(expensePct)),
        Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('${expensePct.round()}%',
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: AppColors.slate800)),
            const Text('Chi tiêu', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w600, color: AppColors.slate400)),
          ],
        ),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  final double expensePct;
  _DonutPainter(this.expensePct);

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 6;
    final rect = Rect.fromCircle(center: c, radius: r);
    const stroke = 9.0;
    const gap = 0.18; // radians

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = AppColors.slate100;
    canvas.drawCircle(c, r, track);

    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    final expSweep = (expensePct / 100) * 2 * math.pi;
    final incSweep = 2 * math.pi - expSweep;
    const start = -math.pi / 2;

    p.color = const Color(0xFF8B5CF6);
    if (expSweep > gap) canvas.drawArc(rect, start + gap / 2, expSweep - gap, false, p);
    p.color = AppColors.income;
    if (incSweep > gap) canvas.drawArc(rect, start + expSweep + gap / 2, incSweep - gap, false, p);
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) => old.expensePct != expensePct;
}
