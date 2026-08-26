import '../core/api_client.dart';
import '../models/transaction.dart';
import '../models/bank_card.dart';
import '../models/goal.dart';
import '../models/summary.dart';
import '../models/app_notification.dart';

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
    final res = await _dio.get('/transactions');
    return _list(res.data).map(TransactionModel.fromJson).toList();
  }

  Future<List<BankCard>> getCards() async {
    final res = await _dio.get('/cards');
    return _list(res.data).map(BankCard.fromJson).toList();
  }

  Future<List<Goal>> getGoals() async {
    final res = await _dio.get('/goals');
    return _list(res.data).map(Goal.fromJson).toList();
  }

  Future<List<AppNotification>> getNotifications() async {
    final res = await _dio.get('/notifications');
    return _list(res.data).map(AppNotification.fromJson).toList();
  }

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

  /// Pay down a credit card's debt (optionally from a source account).
  Future<void> payCard(String id, {required num amount, String? sourceId}) =>
      _dio.patch('/cards/$id/pay', data: {'amount': amount, 'sourceId': ?sourceId});
}
