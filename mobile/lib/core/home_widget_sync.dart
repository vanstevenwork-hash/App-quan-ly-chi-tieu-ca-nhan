import 'dart:convert';

import 'package:home_widget/home_widget.dart';

import '../models/bank_card.dart';
import '../models/transaction.dart';
import 'statement.dart';

/// Data bridge to the iOS home-screen widgets (ios/ChiTieuWidget):
/// the app writes one JSON blob into the shared App Group; the widgets read
/// it and render. Taps open the app via `chitieu://<action>?homeWidget`.
class HomeWidgetSync {
  static const appGroup = 'group.com.chitieu.chitieuMobile';
  static const _key = 'widget_data';
  static const _kinds = ['ChiTieuWidget', 'SaoKeWidget'];

  static bool _ready = false;
  static String _last = '';

  static Future<void> init() async {
    if (_ready) return;
    _ready = true;
    await HomeWidget.setAppGroupId(appGroup);
  }

  /// Recompute and push the widget payload; skipped when nothing changed.
  static Future<void> push({
    required List<TransactionModel> txs,
    required List<BankCard> cards,
    required List<({BankCard card, num due})> dues,
    required bool hidden,
  }) async {
    await init();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    num todayExpense = 0, monthExpense = 0, monthIncome = 0;
    for (final t in txs) {
      final d = DateTime(t.date.year, t.date.month, t.date.day);
      if (t.date.year == now.year && t.date.month == now.month) {
        if (t.isIncome) {
          monthIncome += t.amount;
        } else {
          monthExpense += t.amount;
          if (d == today) todayExpense += t.amount;
        }
      }
    }
    final dueList = [
      for (final a in dues)
        () {
          final c = a.card;
          final cycle = c.statementDay > 0 && c.paymentDueDay > 0 ? getCardCycle(c.statementDay, c.paymentDueDay, now) : null;
          return {
            'name': c.bankName.isNotEmpty ? c.bankName : c.bankShortName,
            'bank': c.bankShortName,
            'last4': c.cardNumber,
            'amount': a.due.round(),
            'days': cycle?.daysToDue,
            'dueDate': cycle == null ? null : '${cycle.dueDate.day}/${cycle.dueDate.month}',
          };
        }(),
    ]..sort((a, b) => ((a['days'] as int?) ?? 999).compareTo((b['days'] as int?) ?? 999));

    final payload = jsonEncode({
      'hidden': hidden,
      'today': todayExpense.round(),
      'month': monthExpense.round(),
      'income': monthIncome.round(),
      'monthLabel': 'Tháng ${now.month}',
      'dues': dueList.take(6).toList(),
      'dueTotal': dues.fold<num>(0, (s, a) => s + a.due).round(),
      'day': '${today.year}-${today.month}-${today.day}',
    });
    if (payload == _last) return;
    _last = payload;
    await HomeWidget.saveWidgetData<String>(_key, payload);
    for (final k in _kinds) {
      await HomeWidget.updateWidget(iOSName: k);
    }
  }

  /// Signed out → wipe what the widgets show.
  static Future<void> clear() async {
    await init();
    _last = '';
    await HomeWidget.saveWidgetData<String>(_key, null);
    for (final k in _kinds) {
      await HomeWidget.updateWidget(iOSName: k);
    }
  }
}
