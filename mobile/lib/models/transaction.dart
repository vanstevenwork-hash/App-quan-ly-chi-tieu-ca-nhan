/// Mirrors the web client's Transaction (hooks/useTransactions.ts).
class TransactionModel {
  final String id;
  final String type; // 'income' | 'expense'
  final num amount;
  final String category;
  final String note;
  final DateTime date;
  final String paymentMethod;
  final String? cardId;

  const TransactionModel({
    required this.id,
    required this.type,
    required this.amount,
    required this.category,
    required this.note,
    required this.date,
    required this.paymentMethod,
    this.cardId,
  });

  bool get isIncome => type == 'income';

  factory TransactionModel.fromJson(Map<String, dynamic> j) => TransactionModel(
        id: (j['_id'] ?? j['id'] ?? '').toString(),
        type: (j['type'] ?? 'expense').toString(),
        amount: (j['amount'] ?? 0) as num,
        category: (j['category'] ?? 'Khác').toString(),
        note: (j['note'] ?? '').toString(),
        date: DateTime.tryParse((j['date'] ?? '').toString())?.toLocal() ?? DateTime.now(),
        paymentMethod: (j['paymentMethod'] ?? 'cash').toString(),
        cardId: _extractCardId(j['cardId']),
      );

  // The API sometimes populates cardId as a full card object instead of a
  // plain id string — pull the _id out either way.
  static String? _extractCardId(dynamic v) {
    if (v == null) return null;
    if (v is Map) return (v['_id'] ?? v['id'])?.toString();
    return v.toString();
  }
}
