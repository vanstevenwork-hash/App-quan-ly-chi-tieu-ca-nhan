/// One deposit / withdrawal into a goal.
class GoalContribution {
  final String id;
  final num amount;
  final String type; // deposit | withdraw
  final String note;
  final DateTime date;
  const GoalContribution({required this.id, required this.amount, required this.type, required this.note, required this.date});

  bool get isDeposit => type != 'withdraw';

  factory GoalContribution.fromJson(Map<String, dynamic> j) => GoalContribution(
        id: (j['_id'] ?? '').toString(),
        amount: (j['amount'] as num?) ?? 0,
        type: (j['type'] ?? 'deposit').toString(),
        note: (j['note'] ?? '').toString(),
        date: DateTime.tryParse((j['date'] ?? '').toString())?.toLocal() ?? DateTime.now(),
      );
}

/// Mirrors the web client's Goal (hooks/useGoals.ts).
class Goal {
  final String id;
  final String name;
  final num targetAmount;
  final num currentAmount;
  final DateTime? deadline;
  final String icon;
  final String color;
  final String category;
  final String description;
  final String status; // active | completed | paused
  final num autoSaveAmount;
  final String autoSaveFrequency;
  final List<GoalContribution> contributions;
  final DateTime createdAt;

  const Goal({
    required this.id,
    required this.name,
    required this.targetAmount,
    required this.currentAmount,
    required this.deadline,
    required this.icon,
    required this.color,
    required this.category,
    required this.status,
    this.description = '',
    this.autoSaveAmount = 0,
    this.autoSaveFrequency = '',
    this.contributions = const [],
    required this.createdAt,
  });

  bool get isCompleted => status == 'completed';

  /// 0–100, rounded like the server's virtual `progress`.
  int get progress => targetAmount <= 0 ? 0 : (currentAmount / targetAmount * 100).round().clamp(0, 100);
  double get pct => progress.toDouble();

  factory Goal.fromJson(Map<String, dynamic> j) => Goal(
        id: (j['_id'] ?? j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        targetAmount: (j['targetAmount'] as num?) ?? 0,
        currentAmount: (j['currentAmount'] as num?) ?? 0,
        deadline: DateTime.tryParse((j['deadline'] ?? '').toString())?.toLocal(),
        icon: (j['icon'] ?? '🎯').toString(),
        color: (j['color'] ?? '#6C63FF').toString(),
        category: (j['category'] ?? 'other').toString(),
        description: (j['description'] ?? '').toString(),
        status: (j['status'] ?? 'active').toString(),
        autoSaveAmount: (j['autoSaveAmount'] as num?) ?? 0,
        autoSaveFrequency: (j['autoSaveFrequency'] ?? '').toString(),
        contributions: (j['contributions'] is List)
            ? (j['contributions'] as List).whereType<Map>().map((e) => GoalContribution.fromJson(Map<String, dynamic>.from(e))).toList()
            : const [],
        createdAt: DateTime.tryParse((j['createdAt'] ?? '').toString())?.toLocal() ?? DateTime.now(),
      );
}
