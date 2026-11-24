import '../core/api_client.dart';
import '../models/transaction.dart';
import '../models/bank_card.dart';
import '../models/goal.dart';
import '../models/summary.dart';
import '../models/app_notification.dart';
import '../models/auto_action.dart';

/// One service covering the read/write endpoints the mobile app needs.
/// The .NET API wraps payloads as { data: ... } (mirrors the web client's
/// `res.data.data`), so [_list]/[_obj] unwrap that shape safely.
class FinanceService {
  final _dio = ApiClient.dio;

  List<Map<String, dynamic>> _list(dynamic data) {
    final payload = (data is Map && data['data'] != null) ? data['data'] : data;
    if (payload is List) {
      return payload.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    }
    return const [];
  }

  Map<String, dynamic> _obj(dynamic data) {
    final payload = (data is Map && data['data'] != null) ? data['data'] : data;
    return payload is Map ? Map<String, dynamic>.from(payload) : <String, dynamic>{};
  }

  Future<Summary> getSummary() async {
    final res = await _dio.get('/transactions/summary');
    return Summary.fromJson(_obj(res.data));
  }

  Future<List<TransactionModel>> getTransactions() async {
    // Same window as the web (useTransactions): the server defaults to 20,
    // which silently broke every per-card/installment/statement calculation.
    final res = await _dio.get('/transactions', queryParameters: {'limit': 2000});
    return _list(res.data).map(TransactionModel.fromJson).toList();
  }

  Future<List<BankCard>> getCards() async {
    final res = await _dio.get('/cards');
    return _list(res.data).map(BankCard.fromJson).toList();
  }

  /// Sum of the user's other wealth sources (stocks, gold, real estate…) —
  /// the web's net worth = card balances + this − card debt.
  Future<num> getWealthTotal() async {
    final res = await _dio.get('/wealth');
    final d = res.data;
    return (d is Map && d['total'] is num) ? d['total'] as num : 0;
  }

  Future<List<Goal>> getGoals() async {
    final res = await _dio.get('/goals');
    return _list(res.data).map(Goal.fromJson).toList();
  }

  Future<List<AppNotification>> getNotifications() async {
    // Same window as the web (limit 50); the server defaults to 20.
    final res = await _dio.get('/notifications', queryParameters: {'limit': 50});
    return _list(res.data).map(AppNotification.fromJson).toList();
  }

  Future<void> markNotificationRead(String id) => _dio.patch('/notifications/$id/read');
  Future<void> deleteNotification(String id) => _dio.delete('/notifications/$id');

  /// [{ category, total }] for the current period — used by the analytics pie.
  Future<List<({String category, num total})>> getCategoryBreakdown() async {
    final res = await _dio.get('/transactions/category-breakdown');
    return _list(res.data)
        .map((e) => (
              category: (e['category'] ?? e['_id'] ?? 'Khác').toString(),
              total: (e['total'] ?? e['amount'] ?? 0) as num,
            ))
        .toList();
  }

  Future<void> createTransaction({
    required String type,
    required num amount,
    required String category,
    required String note,
    required DateTime date,
    String paymentMethod = 'cash',
    String? cardId,
  }) async {
    await _dio.post('/transactions', data: {
      'type': type,
      'amount': amount,
      'category': category,
      'note': note,
      'date': date.toUtc().toIso8601String(),
      'paymentMethod': paymentMethod,
      'cardId': ?cardId,
    });
  }

  Future<void> updateTransaction(
    String id, {
    required String type,
    required num amount,
    required String category,
    required String note,
    required DateTime date,
    String paymentMethod = 'cash',
    String? cardId,
  }) async {
    await _dio.put('/transactions/$id', data: {
      'type': type,
      'amount': amount,
      'category': category,
      'note': note,
      'date': date.toUtc().toIso8601String(),
      'paymentMethod': paymentMethod,
      'cardId': ?cardId,
    });
  }

  Future<void> deleteTransaction(String id) => _dio.delete('/transactions/$id');

  Future<void> markAllNotificationsRead() => _dio.patch('/notifications/read-all');

  // ── Cards ──────────────────────────────────────────────────────────────
  Future<void> createCard(Map<String, dynamic> data) => _dio.post('/cards', data: data);
  Future<void> updateCard(String id, Map<String, dynamic> data) => _dio.put('/cards/$id', data: data);
  Future<void> deleteCard(String id) => _dio.delete('/cards/$id');

  // ── Automatic actions (auto tất toán / trích nợ thẻ) ───────────────────
  /// Runs the server's automatic jobs for this user and returns every
  /// automatic event not yet reviewed (also ones the hourly scan did).
  Future<List<AutoEvent>> autoProcess() async {
    final res = await _dio.post('/cards/auto-process');
    return _list(res.data).map(AutoEvent.fromJson).toList();
  }

  /// User pressed "Đã kiểm tra" — stop showing these events.
  Future<void> ackAutoEvents(List<String> ids) => _dio.post('/cards/auto-process/ack', data: {'ids': ids});

  Future<({List<AutoActionInfo> actions, List<PendingAutoPay> pending})> getAutoActions() async {
    final d = _obj((await _dio.get('/cards/auto-actions')).data);
    List<Map<String, dynamic>> l(dynamic x) => x is List ? x.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : const [];
    return (actions: l(d['actions']).map(AutoActionInfo.fromJson).toList(), pending: l(d['pending']).map(PendingAutoPay.fromJson).toList());
  }

  Future<void> revertAutoAction(String id) => _dio.post('/cards/auto-actions/$id/revert');

  /// Pay down a credit card's debt (optionally from a source account).
  Future<void> payCard(String id, {required num amount, String? sourceId}) =>
      _dio.patch('/cards/$id/pay', data: {'amount': amount, 'sourceId': ?sourceId});
}
