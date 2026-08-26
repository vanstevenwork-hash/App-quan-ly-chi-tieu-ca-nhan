/// /transactions/summary → { income, expense, balance }
class Summary {
  final num income;
  final num expense;
  final num balance;
  const Summary({this.income = 0, this.expense = 0, this.balance = 0});

  factory Summary.fromJson(Map<String, dynamic> j) => Summary(
        income: (j['income'] ?? 0) as num,
        expense: (j['expense'] ?? 0) as num,
        balance: (j['balance'] ?? 0) as num,
      );
}
