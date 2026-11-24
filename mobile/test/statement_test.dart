import 'package:chitieu_mobile/core/statement.dart';
import 'package:chitieu_mobile/models/bank_card.dart';
import 'package:chitieu_mobile/models/transaction.dart';
import 'package:flutter_test/flutter_test.dart';

// Same cases as client/lib/statement.test.ts + cardDue.test.ts.
DateTime d(int y, int m, int day) => DateTime(y, m, day, 12);
String ymd(DateTime x) => '${x.year}-${x.month}-${x.day}';

TransactionModel tx(String id, num amount, String date, {bool inst = false, int months = 0, num monthly = 0, String? start}) =>
    TransactionModel(
      id: id, type: 'expense', amount: amount, category: 'x', note: '', date: DateTime.parse(date), paymentMethod: 'card', cardId: 'c1',
      isInstallment: inst, installmentMonths: months, installmentMonthly: monthly,
      installmentStartDate: start == null ? null : DateTime.parse(start),
    );

void main() {
  group('getCardCycle (statement 5, due 25)', () {
    test('just after the close', () {
      final c = getCardCycle(5, 25, d(2026, 9, 6));
      expect(ymd(c.nextClose), '2026-10-5');
      expect(ymd(c.dueDate), '2026-9-25');
      expect(c.dueIsForClosedStatement, isTrue);
      expect(c.daysToDue, 19);
      expect(c.freeDaysIfSwipedToday, 49);
    });
    test('on the close day → short free period', () {
      expect(getCardCycle(5, 25, d(2026, 9, 5)).freeDaysIfSwipedToday, 20);
    });
    test('after the due date the next due belongs to the open statement', () {
      final c = getCardCycle(5, 25, d(2026, 9, 28));
      expect(c.dueIsForClosedStatement, isFalse);
      expect(ymd(c.dueDate), '2026-10-25');
    });
    test('due day before statement day rolls into next month', () {
      expect(ymd(dueAfterClose(d(2026, 9, 20), 10)), '2026-10-10');
    });
    test('day 31 clamps to short months', () {
      expect(ymd(getCardCycle(31, 15, d(2026, 2, 10)).nextClose), '2026-2-28');
    });
  });

  group('statementAmount', () {
    final now = DateTime(2026, 11, 22);
    const card = BankCard(id: 'c1', bankName: 'VIB', bankShortName: 'VIB', cardType: 'credit', cardNumber: '9012', cardHolder: '',
        balance: 27395000, creditLimit: 0, interestRate: 0, color: '', isDefault: false, statementDay: 28, paymentDueDay: 15);
    final open = CardCycle(DateTime(2026, 11, 28), DateTime(2026, 12, 15), 23, false, DateTime(2026, 12, 15), 23);
    final txs = [
      tx('a', 15300000, '2026-09-10', inst: true, months: 6, monthly: 2550000, start: '2026-09-10'),
      tx('b', 12000000, '2026-11-10', inst: true, months: 9, monthly: 1333334, start: '2026-11-10'),
      tx('x', 95000, '2026-11-01'),
      tx('y', 500000, '2026-10-20'),
    ];

    test('open statement includes installments billing on the next close', () {
      final r = statementAmount(card, txs, open, now);
      expect(r.estimated, isTrue);
      expect(r.installment, 2550000 + 1333334);
      expect(r.amount, 95000 + 2550000 + 1333334);
    });
    test('purchase after the close day starts on the following close', () {
      final late = [tx('b', 12000000, '2026-11-29', inst: true, months: 9, monthly: 1333334, start: '2026-11-29')];
      expect(statementAmount(card, late, open, now).installment, 0);
      final decOpen = CardCycle(DateTime(2026, 12, 28), DateTime(2027, 1, 15), 26, false, DateTime(2027, 1, 15), 26);
      expect(statementAmount(card, late, decOpen, DateTime(2026, 12, 20)).installment, 1333334);
    });
    test('last period adjusted so periods sum to the principal', () {
      final p = [tx('p', 1000000, '2026-09-10', inst: true, months: 3, monthly: 333334, start: '2026-09-10')];
      expect(statementAmount(card, p, open, now).installment, 1000000 - 333334 * 2);
    });
    test('closed statement still due equals dueThisCycle', () {
      final closed = CardCycle(DateTime(2026, 11, 28), DateTime(2026, 11, 25), 3, true, DateTime(2026, 12, 15), 23);
      final r = statementAmount(card, txs, closed, now);
      expect(r.estimated, isFalse);
      expect(r.amount, dueThisCycle(card, txs, now));
      expect(r.installment > 0 && r.installment <= r.amount, isTrue);
    });
  });

  group('installmentSchedule', () {
    test('sums to the principal and stops when plans end', () {
      final now = DateTime(2026, 11, 22);
      final plans = installmentPlans([tx('p', 1000000, '2026-11-10', inst: true, months: 3, monthly: 333334, start: '2026-11-10')], 'c1', now);
      final s = installmentSchedule(plans, 4, now);
      expect(s.map((m) => m.amount).toList(), [333334, 333334, 1000000 - 333334 * 2, 0]);
      expect(s.fold<num>(0, (a, m) => a + m.amount), 1000000);
      expect(planEnd(plans.first), DateTime(2027, 1, 1));
    });
  });
}
