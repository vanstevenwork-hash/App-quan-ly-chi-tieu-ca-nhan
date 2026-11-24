import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/statement.dart';
import '../models/bank_card.dart';
import 'finance_providers.dart';

/// Single source of truth for "Thông báo quan trọng" — port of the web
/// useImportantAlerts: the dashboard section and the notifications screen
/// read the same live reminders, so they can never disagree.
///  · credit cards that still owe something THIS statement cycle
///  · savings books maturing within 30 days (or already matured)
class ImportantAlerts {
  final List<({BankCard card, num due})> credit;
  final List<BankCard> savings;
  const ImportantAlerts(this.credit, this.savings);
  int get count => credit.length + savings.length;
  bool get isEmpty => count == 0;
}

final importantAlertsProvider = Provider<ImportantAlerts>((ref) {
  final cards = ref.watch(cardsProvider).value ?? const <BankCard>[];
  final txs = ref.watch(transactionsProvider).value ?? const [];
  final now = DateTime.now();
  final credit = [
    for (final c in cards.where((c) => c.isCredit && c.balance > 0)) (card: c, due: dueThisCycle(c, txs, now)),
  ].where((a) => a.due > 0).toList();
  final savings = cards
      .where((c) => c.isSavings && c.maturityDate != null && c.maturityDate!.difference(now).inHours / 24 <= 30)
      .toList();
  return ImportantAlerts(credit, savings);
});
