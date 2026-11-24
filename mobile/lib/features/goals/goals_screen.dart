import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/goal.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../../widgets/tab_header.dart';
import 'goal_sheets.dart';

/// "Mục tiêu" — port of client/app/(app)/goals + GoalsStatsAndFilters +
/// GoalsList: one-line stats, filter pills + sort, goal cards (progress ring,
/// deadline, scale bar, pace insight, Góp tiền / Góp tự động, ⋯ menu),
/// templates and an empty state.
class GoalsScreen extends ConsumerStatefulWidget {
  const GoalsScreen({super.key});
  @override
  ConsumerState<GoalsScreen> createState() => _GoalsScreenState();
}

enum _Filter { all, active, completed }

enum _Sort { deadline, progress, amount }

const _sortLabels = {
  _Sort.deadline: 'Hạn chót',
  _Sort.progress: 'Tiến độ',
  _Sort.amount: 'Số tiền',
};
const _monthMs = 30 * 86400000;

/// "120tr" / "1,5 tỷ" (web fmtViShort).
String _vi(num n) {
  final a = n.abs();
  if (a >= 1e9) {
    return '${(a / 1e9).toStringAsFixed(2).replaceAll('.', ',')} tỷ'
        .replaceFirst(RegExp(r',?0+ tỷ$'), ' tỷ');
  }
  if (a >= 1e6) {
    return '${(a / 1e6).toStringAsFixed(1).replaceAll('.', ',')}tr'.replaceAll(
      ',0tr',
      'tr',
    );
  }
  if (a >= 1e3) return '${(a / 1e3).round()}k';
  return '${a.round()}';
}

int _daysLeft(DateTime d) =>
    (d.difference(DateTime.now()).inMilliseconds / 86400000).ceil();

class _GoalsScreenState extends ConsumerState<GoalsScreen> {
  _Filter _filter = _Filter.all;
  _Sort _sort = _Sort.deadline;

  Future<void> _delete(Goal g) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (c) => Container(
        margin: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          32 + MediaQuery.paddingOf(c).bottom,
        ),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Xoá mục tiêu?',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.slate900,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Hành động này không thể hoàn tác.',
              style: TextStyle(fontSize: 14, color: AppColors.slate500),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(c, false),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 48),
                      side: const BorderSide(color: AppColors.slate200),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text(
                      'Huỷ',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate600,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(c, true),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 48),
                      backgroundColor: const Color(0xFFEF4444),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text(
                      'Xóa',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await ref.read(financeServiceProvider).deleteGoal(g.id);
      ref.invalidate(goalsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Đã xóa mục tiêu')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Lỗi khi xóa mục tiêu')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(goalsProvider);
    final goals = async.valueOrNull ?? const <Goal>[];
    final completed = goals.where((g) => g.isCompleted).length;
    final saved = goals.fold<num>(0, (s, g) => s + g.currentAmount);
    final list =
        goals
            .where(
              (g) => switch (_filter) {
                _Filter.all => true,
                _Filter.active => g.status == 'active',
                _Filter.completed => g.isCompleted,
              },
            )
            .toList()
          ..sort(
            (a, b) => switch (_sort) {
              _Sort.progress => b.progress.compareTo(a.progress),
              _Sort.amount => b.targetAmount.compareTo(a.targetAmount),
              _Sort.deadline =>
                (a.deadline == null ? 999999 : _daysLeft(a.deadline!))
                    .compareTo(
                      b.deadline == null ? 999999 : _daysLeft(b.deadline!),
                    ),
            },
          );

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: Stack(
        children: [
          Container(
            height: 384,
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x4DE0C3FC), Color(0x00E0C3FC)],
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                ref.invalidate(goalsProvider);
                await ref
                    .read(goalsProvider.future)
                    .catchError((_) => <Goal>[]);
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                children: [
                  TabHeader(
                    title: 'Mục tiêu',
                    subtitle: 'Theo dõi',
                    actions: [
                      HeaderButton(
                        icon: Icons.add_rounded,
                        style: HeaderButtonStyle.filled,
                        tooltip: 'Thêm mục tiêu',
                        onTap: () => showGoalFormSheet(context),
                      ),
                      HeaderButton(
                        icon: Icons.refresh_rounded,
                        tooltip: 'Làm mới',
                        onTap: () => ref.invalidate(goalsProvider),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (async.isLoading && goals.isEmpty) ...[
                    const LoadingBox(height: 192),
                    const SizedBox(height: 16),
                    const LoadingBox(height: 192),
                  ] else if (async.hasError && goals.isEmpty)
                    ErrorRetry(onRetry: () => ref.invalidate(goalsProvider))
                  else if (goals.isEmpty)
                    _empty()
                  else ...[
                    _stats(goals.length, completed, saved),
                    const SizedBox(height: 12),
                    _filters(),
                    const SizedBox(height: 12),
                    if (list.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 48),
                        child: Center(
                          child: Text(
                            'Không có mục tiêu nào trong tab này',
                            style: TextStyle(
                              fontSize: 14,
                              color: AppColors.slate400,
                            ),
                          ),
                        ),
                      ),
                    for (final g in list)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: _GoalCard(goal: g, onDelete: () => _delete(g)),
                      ),
                    _templates(),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stats(int total, int completed, num saved) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFF3F4F6)),
      boxShadow: kCardShadow,
    ),
    child: Text.rich(
      TextSpan(
        style: const TextStyle(
          fontSize: 13,
          color: AppColors.slate400,
          fontWeight: FontWeight.w500,
        ),
        children: [
          TextSpan(
            text: '$total',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.slate900,
            ),
          ),
          const TextSpan(text: ' mục tiêu  ·  '),
          TextSpan(
            text: '$completed',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.slate900,
            ),
          ),
          const TextSpan(text: ' hoàn thành  ·  đã để dành '),
          TextSpan(
            text: '${_vi(saved)}đ',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.slate900,
            ),
          ),
        ],
      ),
      textAlign: TextAlign.center,
    ),
  );

  Widget _filters() => Row(
    children: [
      Expanded(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final (f, l) in [
                (_Filter.all, 'Tất cả'),
                (_Filter.active, 'Đang thực hiện'),
                (_Filter.completed, 'Hoàn thành'),
              ]) ...[
                GestureDetector(
                  onTap: () => setState(() => _filter = f),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: _filter == f ? AppColors.brand : Colors.white,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: _filter == f
                            ? Colors.transparent
                            : AppColors.slate200,
                      ),
                      boxShadow: _filter == f
                          ? [
                              BoxShadow(
                                color: AppColors.brand.withValues(alpha: 0.3),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Text(
                      l,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _filter == f ? Colors.white : AppColors.slate500,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
              ],
            ],
          ),
        ),
      ),
      const SizedBox(width: 6),
      GestureDetector(
        onTap: () => setState(
          () => _sort = _Sort.values[(_sort.index + 1) % _Sort.values.length],
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: AppColors.slate200),
          ),
          child: Row(
            children: [
              Text(
                _sortLabels[_sort]!,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.slate600,
                ),
              ),
              const SizedBox(width: 2),
              const Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 14,
                color: AppColors.slate600,
              ),
            ],
          ),
        ),
      ),
    ],
  );

  Widget _templates() => Padding(
    padding: const EdgeInsets.only(top: 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Bắt đầu mục tiêu mới',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.slate800,
                ),
              ),
            ),
            GestureDetector(
              onTap: () => showGoalFormSheet(context),
              child: const Text(
                'Mẫu có sẵn',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF9333EA),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final (label, sub, cat) in [
                ('Du lịch', 'từ 20tr', 'travel'),
                ('Quỹ khẩn cấp', '3–6 tháng chi tiêu', 'emergency'),
                ('Mua xe', 'từ 400tr', 'car'),
              ]) ...[
                Expanded(
                  child: GestureDetector(
                    onTap: () =>
                        showGoalFormSheet(context, presetCategory: cat),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFF3F4F6)),
                        boxShadow: kCardShadow,
                      ),
                      child: Column(
                        children: [
                          Text(
                            label,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.slate800,
                              height: 1.2,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            sub,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.slate400,
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                if (cat != 'car') const SizedBox(width: 12),
              ],
            ],
          ),
        ),
      ],
    ),
  );

  Widget _empty() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 48),
    child: Column(
      children: [
        const Text(
          'Chưa có mục tiêu nào',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.slate800,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Đặt mục tiêu tài chính và theo dõi tiến độ để đạt được ước mơ của bạn!',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: AppColors.slate500,
            height: 1.5,
          ),
        ),
        const SizedBox(height: 32),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 3,
          children: [
            for (final (label, cat) in [
              ('Mua nhà', 'house'),
              ('Du lịch', 'travel'),
              ('Mua xe', 'car'),
              ('Quỹ khẩn cấp', 'emergency'),
            ])
              GestureDetector(
                onTap: () => showGoalFormSheet(context, presetCategory: cat),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.slate200, width: 2),
                  ),
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          label,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.slate500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 32),
        GestureDetector(
          onTap: () => showGoalFormSheet(context),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                colors: [Color(0xFF6C63FF), Color(0xFF8B5CF6)],
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF6C63FF).withValues(alpha: 0.3),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: const Text(
              'Tạo mục tiêu đầu tiên',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

// ─── Goal card ──────────────────────────────────────────────────────────

class _GoalCard extends StatelessWidget {
  final Goal goal;
  final VoidCallback onDelete;
  const _GoalCard({required this.goal, required this.onDelete});

  /// Needed-per-month vs actual recent pace (web buildInsight).
  List<InlineSpan>? _insight(num remaining, int? monthsRemain) {
    final g = goal;
    if (g.isCompleted || remaining <= 0) return null;
    TextSpan b(String t) => TextSpan(
      text: t,
      style: const TextStyle(
        fontWeight: FontWeight.w700,
        color: AppColors.slate900,
      ),
    );
    TextSpan t(String s) => TextSpan(text: s);
    final now = DateTime.now().millisecondsSinceEpoch;
    final recentNet = g.contributions
        .where((c) => now - c.date.millisecondsSinceEpoch <= 3 * _monthMs)
        .fold<num>(0, (s, c) => s + (c.isDeposit ? c.amount : -c.amount));
    num pace = recentNet / 3;
    var paceLabel = '3 tháng gần đây';
    if (pace <= 0) {
      final monthsSince = math.max(
        1,
        (now - g.createdAt.millisecondsSinceEpoch) / _monthMs,
      );
      pace = g.currentAmount / monthsSince;
      paceLabel = 'từ khi tạo';
    }
    if (monthsRemain != null && monthsRemain > 0) {
      final needed = remaining / monthsRemain;
      if (pace <= 0) {
        return [
          t('Để về đích đúng hạn, bạn cần để dành '),
          b('${_vi(needed)}/tháng'),
          t('. Hãy bắt đầu góp ngay hôm nay!'),
        ];
      }
      final delay = (remaining / pace - monthsRemain).round();
      if (delay > 0) {
        return [
          t('Để về đích đúng hạn, bạn cần để dành '),
          b('${_vi(needed)}/tháng'),
          t('. Với đà $paceLabel ('),
          b('${_vi(pace)}/tháng'),
          t('), bạn sẽ trễ khoảng '),
          b('$delay tháng'),
          t('.'),
        ];
      }
      if (delay < 0) {
        return [
          t('Với đà $paceLabel ('),
          b('${_vi(pace)}/tháng'),
          t('), bạn sẽ về đích sớm khoảng '),
          b('${delay.abs()} tháng'),
          t('. Tuyệt vời, giữ vững phong độ!'),
        ];
      }
      return [
        t('Bạn đang '),
        b('đúng tiến độ'),
        t(' — giữ nhịp '),
        b('${_vi(needed)}/tháng'),
        t(' là về đích đúng hạn.'),
      ];
    }
    if (monthsRemain != null && monthsRemain <= 0) {
      return [
        t('Mục tiêu đã '),
        b('quá hạn'),
        t(' — còn thiếu '),
        b(_vi(remaining)),
        t('. Cân nhắc dời hạn chót hoặc tăng tốc góp.'),
      ];
    }
    if (pace > 0) {
      return [
        t('Với đà $paceLabel ('),
        b('${_vi(pace)}/tháng'),
        t('), bạn cần khoảng '),
        b('${(remaining / pace).ceil()} tháng'),
        t(' nữa để hoàn thành.'),
      ];
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final g = goal;
    final color = hexColor(g.color, fallback: AppColors.primary);
    final pct = g.progress;
    final remaining = math.max<num>(0, g.targetAmount - g.currentAmount);
    final days = g.deadline == null ? null : _daysLeft(g.deadline!);
    final monthsRemain = days == null ? null : math.max(0, (days / 30).round());
    final insight = _insight(remaining, monthsRemain);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF3F4F6)),
        boxShadow: kCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _ring(pct, color, g.icon),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      g.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (g.deadline != null)
                      Text.rich(
                        TextSpan(
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.slate400,
                          ),
                          children: [
                            const TextSpan(text: 'Hạn chót '),
                            TextSpan(
                              text: 'T${g.deadline!.month}/${g.deadline!.year}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFF59E0B),
                              ),
                            ),
                            if (monthsRemain != null &&
                                monthsRemain > 0 &&
                                !g.isCompleted)
                              TextSpan(text: ' · còn $monthsRemain tháng'),
                          ],
                        ),
                      )
                    else if (g.description.isNotEmpty)
                      Text(
                        g.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.slate400,
                        ),
                      ),
                    const SizedBox(height: 6),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: _vi(g.currentAmount),
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: AppColors.slate900,
                            ),
                          ),
                          TextSpan(
                            text: ' / ${_vi(g.targetAmount)}',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.slate400,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              _menu(context),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: pct / 100,
              minHeight: 8,
              backgroundColor: AppColors.slate100,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              for (final f in [0.0, 0.25, 0.5, 0.75, 1.0])
                Text(
                  f == 0 ? '0' : _vi(g.targetAmount * f),
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w500,
                    color: AppColors.slate400,
                  ),
                ),
            ],
          ),
          if (insight != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF2FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE0E7FF)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.5,
                          color: AppColors.slate600,
                        ),
                        children: insight,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (!g.isCompleted)
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => showGoalContributeSheet(context, g),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        gradient: const LinearGradient(
                          colors: [Color(0xFF8B7CF6), Color(0xFF6C63FF)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.brand.withValues(alpha: 0.3),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Góp tiền vào mục tiêu',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: () => showGoalFormSheet(context, initial: g),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 11,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.slate100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppColors.slate200.withValues(alpha: 0.7),
                      ),
                    ),
                    child: Text(
                      g.autoSaveAmount > 0 && g.autoSaveFrequency.isNotEmpty
                        ? 'Tự động: ${_vi(g.autoSaveAmount)}/${const {'daily': 'ngày', 'weekly': 'tuần', 'monthly': 'tháng'}[g.autoSaveFrequency] ?? ''}'
                          : 'Góp tự động',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate500,
                      ),
                    ),
                  ),
                ),
              ],
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Đã hoàn thành',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF047857),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _ring(int pct, Color color, String icon) => SizedBox(
    width: 66,
    height: 70,
    child: Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        SizedBox(
          width: 66,
          height: 66,
          child: TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: pct / 100),
            duration: const Duration(milliseconds: 700),
            curve: Curves.easeOut,
            builder: (_, v, _) => CircularProgressIndicator(
              value: v,
              strokeWidth: 5,
              strokeCap: StrokeCap.round,
              backgroundColor: AppColors.slate100,
              color: color,
            ),
          ),
        ),
        Positioned(
          top: 7,
          child: Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Text(icon, style: const TextStyle(fontSize: 21)),
          ),
        ),
        Positioned(
          bottom: 0,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(999),
              boxShadow: kCardShadow,
            ),
            child: Text(
              '$pct%',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _menu(BuildContext context) => PopupMenuButton<String>(
    padding: EdgeInsets.zero,
    position: PopupMenuPosition.under,
    color: Colors.white,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    onSelected: (v) =>
        v == 'edit' ? showGoalFormSheet(context, initial: goal) : onDelete(),
    itemBuilder: (_) => [
      if (!goal.isCompleted)
        const PopupMenuItem(
          value: 'edit',
          child: Row(
            children: [
              Text(
                'Chỉnh sửa',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.slate700,
                ),
              ),
            ],
          ),
        ),
      const PopupMenuItem(
        value: 'delete',
        child: Row(
          children: [
            Text(
              'Xóa mục tiêu',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFFEF4444),
              ),
            ),
          ],
        ),
      ),
    ],
    child: Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.slate100),
      ),
      child: const Icon(
        Icons.more_horiz_rounded,
        size: 16,
        color: AppColors.slate400,
      ),
    ),
  );
}
