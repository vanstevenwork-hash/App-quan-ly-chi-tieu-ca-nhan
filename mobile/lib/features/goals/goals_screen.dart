import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/goal.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

class GoalsScreen extends ConsumerWidget {
  const GoalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goalsAsync = ref.watch(goalsProvider);
    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(goalsProvider);
            await ref.read(goalsProvider.future).catchError((_) => <Goal>[]);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
            children: [
              const Text('Mục tiêu',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              const SizedBox(height: 16),
              goalsAsync.when(
                data: (goals) => goals.isEmpty
                    ? const WhiteCard(
                        padding: EdgeInsets.all(28),
                        child: Center(
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Text('🎯', style: TextStyle(fontSize: 32)),
                            SizedBox(height: 10),
                            Text('Chưa có mục tiêu nào', style: TextStyle(color: AppColors.slate400, fontSize: 13)),
                          ]),
                        ),
                      )
                    : Column(children: [for (final g in goals) ...[_goalCard(g), const SizedBox(height: 12)]]),
                loading: () => const LoadingBox(height: 200),
                error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(goalsProvider)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _goalCard(Goal g) {
    final color = hexColor(g.color, fallback: AppColors.primary);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: kCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 42, height: 42,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
              child: Text(g.icon, style: const TextStyle(fontSize: 20)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(g.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                  Text('${formatCompact(g.currentAmount)} / ${formatCompact(g.targetAmount)}đ',
                      style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                ],
              ),
            ),
            Text('${g.pct.round()}%', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color)),
          ]),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: g.pct / 100,
              minHeight: 8,
              backgroundColor: AppColors.slate100,
              valueColor: AlwaysStoppedAnimation(color),
            ),
          ),
        ],
      ),
    );
  }
}
