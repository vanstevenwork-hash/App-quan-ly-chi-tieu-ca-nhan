import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/statement.dart';
import '../../models/bank_card.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/card_thumb.dart';
import '../../widgets/common.dart';

/// "Lịch sao kê" — port of client/app/(app)/statements/page.tsx: amount due
/// per card (installments included, open statements estimated), weekly
/// totals, and which card gives the longest interest-free period today.
class StatementsScreen extends ConsumerWidget {
  const StatementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(cardsProvider);
    final txAsync = ref.watch(transactionsProvider);

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(fallback: '/accounts'),
        title: const PageTitle('Lịch sao kê', subtitle: 'Chốt sao kê & hạn thanh toán các thẻ'),
      ),
      body: cardsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(cardsProvider)),
        data: (cards) {
          final txs = txAsync.valueOrNull ?? const [];
          final now = DateTime.now();
          final rows = <_Row>[];
          final missing = <BankCard>[];
          for (final c in cards.where((c) => c.isCredit)) {
            if (c.statementDay <= 0 || c.paymentDueDay <= 0) {
              missing.add(c);
              continue;
            }
            final cycle = getCardCycle(c.statementDay, c.paymentDueDay, now);
            rows.add(_Row(c, cycle, statementAmount(c, txs, cycle, now)));
          }
          rows.sort((a, b) => a.cycle.daysToDue.compareTo(b.cycle.daysToDue));
          final upcoming = rows.where((r) => r.amount.amount > 0).toList();
          final total = upcoming.fold<num>(0, (s, r) => s + r.amount.amount);
          final totalInst = upcoming.fold<num>(0, (s, r) => s + r.amount.installment);
          final totalEst = upcoming.where((r) => r.amount.estimated).fold<num>(0, (s, r) => s + r.amount.amount);
          final best = [...rows]..sort((a, b) {
              final d = b.cycle.freeDaysIfSwipedToday.compareTo(a.cycle.freeDaysIfSwipedToday);
              return d != 0 ? d : b.card.cashbackRate.compareTo(a.card.cashbackRate);
            });

          return RefreshIndicator(
            onRefresh: () async => refreshFinance(ref),
            child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
              _hero(total, totalInst, totalEst, upcoming),
              if (best.isNotEmpty) ...[
                const SizedBox(height: 18),
                _title('Nên quẹt thẻ nào hôm nay', trailing: 'miễn lãi lâu nhất'),
                WhiteCard(
                  padding: EdgeInsets.zero,
                  child: Column(children: [
                    for (final (i, r) in best.take(3).indexed)
                      _rowTile(context, r.card,
                          sub: 'Chốt ${_dm(r.cycle.nextClose)} · hạn trả ${_dm(r.cycle.freeUntil)}',
                          trailing: _pill('${r.cycle.freeDaysIfSwipedToday} ngày', i == 0 ? AppColors.income : AppColors.slate400),
                          divider: i > 0),
                  ]),
                ),
              ],
              const SizedBox(height: 18),
              _title('Tất cả thẻ (${rows.length + missing.length})', trailing: 'gần hạn nhất trước'),
              WhiteCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final (i, r) in rows.indexed)
                    _rowTile(context, r.card,
                        sub: 'Chốt ngày ${r.card.statementDay} · Hạn ngày ${r.card.paymentDueDay}'
                            '${r.amount.installment > 0 ? '\ngồm góp ${formatCompact(r.amount.installment)}₫' : ''}',
                        trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text(r.amount.amount > 0 ? '${r.amount.estimated ? '~' : ''}${formatCompact(r.amount.amount)}₫' : '—',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold,
                                  color: r.amount.amount > 0 ? AppColors.slate800 : AppColors.slate200)),
                          if (r.amount.amount > 0 && r.amount.estimated)
                            const Text('dự kiến', style: TextStyle(fontSize: 10, color: AppColors.slate400)),
                          const SizedBox(height: 3),
                          _pill(r.cycle.daysToDue == 0 ? 'Hôm nay' : '${r.cycle.daysToDue} ngày', _urgency(r.cycle.daysToDue)),
                        ]),
                        divider: i > 0),
                  for (final (i, c) in missing.indexed)
                    _rowTile(context, c,
                        sub: 'Thiếu ${c.statementDay <= 0 && c.paymentDueDay <= 0 ? 'ngày chốt & ngày thanh toán' : c.statementDay <= 0 ? 'ngày chốt sao kê' : 'ngày thanh toán'}',
                        subColor: AppColors.gold,
                        trailing: const Text('Bổ sung ›', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary)),
                        divider: rows.isNotEmpty || i > 0),
                  if (rows.isEmpty && missing.isEmpty)
                    const Padding(padding: EdgeInsets.all(24), child: Text('Chưa có thẻ tín dụng nào', style: TextStyle(color: AppColors.slate400, fontSize: 12))),
                ]),
              ),
            ]),
          );
        },
      ),
    );
  }

  static String _dm(DateTime d) => '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
  static Color _urgency(int days) => days <= 3 ? AppColors.expense : days <= 7 ? AppColors.gold : AppColors.slate400;

  Widget _hero(num total, num inst, num est, List<_Row> upcoming) {
    final nearest = upcoming.isEmpty ? null : upcoming.first;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(colors: [Color(0xFF7C5CF0), Color(0xFF5B3FD0), Color(0xFF2E2A7A)], stops: [0, 0.55, 1]),
      ),
      child: DefaultTextStyle(
        style: const TextStyle(color: Colors.white),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Cần thanh toán sắp tới', style: TextStyle(fontSize: 12, color: Colors.white70)),
          const SizedBox(height: 4),
          Text('${formatMoney(total)}₫', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
          if (inst > 0 || est > 0)
            Text(
              [if (inst > 0) 'gồm ${formatMoney(inst)}₫ trả góp', if (est > 0) '${formatMoney(est)}₫ dự kiến (kỳ chưa chốt)'].join(' · '),
              style: const TextStyle(fontSize: 11, color: Colors.white70),
            ),
          const SizedBox(height: 8),
          Text(
            nearest == null
                ? 'Không có khoản nào đến hạn'
                : '${upcoming.length} thẻ · gần nhất ${_dm(nearest.cycle.dueDate)} (${nearest.cycle.daysToDue == 0 ? 'hôm nay' : 'còn ${nearest.cycle.daysToDue} ngày'})',
            style: const TextStyle(fontSize: 12, color: Colors.white),
          ),
        ]),
      ),
    );
  }

  Widget _title(String t, {String? trailing}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(t, style: AppText.section),
          const Spacer(),
          if (trailing != null) Text(trailing, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
        ]),
      );

  Widget _pill(String t, Color c) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
        child: Text(t, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: c)),
      );

  Widget _rowTile(BuildContext context, BankCard c, {required String sub, required Widget trailing, bool divider = false, Color subColor = AppColors.slate400}) {
    return InkWell(
      onTap: () => context.push('/cards/${c.id}'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: divider ? const BoxDecoration(border: Border(top: BorderSide(color: AppColors.slate100))) : null,
        child: Row(children: [
          CardThumb(card: c, size: CardThumbSize.md, showLast4: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName} •••• ${c.cardNumber}',
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              const SizedBox(height: 2),
              Text(sub, style: TextStyle(fontSize: 11, color: subColor, height: 1.35)),
            ]),
          ),
          const SizedBox(width: 8),
          trailing,
        ]),
      ),
    );
  }
}

class _Row {
  final BankCard card;
  final CardCycle cycle;
  final StatementAmount amount;
  const _Row(this.card, this.cycle, this.amount);
}
