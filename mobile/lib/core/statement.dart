import 'dart:math' as math;

import '../models/bank_card.dart';
import '../models/transaction.dart';

/// Credit-card statement maths — Dart port of client/lib/statement.ts and
/// client/lib/cardDue.ts (same rules, same tests), so "Lịch sao kê" shows the
/// same numbers on web and app.

DateTime _startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

/// `day` of the given month, clamped to the month's last day (31 → 28/30).
/// `month` may overflow (13 → January next year), like JS Date.
DateTime dayOfMonth(int year, int month, int day) {
  final last = DateTime(year, month + 1, 0).day;
  return DateTime(year, month, math.min(day, last));
}

int daysBetween(DateTime from, DateTime to) =>
    (_startOfDay(to).difference(_startOfDay(from)).inHours / 24).round();

/// Next occurrence of `day`, counting today.
DateTime nextOccurrence(int day, DateTime now) {
  final today = _startOfDay(now);
  final thisMonth = dayOfMonth(now.year, now.month, day);
  return !thisMonth.isBefore(today) ? thisMonth : dayOfMonth(now.year, now.month + 1, day);
}

/// Most recent statement close, counting today.
DateTime lastClose(int statementDay, DateTime now) {
  final today = _startOfDay(now);
  final thisMonth = dayOfMonth(now.year, now.month, statementDay);
  return thisMonth.isBefore(today) ? thisMonth : dayOfMonth(now.year, now.month - 1, statementDay);
}

/// First payment-due date after a statement closed on `close`.
DateTime dueAfterClose(DateTime close, int paymentDueDay) {
  final sameMonth = dayOfMonth(close.year, close.month, paymentDueDay);
  return sameMonth.isAfter(close) ? sameMonth : dayOfMonth(close.year, close.month + 1, paymentDueDay);
}

class CardCycle {
  final DateTime nextClose; // chốt sao kê sắp tới
  final DateTime dueDate; // hạn thanh toán gần nhất sắp tới
  final int daysToDue;
  final bool dueIsForClosedStatement; // hạn này thuộc kỳ đã chốt
  final DateTime freeUntil; // hạn trả của khoản quẹt hôm nay
  final int freeDaysIfSwipedToday;
  const CardCycle(this.nextClose, this.dueDate, this.daysToDue, this.dueIsForClosedStatement, this.freeUntil, this.freeDaysIfSwipedToday);
}

CardCycle getCardCycle(int statementDay, int paymentDueDay, DateTime now) {
  final today = _startOfDay(now);
  final next = nextOccurrence(statementDay, now);
  final closedDue = dueAfterClose(lastClose(statementDay, now), paymentDueDay);
  final freeUntil = dueAfterClose(next, paymentDueDay);
  final forClosed = !closedDue.isBefore(today);
  final due = forClosed ? closedDue : dueAfterClose(next, paymentDueDay);
  return CardCycle(next, due, daysBetween(today, due), forClosed, freeUntil, daysBetween(today, freeUntil));
}

// ─── Installments + amount due ──────────────────────────────────────────────

class InstallmentPlan {
  final TransactionModel tx;
  final int months, remaining, paid;
  final num monthly, total;
  final DateTime startDate;
  const InstallmentPlan(this.tx, this.months, this.monthly, this.total, this.remaining, this.paid, this.startDate);
  String get cardId => tx.cardId ?? '';
}

List<InstallmentPlan> installmentPlans(List<TransactionModel> txs, String cardId, DateTime now, {bool includeCompleted = false}) {
  final out = <InstallmentPlan>[];
  for (final t in txs) {
    if (!t.isInstallment || t.installmentMonths <= 0 || t.cardId != cardId) continue;
    final start = t.installmentStartDate ?? t.date;
    final months = t.installmentMonths;
    final monthly = t.installmentMonthly > 0 ? t.installmentMonthly : (t.amount / months).ceil();
    final elapsed = (now.year - start.year) * 12 + (now.month - start.month);
    final int remaining = math.max(0, months - math.max(0, elapsed));
    final int paid = math.min(math.max(0, elapsed), months);
    if (includeCompleted || remaining > 0) out.add(InstallmentPlan(t, months, monthly, t.amount, remaining, paid, start));
  }
  return out;
}

/// Close of the last statement at 23:59:59.999 (charges after it bill next cycle).
DateTime? lastStatementCloseEnd(int statementDay, DateTime now) {
  if (statementDay <= 0) return null;
  final closedThisMonth = now.day > statementDay;
  final c = dayOfMonth(now.year, now.month - (closedThisMonth ? 0 : 1), statementDay);
  return DateTime(c.year, c.month, c.day, 23, 59, 59, 999);
}

num _postCloseCharges(List<TransactionModel> txs, String cardId, DateTime? close) {
  if (close == null) return 0;
  return txs
      .where((t) => !t.isInstallment && t.type == 'expense' && t.cardId == cardId && t.date.isAfter(close))
      .fold<num>(0, (s, t) => s + t.amount);
}

/// Slice of `balance` due this cycle (port of getDueThisCycle).
num dueThisCycle(BankCard card, List<TransactionModel> txs, DateTime now) {
  final plans = installmentPlans(txs, card.id, now);
  final notYetDue = plans.fold<num>(0, (s, p) => s + math.max(0, p.remaining - 1) * p.monthly);
  final post = _postCloseCharges(txs, card.id, lastStatementCloseEnd(card.statementDay, now));
  return math.max(0, card.balance - notYetDue - post);
}

int _periodOnClose(DateTime start, DateTime close, int statementDay) {
  final months = (close.year - start.year) * 12 + (close.month - start.month);
  final startCloseDay = math.min(statementDay, DateTime(start.year, start.month + 1, 0).day);
  return months - (start.day > startCloseDay ? 1 : 0);
}

num _sliceAt(InstallmentPlan p, int idx) =>
    idx == p.months - 1 ? math.max(0, p.total - p.monthly * (p.months - 1)) : p.monthly;

class StatementAmount {
  final num amount; // phải trả cho hạn thanh toán sắp tới
  final num installment; // phần trả góp trong amount
  final bool estimated; // kỳ chưa chốt → số dự kiến
  const StatementAmount(this.amount, this.installment, this.estimated);
}

/// What the card owes at its next due date (port of getStatementAmount):
/// closed statement still due → dueThisCycle; otherwise estimate the next
/// statement as charges since the last close + installment periods billing on it.
StatementAmount statementAmount(BankCard card, List<TransactionModel> txs, CardCycle cycle, DateTime now) {
  if (cycle.dueIsForClosedStatement) {
    final amount = dueThisCycle(card, txs, now);
    final slices = installmentPlans(txs, card.id, now).fold<num>(0, (s, p) => s + _sliceAt(p, p.paid));
    return StatementAmount(amount, math.min(amount, slices), false);
  }
  final charges = _postCloseCharges(txs, card.id, lastStatementCloseEnd(card.statementDay, now));
  final installment = installmentPlans(txs, card.id, now, includeCompleted: true).fold<num>(0, (s, p) {
    final idx = _periodOnClose(p.startDate, cycle.nextClose, card.statementDay);
    return idx >= 0 && idx < p.months ? s + _sliceAt(p, idx) : s;
  });
  return StatementAmount(charges + installment, installment, true);
}

/// Month of a plan's last period.
DateTime planEnd(InstallmentPlan p) => DateTime(p.startDate.year, p.startDate.month + p.months - 1, 1);

/// Amount to pay in each of the next `count` months (from the current month),
/// last period adjusted so the periods sum to the principal — port of
/// getInstallmentSchedule.
List<({DateTime month, num amount, int planCount})> installmentSchedule(List<InstallmentPlan> plans, int count, DateTime now) {
  return List.generate(count, (i) {
    final month = DateTime(now.year, now.month + i, 1);
    num amount = 0;
    var n = 0;
    for (final p in plans) {
      if (i >= p.remaining) continue;
      amount += _sliceAt(p, p.paid + i);
      n++;
    }
    return (month: month, amount: amount, planCount: n);
  });
}

/// All plans (optionally finished ones too) across every card.
List<InstallmentPlan> allInstallmentPlans(List<TransactionModel> txs, Iterable<String> cardIds, DateTime now, {bool includeCompleted = false}) =>
    [for (final id in cardIds) ...installmentPlans(txs, id, now, includeCompleted: includeCompleted)];

/// Current period's amount for one plan (0 once finished).
num planCurrentSlice(InstallmentPlan p) => p.remaining > 0 ? _sliceAt(p, p.paid) : 0;
