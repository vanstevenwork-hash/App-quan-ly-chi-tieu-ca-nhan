import 'dart:convert';
import 'package:dio/dio.dart';
import '../core/api_client.dart';
import '../models/transaction.dart';
import '../models/bank_card.dart';
import '../models/goal.dart';
import '../models/summary.dart';
import '../models/app_notification.dart';
import '../models/auto_action.dart';
import '../models/card_share.dart';

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

  /// Cashback records: [{cardId, year, month (0-based like JS), status, estimatedAmount, receivedAmount}].
  Future<List<Map<String, dynamic>>> getCashbackRecords() async => _list((await _dio.get('/cashback-records')).data);

  Future<void> upsertCashbackRecord({required String cardId, required int year, required int month0, required String status, num? estimatedAmount}) =>
      _dio.put('/cashback-records', data: {'cardId': cardId, 'year': year, 'month': month0, 'status': status, 'estimatedAmount': ?estimatedAmount});

  /// Other wealth sources (stocks, gold, crypto, real estate…).
  Future<List<Map<String, dynamic>>> getWealthSources() async => _list((await _dio.get('/wealth')).data);
  Future<void> createWealthSource(Map<String, dynamic> data) => _dio.post('/wealth', data: data);
  Future<void> updateWealthSource(String id, Map<String, dynamic> data) => _dio.put('/wealth/$id', data: data);
  Future<void> deleteWealthSource(String id) => _dio.delete('/wealth/$id');

  // ── Mailbox (EMAIL_USER, owner only) ───────────────────────────────────
  Future<({bool allowed, String account})> mailboxAccess() async {
    final d = _obj((await _dio.get('/mailbox/access')).data);
    return (allowed: d['allowed'] == true, account: (d['account'] ?? '').toString());
  }

  Future<Map<String, dynamic>> mailboxFolders() async => _obj((await _dio.get('/mailbox/folders')).data);

  Future<Map<String, dynamic>> mailboxList({required String folder, int page = 1, String? q, String status = 'all'}) async =>
      _obj((await _dio.get('/mailbox/messages', queryParameters: {'folder': folder, 'page': page, 'limit': 30, 'q': ?q, 'status': status})).data);

  Future<Map<String, dynamic>> mailboxGet(String folder, int uid) async =>
      _obj((await _dio.get('/mailbox/messages/$uid', queryParameters: {'folder': folder})).data);

  Future<void> mailboxFlags(String folder, List<int> uids, {bool? seen, bool? flagged}) =>
      _dio.patch('/mailbox/messages/flags', data: {'folder': folder, 'uids': uids, 'seen': ?seen, 'flagged': ?flagged});

  Future<bool> mailboxDelete(String folder, List<int> uids) async {
    final d = _obj((await _dio.post('/mailbox/messages/delete', data: {'folder': folder, 'uids': uids})).data);
    return d['permanent'] == true;
  }

  Future<void> mailboxSend({required String to, String? cc, required String subject, required String text, String? inReplyTo, List<String>? references}) =>
      _dio.post('/mailbox/send', data: {'to': to, 'cc': ?cc, 'subject': subject, 'text': text, 'inReplyTo': ?inReplyTo, 'references': ?references});

  /// Traveloka gift vouchers: status = unread | read | all.
  Future<List<Map<String, dynamic>>> travelokaVouchers(String status) async {
    final d = _obj((await _dio.get('/mailbox/traveloka', queryParameters: {'status': status})).data);
    final list = d['emails'];
    return list is List ? list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : const [];
  }

  /// Upload an image to Cloudinary through the server; returns its URL.
  Future<String> uploadImage(String filePath, {String folder = 'chi_tieu'}) async {
    final form = FormData.fromMap({'file': await MultipartFile.fromFile(filePath)});
    final res = await _dio.post('/upload', data: form, queryParameters: {'folder': folder},
        options: Options(contentType: 'multipart/form-data', receiveTimeout: const Duration(minutes: 2)));
    final d = res.data;
    final url = d is Map ? d['url']?.toString() : null;
    if (url == null || url.isEmpty) throw Exception('upload failed');
    return url;
  }

  // ── Chia bill (expense shares) ─────────────────────────────────────
  Map<String, dynamic>? _shareData(dynamic d) {
    final v = d is Map ? d['data'] : null;
    return v is Map ? Map<String, dynamic>.from(v) : null;
  }

  Future<Map<String, dynamic>?> expenseShareFor(String txId) async =>
      _shareData((await _dio.get('/expense-shares/transaction/$txId')).data);
  Future<Map<String, dynamic>?> saveExpenseShare({String? id, required String transactionId, required String receiveCardId, required List<Map<String, dynamic>> participants}) async {
    final res = id == null
        ? await _dio.post('/expense-shares', data: {'transactionId': transactionId, 'receiveCardId': receiveCardId, 'participants': participants})
        : await _dio.put('/expense-shares/$id', data: {'receiveCardId': receiveCardId, 'participants': participants});
    return _shareData(res.data);
  }

  Future<Map<String, dynamic>?> markSharePaid(String id, String pid, bool paid) async =>
      _shareData((await _dio.patch('/expense-shares/$id/participants/$pid/${paid ? 'pay' : 'unpay'}')).data);
  Future<void> deleteExpenseShare(String id) => _dio.delete('/expense-shares/$id');

  // ── Card sharing (thẻ chung) ──────────────────────────────────────────
  List<SharedCard> _shares(dynamic data) => _list(data).map(SharedCard.fromJson).whereType<SharedCard>().toList();
  Future<List<SharedCard>> getSharedCards() async => _shares((await _dio.get('/card-shares/my-shares')).data);
  Future<List<SharedCard>> getIncomingInvites() async => _shares((await _dio.get('/card-shares/incoming')).data);
  Future<void> respondShare(String id, bool accept) => _dio.patch('/card-shares/$id/respond', data: {'accept': accept});
  Future<void> inviteShare(String cardId, String email) => _dio.post('/card-shares/invite', data: {'cardId': cardId, 'email': email});
  Future<void> revokeShare(String id) => _dio.delete('/card-shares/$id');
  Future<List<CardShareEntry>> getCardShares(String cardId) async =>
      _list((await _dio.get('/card-shares/card/$cardId')).data).map(CardShareEntry.fromJson).toList();

  /// This month's real cashback of a shared card (owner + invitee spend).
  Future<num> sharedCardCashback(String cardId) async {
    final d = _obj((await _dio.get('/card-shares/$cardId/cashback')).data);
    return (d['cashbackEarned'] as num?) ?? 0;
  }

  /// Does an app account exist for this email? (null if unknown)
  Future<({bool? exists, String name})> checkEmail(String email) async {
    final d = (await _dio.get('/auth/check-email', queryParameters: {'email': email})).data;
    return (exists: d is Map ? d['exists'] as bool? : null, name: d is Map ? (d['name'] ?? '').toString() : '');
  }

  // ── Custom categories / profile / integrations ────────────────────────
  List<Map<String, dynamic>> _cats(dynamic d) {
    final l = d is Map ? d['categories'] : null;
    return l is List ? l.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : const [];
  }

  Future<List<Map<String, dynamic>>> getCustomCategories() async => _cats((await _dio.get('/categories')).data);
  Future<List<Map<String, dynamic>>> createCustomCategory(Map<String, dynamic> data) async => _cats((await _dio.post('/categories', data: data)).data);
  Future<List<Map<String, dynamic>>> deleteCustomCategory(String id) async => _cats((await _dio.delete('/categories/$id')).data);

  Future<void> updateProfile(Map<String, dynamic> data) => _dio.put('/auth/profile', data: data);
  Future<void> requestEmailChange(String email) => _dio.post('/auth/change-email/request', data: {'newEmail': email});
  Future<String> confirmEmailChange(String code) async {
    final d = (await _dio.post('/auth/change-email/confirm', data: {'code': code})).data;
    return d is Map && d['user'] is Map ? (d['user']['email'] ?? '').toString() : '';
  }

  Future<bool> telegramStatus() async {
    final d = (await _dio.get('/telegram/status')).data;
    return d is Map && d['connected'] == true;
  }

  /// { connected, url } — url is the bot deep link to finish linking.
  Future<({bool connected, String? url})> telegramLink() async {
    final d = (await _dio.get('/telegram/link')).data;
    return (connected: d is Map && d['connected'] == true, url: d is Map ? d['url']?.toString() : null);
  }

  Future<void> telegramUnlink() => _dio.post('/telegram/unlink');

  /// Scan the bank inbox (NDJSON stream: progress lines, then done/error).
  Future<({List<Map<String, dynamic>> items, int statements})> scanBankEmails(int days, void Function(int done, int total) onProgress) async {
    final res = await _dio.post<ResponseBody>('/email/scan',
        data: {'days': days}, options: Options(responseType: ResponseType.stream, receiveTimeout: const Duration(minutes: 5)));
    final lines = res.data!.stream.cast<List<int>>().transform(const Utf8Decoder()).transform(const LineSplitter());
    await for (final line in lines) {
      if (line.trim().isEmpty) continue;
      final m = jsonDecode(line);
      if (m is! Map) continue;
      if (m['type'] == 'progress') onProgress((m['done'] as num?)?.toInt() ?? 0, (m['total'] as num?)?.toInt() ?? 0);
      if (m['type'] == 'error') throw Exception(m['message'] ?? 'Quét email thất bại');
      if (m['type'] == 'done') {
        final items = (m['items'] as List? ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        return (items: items, statements: (m['statements'] as num?)?.toInt() ?? 0);
      }
    }
    throw Exception('Quét email bị ngắt');
  }

  Future<({int created, int skipped})> commitEmailItems(List<Map<String, dynamic>> items) async {
    final d = (await _dio.post('/email/commit', data: {'items': items})).data;
    return (created: d is Map ? (d['created'] as num?)?.toInt() ?? 0 : 0, skipped: d is Map ? (d['skipped'] as num?)?.toInt() ?? 0 : 0);
  }

  Future<List<Goal>> getGoals() async {
    final res = await _dio.get('/goals');
    return _list(res.data).map(Goal.fromJson).toList();
  }

  Future<void> createGoal(Map<String, dynamic> data) => _dio.post('/goals', data: data);
  Future<void> updateGoal(String id, Map<String, dynamic> data) => _dio.put('/goals/$id', data: data);
  Future<void> deleteGoal(String id) => _dio.delete('/goals/$id');

  /// Deposit / withdraw — returns the updated goal (server auto-completes at 100%).
  Future<Goal> goalContribute(String id, {required bool deposit, required num amount, String note = ''}) async {
    final res = await _dio.post('/goals/$id/${deposit ? 'deposit' : 'withdraw'}', data: {'amount': amount, 'note': ?(note.isEmpty ? null : note)});
    return Goal.fromJson(_obj(res.data));
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

  /// Create (no [id]) or update a transaction with the full web payload
  /// (installment, fee, receipt image…).
  Future<void> saveTransaction(Map<String, dynamic> data, {String? id}) async {
    if (id == null) {
      await _dio.post('/transactions', data: data);
    } else {
      await _dio.put('/transactions/$id', data: data);
    }
  }

  /// "Quét Bill": OCR a receipt photo → {amount, date (YYYY-MM-DD), note,
  /// suggestedCategory, imageUrl, confidence}.
  Future<Map<String, dynamic>> scanReceipt(String filePath) async {
    final form = FormData.fromMap({'file': await MultipartFile.fromFile(filePath)});
    final res = await _dio.post('/ocr/scan-receipt', data: form,
        options: Options(contentType: 'multipart/form-data', receiveTimeout: const Duration(seconds: 90)));
    return _obj(res.data);
  }



  Future<void> deleteTransaction(String id) => _dio.delete('/transactions/$id');

  Future<void> markAllNotificationsRead() => _dio.patch('/notifications/read-all');

  // ── Cards ──────────────────────────────────────────────────────────────
  /// VietQR bank list proxied by the server: [{shortName, name, logo, …}].
  Future<List<Map<String, dynamic>>> getBanks() async {
    final d = (await _dio.get('/banks')).data;
    final list = d is Map ? d['data'] : d;
    return list is List ? list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : const [];
  }

  Future<void> createCard(Map<String, dynamic> data) => _dio.post('/cards', data: data);
  Future<void> updateCard(String id, Map<String, dynamic> data) => _dio.put('/cards/$id', data: data);
  Future<void> deleteCard(String id) => _dio.delete('/cards/$id');

  /// Tái tục a matured savings book: interest becomes income, a new term starts.
  /// Returns the interest earned on the finished term.
  Future<num> renewSavings(String id, {required num newAmount, required num newRate, required int newTerm}) async {
    final res = await _dio.post('/cards/$id/renew-savings', data: {'newAmount': newAmount, 'newRate': newRate, 'newTerm': newTerm});
    final d = res.data;
    return (d is Map && d['interestEarned'] is num) ? d['interestEarned'] as num : 0;
  }

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
