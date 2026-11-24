import 'dart:math' as math;

import '../models/bank_card.dart';
import '../models/transaction.dart';

/// Port of client/lib/cashback.ts getCappedCashbackTotal: per month,
/// cashback = rate × spend, capped at cashbackCap, zero if spend < min-spend;
/// transaction fees are subtracted (uncapped), so the total can go negative.
num cappedCashbackTotal(List<TransactionModel> txs, num rate, num cap, num minSpend) {
  final byMonth = <String, ({num spend, num cashback, num fee})>{};
  for (final t in txs) {
    final key = '${t.date.year}-${t.date.month}';
    final b = byMonth[key] ?? (spend: 0, cashback: 0, fee: 0);
    byMonth[key] = (spend: b.spend + t.amount, cashback: b.cashback + t.amount * rate / 100, fee: b.fee + t.feeAmount);
  }
  num total = 0;
  for (final b in byMonth.values) {
    final earned = minSpend > 0 && b.spend < minSpend ? 0 : (cap > 0 ? math.min(b.cashback, cap) : b.cashback);
    total += earned - b.fee;
  }
  return total;
}

/// This month's cashback across the user's credit cards (dashboard pill).
num monthCashback(List<BankCard> cards, List<TransactionModel> txs, DateTime now) {
  num sum = 0;
  for (final c in cards.where((c) => c.isCredit)) {
    final monthTxs = txs.where((t) =>
        t.type == 'expense' && t.paymentMethod == 'card' && t.cardId == c.id && t.date.year == now.year && t.date.month == now.month);
    sum += cappedCashbackTotal(monthTxs.toList(), c.cashbackRate, c.cashbackCap, c.cashbackMinSpend);
  }
  return sum;
}
