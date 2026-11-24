import '../constants/categories.dart';
import '../models/card_share.dart';
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

/// The user's own categories, registered for label lookups (web
/// useCustomCategoriesStore). Loaded alongside transactions so a list never
/// renders before its custom categories are known.
final customCategoriesProvider = FutureProvider<void>((ref) async {
  try {
    setCustomCategories(await ref.read(financeServiceProvider).getCustomCategories());
  } catch (_) {/* built-ins still work */}
});

final transactionsProvider = FutureProvider<List<TransactionModel>>((ref) async {
  final results = await Future.wait([
    ref.read(financeServiceProvider).getTransactions(),
    ref.read(customCategoriesProvider.future),
  ]);
  return results.first as List<TransactionModel>;
});

final cardsProvider = FutureProvider<List<BankCard>>((ref) {
  return ref.read(financeServiceProvider).getCards();
});

final wealthTotalProvider = FutureProvider<num>((ref) {
  return ref.read(financeServiceProvider).getWealthTotal();
});

final sharedCardsProvider = FutureProvider<List<SharedCard>>((ref) => ref.read(financeServiceProvider).getSharedCards());
final incomingInvitesProvider = FutureProvider<List<SharedCard>>((ref) => ref.read(financeServiceProvider).getIncomingInvites());

/// cardId → owner name, for tagging shared-card transactions ("của Vợ").
final sharedOwnerByCardProvider = Provider<Map<String, String>>((ref) {
  final list = ref.watch(sharedCardsProvider).valueOrNull ?? const <SharedCard>[];
  return {for (final s in list) s.card.id: s.ownerName.isNotEmpty ? s.ownerName : 'Thẻ chung'};
});

/// This month's cashback on every card shared with me (web useSharedCashback).
final sharedCashbackProvider = FutureProvider<List<({SharedCard share, num amount})>>((ref) async {
  final list = await ref.watch(sharedCardsProvider.future);
  final svc = ref.read(financeServiceProvider);
  final out = await Future.wait(list.map((s) async => (share: s, amount: await svc.sharedCardCashback(s.card.id).catchError((_) => 0 as num))));
  return out;
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
  ref.invalidate(wealthTotalProvider);
  ref.invalidate(sharedCardsProvider);
  ref.invalidate(incomingInvitesProvider);
  ref.invalidate(categoryBreakdownProvider);
  ref.invalidate(goalsProvider); // auto-save / undo change goal balances
}
