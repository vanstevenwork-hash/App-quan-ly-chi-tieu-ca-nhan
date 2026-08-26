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
  final String status; // active | completed | paused
  final num progress;

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
    required this.progress,
  });

  double get pct {
    if (targetAmount <= 0) return 0;
    final p = (currentAmount / targetAmount) * 100;
    return p.clamp(0, 100).toDouble();
  }

  factory Goal.fromJson(Map<String, dynamic> j) => Goal(
        id: (j['_id'] ?? j['id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        targetAmount: (j['targetAmount'] ?? 0) as num,
        currentAmount: (j['currentAmount'] ?? 0) as num,
        deadline: DateTime.tryParse((j['deadline'] ?? '').toString()),
        icon: (j['icon'] ?? '🎯').toString(),
        color: (j['color'] ?? '#6C63FF').toString(),
        category: (j['category'] ?? '').toString(),
        status: (j['status'] ?? 'active').toString(),
        progress: (j['progress'] ?? 0) as num,
      );
}
