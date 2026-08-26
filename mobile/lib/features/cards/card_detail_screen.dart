import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/back_button.dart';
import '../../widgets/transaction_row.dart';
import '../transactions/transaction_detail_sheet.dart';
import 'card_form_sheet.dart';
import 'pay_card_sheet.dart';

class CardDetailScreen extends ConsumerWidget {
  final String cardId;
  const CardDetailScreen({super.key, required this.cardId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(cardsProvider);
    final txAsync = ref.watch(transactionsProvider);

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(),
        title: const Text('Chi tiết thẻ',
            style: TextStyle(color: AppColors.slate800, fontWeight: FontWeight.bold, fontSize: 18)),
        iconTheme: const IconThemeData(color: AppColors.slate700),
      ),
      body: cardsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(cardsProvider)),
        data: (cards) {
          final card = cards.where((c) => c.id == cardId).firstOrNull;
          if (card == null) {
            return const Center(child: Text('Không tìm thấy thẻ', style: TextStyle(color: AppColors.slate400)));
          }
          final txs = txAsync.valueOrNull ?? const <TransactionModel>[];
          final cardTxs = txs.where((t) => t.cardId == cardId).toList()
            ..sort((a, b) => b.date.compareTo(a.date));
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
            children: [
              _cardVisual(card),
              const SizedBox(height: 20),
              if (card.isCredit) _creditStats(card) else _balanceStat(card),
              if (card.isCredit && (card.cashbackRate > 0 || card.statementDay > 0)) ...[
                const SizedBox(height: 12),
                _extras(card, cardTxs),
              ],
              const SizedBox(height: 20),
              _infoRow(card),
              const SizedBox(height: 16),
              _actionButtons(context, ref, card),
              const SizedBox(height: 24),
              Row(children: [
                const Text('Lịch sử giao dịch',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate400, letterSpacing: 1)),
                const Spacer(),
                Text('${cardTxs.length} giao dịch', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
              ]),
              const SizedBox(height: 10),
              if (cardTxs.isEmpty)
                const WhiteCard(
                  padding: EdgeInsets.all(24),
                  child: Center(child: Text('Chưa có giao dịch trên thẻ này', style: TextStyle(color: AppColors.slate400, fontSize: 13))),
                )
              else
                WhiteCard(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Column(children: [
                    for (int i = 0; i < cardTxs.length; i++) ...[
                      TransactionRow(tx: cardTxs[i], onTap: () => showTransactionDetailSheet(context, cardTxs[i])),
                      if (i < cardTxs.length - 1) const Divider(height: 1, color: AppColors.slate100, indent: 62),
                    ],
                  ]),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _actionButtons(BuildContext context, WidgetRef ref, BankCard card) {
    Future<void> delete() async {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Xóa thẻ?'),
          content: Text('Thẻ ${card.bankShortName} sẽ bị xóa. Giao dịch cũ vẫn giữ.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
            TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Xóa', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold))),
          ],
        ),
      );
      if (ok != true) return;
      try {
        await ref.read(financeServiceProvider).deleteCard(card.id);
        ref.invalidate(cardsProvider);
        if (context.mounted) Navigator.of(context).pop();
      } catch (_) {
        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Xóa thất bại')));
      }
    }

    final editDelete = Row(children: [
      Expanded(child: _btn('Sửa', Icons.edit_outlined, AppColors.brand, () => showCardFormSheet(context, initial: card))),
      const SizedBox(width: 12),
      Expanded(child: _btn('Xóa', Icons.delete_outline, AppColors.expense, delete, tonal: true)),
    ]);

    if (!card.isCredit) return editDelete;
    return Column(children: [
      GestureDetector(
        onTap: () => showPayCardSheet(context, card),
        child: Container(
          height: 50,
          alignment: Alignment.center,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), color: AppColors.income),
          child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(Icons.payments_outlined, size: 18, color: Colors.white),
            SizedBox(width: 8),
            Text('Trả thẻ', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      editDelete,
    ]);
  }

  Widget _btn(String label, IconData icon, Color color, VoidCallback onTap, {bool tonal = false}) => GestureDetector(
        onTap: onTap,
        child: Container(
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: tonal ? color.withValues(alpha: 0.1) : Colors.white,
            border: tonal ? null : Border.all(color: AppColors.slate200),
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14)),
          ]),
        ),
      );

  Widget _cardVisual(BankCard c) {
    final base = hexColor(c.color, fallback: AppColors.brand);
    final label = switch (c.cardType) {
      'credit' => 'THẺ TÍN DỤNG',
      'debit' => 'THẺ GHI NỢ',
      'savings' => 'SỔ TIẾT KIỆM',
      'eWallet' => 'VÍ ĐIỆN TỬ',
      _ => 'TÀI KHOẢN',
    };
    return AspectRatio(
      aspectRatio: 1.6,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [base, Color.lerp(base, Colors.black, 0.35)!],
          ),
          boxShadow: [BoxShadow(color: base.withValues(alpha: 0.4), blurRadius: 24, offset: const Offset(0, 12))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName,
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                const Spacer(),
                Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1)),
              ],
            ),
            const Spacer(),
            Container(width: 42, height: 30, decoration: BoxDecoration(color: const Color(0xFFF4D06F), borderRadius: BorderRadius.circular(6))),
            const SizedBox(height: 14),
            Text('••••  ••••  ••••  ${c.cardNumber}',
                style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600, letterSpacing: 2)),
            const SizedBox(height: 10),
            Text(c.cardHolder.isNotEmpty ? c.cardHolder.toUpperCase() : 'CHỦ THẺ',
                style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12, fontWeight: FontWeight.w600, letterSpacing: 1)),
          ],
        ),
      ),
    );
  }

  Widget _creditStats(BankCard c) {
    final used = c.balance.toDouble();
    final limit = c.creditLimit.toDouble();
    final avail = (limit - used).clamp(0, double.infinity);
    final pct = limit > 0 ? (used / limit).clamp(0.0, 1.0) : 0.0;
    final over = pct > 0.9;
    return WhiteCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            _stat('Dư nợ hiện tại', '${formatMoney(c.balance)}đ', AppColors.expense),
            _stat('Khả dụng', '${formatMoney(avail)}đ', AppColors.income, right: true),
          ]),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: AppColors.slate100,
              valueColor: AlwaysStoppedAnimation(over ? AppColors.expense : AppColors.brand),
            ),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Text('Đã dùng ${(pct * 100).round()}%',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: over ? AppColors.expense : AppColors.slate500)),
            const Spacer(),
            Text('Hạn mức ${formatCompact(c.creditLimit)}đ', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
          ]),
        ],
      ),
    );
  }

  Widget _extras(BankCard c, List<TransactionModel> cardTxs) {
    final now = DateTime.now();
    final monthExpense = cardTxs
        .where((t) => !t.isIncome && t.date.year == now.year && t.date.month == now.month)
        .fold<num>(0, (s, t) => s + t.amount);
    final cashback = monthExpense * c.cashbackRate / 100;
    return IntrinsicHeight(
      child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (c.cashbackRate > 0)
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(colors: [Color(0xFFECFDF5), Color(0xFFD1FAE5)]),
                border: Border.all(color: const Color(0xFFA7F3D0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    const Text('🪙', style: TextStyle(fontSize: 14)),
                    const SizedBox(width: 6),
                    Text('Hoàn tiền ${c.cashbackRate}%',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                  ]),
                  const SizedBox(height: 8),
                  Text('+${formatMoney(cashback)}đ',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF059669))),
                  const Text('tháng này', style: TextStyle(fontSize: 10, color: Color(0xFF6B7280))),
                ],
              ),
            ),
          ),
        if (c.cashbackRate > 0 && c.statementDay > 0) const SizedBox(width: 12),
        if (c.statementDay > 0 || c.paymentDueDay > 0)
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.slate100)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Kỳ sao kê', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate500)),
                  const SizedBox(height: 8),
                  if (c.statementDay > 0) _dayLine('Ngày sao kê', c.statementDay, AppColors.blue),
                  if (c.paymentDueDay > 0) ...[
                    const SizedBox(height: 4),
                    _dayLine('Hạn thanh toán', c.paymentDueDay, AppColors.expense),
                  ],
                ],
              ),
            ),
          ),
      ],
    ),
    );
  }

  Widget _dayLine(String label, int day, Color color) => Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.slate400))),
          Text('Ngày $day', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color)),
        ],
      );

  Widget _balanceStat(BankCard c) => WhiteCard(
        child: Column(children: [
          const Text('Số dư', style: TextStyle(fontSize: 12, color: AppColors.slate400)),
          const SizedBox(height: 6),
          Text('${formatMoney(c.balance)}đ',
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: AppColors.slate800)),
        ]),
      );

  Widget _stat(String label, String value, Color color, {bool right = false}) => Expanded(
        child: Column(
          crossAxisAlignment: right ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      );

  Widget _infoRow(BankCard c) => WhiteCard(
        child: Column(children: [
          _info('Ngân hàng', c.bankName.isNotEmpty ? c.bankName : c.bankShortName),
          const Divider(height: 18, color: AppColors.slate100),
          _info('Chủ thẻ', c.cardHolder.isNotEmpty ? c.cardHolder : '—'),
          if (c.isCredit && c.interestRate > 0) ...[
            const Divider(height: 18, color: AppColors.slate100),
            _info('Lãi suất', '${c.interestRate}%/năm'),
          ],
          if (c.isDefault) ...[
            const Divider(height: 18, color: AppColors.slate100),
            _info('Trạng thái', 'Thẻ mặc định'),
          ],
        ]),
      );

  Widget _info(String k, String v) => Row(children: [
        Text(k, style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
        const Spacer(),
        Text(v, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate700)),
      ]);
}
