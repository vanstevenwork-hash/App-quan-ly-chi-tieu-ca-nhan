/// Automatic money movements (auto tất toán / trích nợ thẻ) — mirrors the
/// server's AutoAction + the on-open review events (cardController.autoProcess).
class AutoActionInfo {
  final String id;
  final String kind; // savings_settle | credit_autopay | goal_autosave
  final String status; // done | reverted
  final num amount;
  final num interest;
  final String cardLabel;
  final String accountLabel;
  final DateTime createdAt;
  final DateTime? revertedAt;

  const AutoActionInfo({
    required this.id, required this.kind, required this.status, required this.amount, this.interest = 0,
    required this.cardLabel, required this.accountLabel, required this.createdAt, this.revertedAt,
  });

  bool get isPay => kind == 'credit_autopay';
  bool get isGoal => kind == 'goal_autosave';
  bool get isSettle => kind == 'savings_settle';
  bool get reverted => status == 'reverted';

  AutoActionInfo copyWith({String? status}) => AutoActionInfo(
        id: id, kind: kind, status: status ?? this.status, amount: amount, interest: interest,
        cardLabel: cardLabel, accountLabel: accountLabel, createdAt: createdAt, revertedAt: revertedAt);

  factory AutoActionInfo.fromJson(Map<String, dynamic> j) => AutoActionInfo(
        id: (j['_id'] ?? '').toString(),
        kind: (j['kind'] ?? '').toString(),
        status: (j['status'] ?? 'done').toString(),
        amount: (j['amount'] ?? 0) as num,
        interest: (j['interest'] ?? 0) as num,
        cardLabel: (j['cardLabel'] ?? '').toString(),
        accountLabel: (j['accountLabel'] ?? '').toString(),
        createdAt: DateTime.tryParse((j['createdAt'] ?? '').toString())?.toLocal() ?? DateTime.now(),
        revertedAt: j['revertedAt'] == null ? null : DateTime.tryParse(j['revertedAt'].toString())?.toLocal(),
      );
}

/// One entry of the "Thay đổi tự động" popup.
class AutoEvent {
  final String id;
  final String title;
  final String message;
  final String? cardId;
  final AutoActionInfo? action; // null → a warning ("chưa trừ được tiền")

  const AutoEvent({required this.id, required this.title, required this.message, this.cardId, this.action});

  AutoEvent withAction(AutoActionInfo a) => AutoEvent(id: id, title: title, message: message, cardId: cardId, action: a);

  factory AutoEvent.fromJson(Map<String, dynamic> j) {
    final a = j['action'];
    return AutoEvent(
      id: (j['_id'] ?? '').toString(),
      title: (j['title'] ?? '').toString(),
      message: (j['message'] ?? '').toString(),
      cardId: j['cardId']?.toString(),
      action: a is Map
          ? AutoActionInfo.fromJson({...Map<String, dynamic>.from(a), 'createdAt': j['createdAt']})
          : null,
    );
  }
}

class PendingAutoPay {
  final String cardId, bankName, cardNumber, cycleLabel;
  final num due;
  const PendingAutoPay(this.cardId, this.bankName, this.cardNumber, this.due, this.cycleLabel);
  factory PendingAutoPay.fromJson(Map<String, dynamic> j) => PendingAutoPay(
      (j['cardId'] ?? '').toString(), (j['bankName'] ?? '').toString(), (j['cardNumber'] ?? '').toString(),
      (j['due'] ?? 0) as num, (j['cycleLabel'] ?? '').toString());
}
