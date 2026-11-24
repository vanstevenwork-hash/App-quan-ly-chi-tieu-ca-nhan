import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/statement.dart';
import '../models/bank_card.dart';
import '../models/card_share.dart';
import '../services/game_service.dart';
import 'finance_providers.dart';

/// Single source of truth for "Thông báo quan trọng" — port of the web
/// useImportantAlerts: the dashboard section and the notifications screen
/// read the same live reminders, so they can never disagree.
///  · credit cards that still owe something THIS statement cycle
///  · savings books maturing within 30 days (or already matured)
///  · pending card-share invites (accept / decline inline)
/// Incoming card-game invites (web GameInviteCard).
final gameInvitesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) => GameService().incoming().catchError((_) => <Map<String, dynamic>>[]));

class ImportantAlerts {
  final List<Map<String, dynamic>> gameInvites;
  final List<SharedCard> invites; // card-share invites (actionable → first)
  final List<({BankCard card, num due})> credit;
  final List<BankCard> savings;
  const ImportantAlerts(this.gameInvites, this.invites, this.credit, this.savings);
  int get count => gameInvites.length + invites.length + credit.length + savings.length;
  bool get isEmpty => count == 0;
}

final importantAlertsProvider = Provider<ImportantAlerts>((ref) {
  final cards = ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[];
  final txs = ref.watch(transactionsProvider).valueOrNull ?? const [];
  final now = DateTime.now();
  final credit = [
    for (final c in cards.where((c) => c.isCredit && c.balance > 0)) (card: c, due: dueThisCycle(c, txs, now)),
  ].where((a) => a.due > 0).toList();
  final savings = cards
      .where((c) => c.isSavings && c.maturityDate != null && c.maturityDate!.difference(now).inHours / 24 <= 30)
      .toList();
  final invites = ref.watch(incomingInvitesProvider).valueOrNull ?? const <SharedCard>[];
  final games = ref.watch(gameInvitesProvider).valueOrNull ?? const <Map<String, dynamic>>[];
  return ImportantAlerts(games, invites, credit, savings);
});
