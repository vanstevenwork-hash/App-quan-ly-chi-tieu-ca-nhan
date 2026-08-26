import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/transaction.dart';
import '../models/bank_card.dart';
import '../models/goal.dart';
import '../models/summary.dart';
import '../models/app_notification.dart';
import '../services/finance_service.dart';

final financeServiceProvider = Provider<FinanceService>((_) => FinanceService());

final summaryProvider = FutureProvider<Summary>((ref) {
  return ref.read(financeServiceProvider).getSummary();
});

final transactionsProvider = FutureProvider<List<TransactionModel>>((ref) {
  return ref.read(financeServiceProvider).getTransactions();
});

final cardsProvider = FutureProvider<List<BankCard>>((ref) {
  return ref.read(financeServiceProvider).getCards();
});

final goalsProvider = FutureProvider<List<Goal>>((ref) {
  return ref.read(financeServiceProvider).getGoals();
});

final notificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  return ref.read(financeServiceProvider).getNotifications();
});

final categoryBreakdownProvider =
    FutureProvider<List<({String category, num total})>>((ref) {
  return ref.read(financeServiceProvider).getCategoryBreakdown();
});

/// Net worth derived from cards: positive balances (debit/wallet/savings) minus
/// credit-card debt. Mirrors the web app's simplified dashboard figure.
class CardTotals {
  final num assets;
  final num debt;
  final num savings;
  const CardTotals(this.assets, this.debt, this.savings);
  num get netWorth => assets - debt;
}

final cardTotalsProvider = Provider<AsyncValue<CardTotals>>((ref) {
  return ref.watch(cardsProvider).whenData((cards) {
    num assets = 0, debt = 0, savings = 0;
    for (final c in cards) {
      if (c.isCredit) {
        debt += c.balance;
      } else {
        assets += c.balance;
        if (c.isSavings) savings += c.balance;
      }
    }
    return CardTotals(assets, debt, savings);
  });
});

/// Invalidate everything money-related after a create/delete so the UI refreshes.
void refreshFinance(WidgetRef ref) {
  ref.invalidate(summaryProvider);
  ref.invalidate(transactionsProvider);
  ref.invalidate(cardsProvider);
  ref.invalidate(categoryBreakdownProvider);
}
