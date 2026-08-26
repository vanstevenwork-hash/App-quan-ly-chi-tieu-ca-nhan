import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/user.dart';
import '../../models/bank_card.dart';
import '../../state/auth_provider.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/transaction_row.dart';
import '../transactions/transaction_detail_sheet.dart';
import 'spending_trend_chart.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});
  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  bool _hide = true;

  Future<void> _refresh() async {
    refreshFinance(ref);
    try {
      await Future.wait<Object>([
        ref.read(summaryProvider.future),
        ref.read(cardsProvider.future),
        ref.read(transactionsProvider.future),
      ]);
    } catch (_) {
      // Errors surface per-section via AsyncError; refresh just waits.
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final summary = ref.watch(summaryProvider);
    final totals = ref.watch(cardTotalsProvider);
    final txs = ref.watch(transactionsProvider);
    final cards = ref.watch(cardsProvider);

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _refresh,
          color: AppColors.primary,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 120),
            children: [
              _header(user),
              const SizedBox(height: 16),
              _assetCard(summary, totals),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: _tile('Tiết kiệm', totals.valueOrNull?.savings, AppColors.income, Icons.savings_outlined, route: '/accounts')),
                const SizedBox(width: 12),
                Expanded(child: _tile('Dư nợ thẻ', totals.valueOrNull?.debt, AppColors.expense, Icons.credit_card, negative: true, route: '/accounts')),
              ]),
              const SizedBox(height: 20),
              cards.maybeWhen(data: _importantAlerts, orElse: () => const SizedBox.shrink()),
              SectionHeader(
                'Xu hướng thu chi',
                trailing: GestureDetector(
                  onTap: () => context.push('/analytics'),
                  child: Container(
                    width: 28, height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.brandLight.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const UiIcon('arrow_right', size: 15, color: AppColors.brand),
                  ),
                ),
              ),
              txs.when(
                data: (list) => SpendingTrendChart(transactions: list),
                loading: () => const LoadingBox(height: 190),
                error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(transactionsProvider)),
              ),
              const SizedBox(height: 20),
              const SectionHeader('Giao dịch gần đây'),
              txs.when(
                data: (list) => _recent(list),
                loading: () => const LoadingBox(height: 160),
                error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(transactionsProvider)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(User? user) => Row(
        children: [
          Container(
            width: 44, height: 44,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [Color(0xFF8B7CF6), Color(0xFF6C4DE6)]),
            ),
            child: Text(user?.initials ?? 'NN', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(user?.name.isNotEmpty == true ? user!.name : 'Người dùng',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                const Text('Chào mừng trở lại 👋', style: TextStyle(fontSize: 12, color: AppColors.slate400)),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => context.push('/notifications'),
            child: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: AppColors.slate100)),
              alignment: Alignment.center,
              child: const UiIcon('bell', size: 18, color: AppColors.slate500),
            ),
          ),
        ],
      );

  Widget _assetCard(AsyncValue summary, AsyncValue totals) {
    final net = totals.valueOrNull?.netWorth;
    return Container(
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), boxShadow: kCardShadow),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Stack(
          children: [
            // Base lavender gradient
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft, end: Alignment.bottomRight,
                    colors: [Colors.white, Color(0xFFF1ECFF)],
                  ),
                ),
              ),
            ),
            // Aurora glow — deep-purple bloom + bright core in the bottom-right corner
            Positioned(right: -46, bottom: -60, child: _bloom(210, 160, const Color(0xFF6D28D9), 0.42, 42)),
            Positioned(right: 6, bottom: -18, child: _bloom(130, 96, const Color(0xFFA78BFA), 0.55, 18)),
            // Silk light lines
            Positioned(right: 0, bottom: 0, child: IgnorePointer(child: SizedBox(width: 220, height: 96, child: CustomPaint(painter: _SilkPainter())))),
            // Hairline lavender border
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFE4D8FF)),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Text('Tài sản ròng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.slate500)),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () => setState(() => _hide = !_hide),
                      child: UiIcon(_hide ? 'eye_off' : 'eye', size: 17),
                    ),
                  ]),
                  const SizedBox(height: 8),
                  Text(_hide ? '•••••••' : '${net == null ? '—' : formatMoney(net)}đ',
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: AppColors.slate900, letterSpacing: -0.5)),
                  const SizedBox(height: 16),
                  Row(children: [
                    _miniStat('Thu nhập', summary.valueOrNull?.income, AppColors.income, up: true),
                    const SizedBox(width: 22),
                    Container(width: 1, height: 34, color: AppColors.slate200),
                    const SizedBox(width: 22),
                    _miniStat('Chi tiêu', summary.valueOrNull?.expense, AppColors.expense, up: false),
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bloom(double w, double h, Color color, double alpha, double blur) => ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          width: w, height: h,
          decoration: BoxDecoration(
            gradient: RadialGradient(colors: [color.withValues(alpha: alpha), color.withValues(alpha: 0)]),
          ),
        ),
      );

  Widget _miniStat(String label, num? value, Color color, {required bool up}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            UiIcon(up ? 'trending_up' : 'trending_down', size: 14, color: color),
            const SizedBox(width: 4),
            Text(value == null ? '—' : '${up ? '+' : '-'}${formatCompact(value)}',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color)),
          ]),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
        ],
      );

  Widget _tile(String label, num? value, Color color, IconData icon, {bool negative = false, String? route}) => GestureDetector(
        onTap: route != null ? () => context.push(route) : null,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
          child: Row(
            children: [
              Container(
                width: 36, height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)),
                child: Icon(icon, size: 19, color: color),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.slate400, letterSpacing: 0.3)),
                    const SizedBox(height: 2),
                    Text(
                      value == null ? '—' : (_hide ? '••' : '${negative && value > 0 ? '-' : ''}${formatCompact(value)}'),
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color),
                    ),
                  ],
                ),
              ),
              const UiIcon('chevron_right', size: 15, color: AppColors.slate400),
            ],
          ),
        ),
      );

  Widget _importantAlerts(List<BankCard> cards) {
    final alerts = cards.where((c) => c.isCredit && c.balance > 0).take(3).toList();
    if (alerts.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Thông báo quan trọng', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800)),
            Container(
              width: 22, height: 22,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.15), shape: BoxShape.circle),
              child: Text('${alerts.length}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        for (final c in alerts) ...[_alertCard(c), const SizedBox(height: 10)],
        const SizedBox(height: 10),
      ],
    );
  }

  Widget _alertCard(BankCard c) => GestureDetector(
        onTap: () => context.push('/cards/${c.id}'),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
          child: Row(children: [
            Container(
              width: 42, height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: AppColors.expense.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
              child: const Icon(Icons.receipt_long_outlined, size: 20, color: AppColors.expense),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Sao kê ${c.bankShortName}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                  const SizedBox(height: 2),
                  const Text('Cần thanh toán kỳ này', style: TextStyle(fontSize: 11, color: AppColors.slate400)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('${formatMoney(c.balance)}đ', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.expense)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.expense.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                  child: const Text('Cần thanh toán', style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.expense)),
                ),
              ],
            ),
          ]),
        ),
      );

  Widget _recent(List list) {
    if (list.isEmpty) {
      return WhiteCard(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Column(children: const [
            Text('📭', style: TextStyle(fontSize: 28)),
            SizedBox(height: 8),
            Text('Chưa có giao dịch nào', style: TextStyle(color: AppColors.slate400, fontSize: 13)),
          ]),
        ),
      );
    }
    final recent = list.take(8).toList();
    return WhiteCard(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        children: [
          for (int i = 0; i < recent.length; i++) ...[
            TransactionRow(tx: recent[i], onTap: () => showTransactionDetailSheet(context, recent[i])),
            if (i < recent.length - 1) const Divider(height: 1, color: AppColors.slate100, indent: 62),
          ],
        ],
      ),
    );
  }
}

/// Faint "silk" light-lines drawn in the asset card's bottom-right, echoing the
/// web dashboard's aurora accent.
class _SilkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..color = const Color(0xFFC4B5FD).withValues(alpha: 0.45);
    for (int i = 0; i < 4; i++) {
      final y = size.height - 6.0 - i * 13;
      final path = Path()
        ..moveTo(0, size.height + 6)
        ..cubicTo(size.width * 0.35, size.height * 0.72 - i * 7,
            size.width * 0.68, size.height * 0.92 - i * 5, size.width, y);
      paint.strokeWidth = 0.9 - i * 0.15;
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
