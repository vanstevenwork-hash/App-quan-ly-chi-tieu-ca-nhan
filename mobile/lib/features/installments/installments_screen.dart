import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/statement.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/card_thumb.dart';
import '../../widgets/common.dart';

/// "Trả góp thẻ tín dụng" — port of client/app/(app)/installments/page.tsx:
/// due this month, outstanding / count / end month, plan list with progress
/// (Tất cả · Đang trả · Đã hoàn tất), month-by-month schedule, cards with plans.
class InstallmentsScreen extends ConsumerStatefulWidget {
  const InstallmentsScreen({super.key});

  @override
  ConsumerState<InstallmentsScreen> createState() => _InstallmentsScreenState();
}

enum _Tab { all, active, done }

class _InstallmentsScreenState extends ConsumerState<InstallmentsScreen> {
  _Tab _tab = _Tab.all;
  bool _allMonths = false;

  static String _p2(int n) => n.toString().padLeft(2, '0');
  static String _my(DateTime d) => '${_p2(d.month)}/${d.year}';

  @override
  Widget build(BuildContext context) {
    final cards = ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[];
    final txs = ref.watch(transactionsProvider).valueOrNull ?? const <TransactionModel>[];
    final now = DateTime.now();
    final credit = cards.where((c) => c.isCredit).toList();
    final byId = {for (final c in credit) c.id: c};

    final all = allInstallmentPlans(txs, byId.keys, now, includeCompleted: true)
      ..sort((a, b) => b.startDate.compareTo(a.startDate));
    final active = all.where((p) => p.remaining > 0).toList();
    final done = all.where((p) => p.remaining == 0).toList();
    final shown = switch (_tab) { _Tab.all => all, _Tab.active => active, _Tab.done => done };

    final maxRemaining = active.fold<int>(0, (m, p) => p.remaining > m ? p.remaining : m);
    final schedule = installmentSchedule(active, maxRemaining == 0 ? 1 : maxRemaining, now);
    final thisMonth = schedule.first.amount;
    final outstanding = schedule.fold<num>(0, (s, m) => s + m.amount);
    DateTime? lastEnd;
    for (final p in active) {
      final e = planEnd(p);
      if (lastEnd == null || e.isAfter(lastEnd)) lastEnd = e;
    }
    // Nearest due date among cards currently carrying an installment.
    DateTime? dueDate;
    for (final p in active) {
      final day = byId[p.cardId]?.paymentDueDay ?? 0;
      if (day <= 0) continue;
      final today = DateTime(now.year, now.month, now.day);
      var d = dayOfMonth(now.year, now.month, day);
      if (d.isBefore(today)) d = dayOfMonth(now.year, now.month + 1, day);
      if (dueDate == null || d.isBefore(dueDate)) dueDate = d;
    }
    final single = active.length == 1 ? active.first : null;
    final months = _allMonths ? schedule : schedule.take(3).toList();
    final countByCard = <String, int>{};
    for (final p in all) {
      countByCard[p.cardId] = (countByCard[p.cardId] ?? 0) + 1;
    }

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(),
        title: const PageTitle('Trả góp thẻ tín dụng', subtitle: 'Quản lý các khoản trả góp của bạn'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => refreshFinance(ref),
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
          // Hero
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              gradient: const LinearGradient(colors: [Color(0xFF7C5CF0), Color(0xFF5B3FD0), Color(0xFF2E2A7A)], stops: [0, 0.55, 1]),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Phải trả tháng này', style: TextStyle(fontSize: 12, color: Colors.white70)),
              const SizedBox(height: 4),
              Text('${formatMoney(thisMonth)}₫', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.calendar_today_outlined, size: 15, color: Colors.white),
                const SizedBox(width: 6),
                Text('Đến hạn: ${dueDate == null ? '—' : '${_p2(dueDate.day)}/${_p2(dueDate.month)}/${dueDate.year}'}',
                    style: const TextStyle(fontSize: 12, color: Colors.white)),
              ]),
            ]),
          ),
          const SizedBox(height: 12),
          Row(children: [
            _stat('Còn phải trả', '${formatMoney(outstanding)}₫'),
            const SizedBox(width: 8),
            _stat('Số khoản', '${active.length}'),
            const SizedBox(width: 8),
            _stat('Kết thúc', lastEnd == null ? '—' : _my(lastEnd)),
          ]),
          const SizedBox(height: 16),
          // Tabs
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              for (final (t, label, n) in [(_Tab.all, 'Tất cả', all.length), (_Tab.active, 'Đang trả', active.length), (_Tab.done, 'Đã hoàn tất', -1)])
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _tab = t),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: _tab == t ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(9)),
                      child: Text(n >= 0 ? '$label ($n)' : label,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _tab == t ? AppColors.brand : AppColors.slate400)),
                    ),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 12),
          if (shown.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 36),
              child: Center(child: Text('Chưa có khoản trả góp nào', style: TextStyle(color: AppColors.slate400, fontSize: 13))),
            ),
          for (final p in shown) _planCard(p, byId[p.cardId]),
          if (active.isNotEmpty) ...[
            const SizedBox(height: 8),
            const Text('Lịch trả góp', style: AppText.section),
            const SizedBox(height: 8),
            WhiteCard(
              padding: EdgeInsets.zero,
              child: Column(children: [
                for (final (i, m) in months.indexed)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: i == 0 ? AppColors.primary.withValues(alpha: 0.06) : null,
                      border: i > 0 ? const Border(top: BorderSide(color: AppColors.slate100)) : null,
                    ),
                    child: Row(children: [
                      Text('Tháng ${_my(m.month)}', style: TextStyle(fontSize: 13, fontWeight: i == 0 ? FontWeight.bold : FontWeight.w600, color: AppColors.slate800)),
                      Text(single != null ? ' · Kỳ ${single.paid + i + 1}/${single.months}' : ' · ${m.planCount} khoản',
                          style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                      const Spacer(),
                      Text('${formatMoney(m.amount)}₫', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: i == 0 ? AppColors.primary : AppColors.slate800)),
                    ]),
                  ),
                if (schedule.length > 3)
                  TextButton(
                    onPressed: () => setState(() => _allMonths = !_allMonths),
                    child: Text(_allMonths ? 'Thu gọn' : 'Xem tất cả ${schedule.length} tháng'),
                  ),
              ]),
            ),
          ],
          if (credit.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Các thẻ có trả góp', style: AppText.section),
            const SizedBox(height: 8),
            for (final c in credit)
              GestureDetector(
                onTap: () => context.push('/cards/${c.id}'),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: kCardShadow),
                  child: Row(children: [
                    CardThumb(card: c, size: CardThumbSize.lg),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(c.bankShortName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                        Text('•••• ${c.cardNumber}', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                      ]),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: (countByCard[c.id] ?? 0) > 0 ? AppColors.primary.withValues(alpha: 0.1) : AppColors.slate100,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text('${countByCard[c.id] ?? 0} khoản',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: (countByCard[c.id] ?? 0) > 0 ? AppColors.primary : AppColors.slate400)),
                    ),
                  ]),
                ),
              ),
          ],
        ]),
      ),
    );
  }

  Widget _stat(String label, String value) => Expanded(
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: kCardShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
            const SizedBox(height: 2),
            Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          ]),
        ),
      );

  Widget _planCard(InstallmentPlan p, BankCard? card) {
    final done = p.remaining == 0;
    final pct = p.months == 0 ? 0.0 : p.paid / p.months;
    final title = p.tx.note.isNotEmpty ? p.tx.note : p.tx.category;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
      child: Column(children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (card != null) CardThumb(card: card, size: CardThumbSize.lg, showLast4: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: done ? AppColors.slate100 : const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(20)),
                  child: Text(done ? 'Hoàn tất' : 'Đang trả',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: done ? AppColors.slate400 : AppColors.income)),
                ),
              ]),
              Text('Trả góp 0% · ${p.months} tháng · ${formatMoney(p.total)}₫', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
            ]),
          ),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(value: pct, minHeight: 6, backgroundColor: AppColors.slate100, valueColor: const AlwaysStoppedAnimation(AppColors.primary)),
        ),
        const SizedBox(height: 6),
        Row(children: [
          Text('Đã trả ${p.paid}/${p.months} kỳ', style: const TextStyle(fontSize: 11, color: AppColors.slate500)),
          const Spacer(),
          Text(done ? 'Đã tất toán' : 'Còn ${p.remaining} kỳ', style: const TextStyle(fontSize: 11, color: AppColors.slate500)),
        ]),
        const Divider(height: 18, color: AppColors.slate100),
        Row(children: [
          Text(done ? 'Tổng đã trả' : 'Phải trả tháng này', style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
          const Spacer(),
          Text('${formatMoney(done ? p.total : planCurrentSlice(p))} ₫', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
        ]),
      ]),
    );
  }
}
