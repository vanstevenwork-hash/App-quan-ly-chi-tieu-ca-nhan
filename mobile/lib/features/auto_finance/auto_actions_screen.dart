import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/auto_action.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/common.dart';

final autoActionsProvider = FutureProvider.autoDispose((ref) => ref.read(financeServiceProvider).getAutoActions());

/// "Giao dịch tự động" — port of client/app/(app)/auto-actions/page.tsx.
class AutoActionsScreen extends ConsumerStatefulWidget {
  const AutoActionsScreen({super.key});

  @override
  ConsumerState<AutoActionsScreen> createState() => _AutoActionsScreenState();
}

class _AutoActionsScreenState extends ConsumerState<AutoActionsScreen> {
  String? _busy;

  Future<void> _revert(AutoActionInfo a) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hoàn tác?'),
        content: Text(a.isGoal
            ? 'Rút lại ${formatMoney(a.amount)}đ đã tự góp vào ${a.cardLabel}. Kỳ này sẽ không tự góp lại.'
            : a.isPay
            ? 'Tiền sẽ trả lại ${a.accountLabel}, dư nợ ${a.cardLabel} được khôi phục. Kỳ này sẽ không tự trừ lại — bạn thanh toán thủ công khi đã trả.'
            : 'Sổ được mở lại và trừ ${formatMoney(a.amount)}đ khỏi ${a.accountLabel.isEmpty ? 'tài khoản nhận' : a.accountLabel}. Sổ không tự tất toán lại tới khi bạn tái tục/sửa ngày đáo hạn.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Hoàn tác', style: TextStyle(color: AppColors.expense))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = a.id);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(financeServiceProvider).revertAutoAction(a.id);
      ref.invalidate(autoActionsProvider);
      refreshFinance(ref);
      messenger.showSnackBar(const SnackBar(content: Text('Đã hoàn tác')));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Hoàn tác thất bại')));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(autoActionsProvider);
    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(fallback: '/settings'),
        title: const PageTitle('Giao dịch tự động', subtitle: 'Tất toán, trừ thẻ & góp mục tiêu'),
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => ErrorRetry(onRetry: () => ref.invalidate(autoActionsProvider)),
        data: (d) {
          final monthStart = DateTime(DateTime.now().year, DateTime.now().month);
          final live = d.actions.where((a) => !a.reverted && !a.createdAt.isBefore(monthStart));
          final paid = live.where((a) => a.isPay).fold<num>(0, (s, a) => s + a.amount);
          final settled = live.where((a) => a.isSettle).fold<num>(0, (s, a) => s + a.amount);
          final goalSaved = live.where((a) => a.isGoal).fold<num>(0, (s, a) => s + a.amount);
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(autoActionsProvider),
            child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
              Row(children: [
                Expanded(child: _stat('Đã tự trừ thẻ tháng này', paid)),
                const SizedBox(width: 12),
                Expanded(child: _stat('Đã tất toán tháng này', settled)),
              ]),
              if (goalSaved > 0) ...[const SizedBox(height: 12), _stat('Đã tự góp mục tiêu tháng này', goalSaved)],
              if (d.pending.isNotEmpty) ...[
                const SizedBox(height: 18),
                const Text('Chưa trừ được tiền', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                const SizedBox(height: 8),
                for (final p in d.pending)
                  GestureDetector(
                    onTap: () => context.push('/cards/${p.cardId}'),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(color: const Color(0xFFFFFBEB), border: Border.all(color: const Color(0xFFFDE68A)), borderRadius: BorderRadius.circular(16)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${p.bankName} ••${p.cardNumber}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                        const SizedBox(height: 4),
                        Text('Sao kê ${p.cycleLabel} cần ${formatMoney(p.due)}đ — TK cùng ngân hàng chưa đủ tiền. App sẽ tự trừ khi đủ, hoặc bấm để thanh toán thủ công.',
                            style: const TextStyle(fontSize: 12, color: Color(0xFFB45309), height: 1.4)),
                      ]),
                    ),
                  ),
              ],
              const SizedBox(height: 18),
              const Text('Lịch sử', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              const SizedBox(height: 8),
              if (d.actions.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('Chưa có giao dịch tự động nào', style: TextStyle(color: AppColors.slate400))),
                ),
              for (final a in d.actions) _row(a),
            ]),
          );
        },
      ),
    );
  }

  Widget _stat(String label, num v) => WhiteCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
          const SizedBox(height: 4),
          Text('${formatMoney(v)}đ', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.slate800)),
        ]),
      );

  Widget _row(AutoActionInfo a) {
    String fmtDate(DateTime d) =>
        '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    return Opacity(
      opacity: a.reverted ? 0.6 : 1,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(a.isPay ? 'Tự trừ tiền ${a.cardLabel}' : a.isGoal ? 'Góp tự động ${a.cardLabel}' : 'Tất toán ${a.cardLabel}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              const SizedBox(height: 2),
              Text(
                a.isGoal
                    ? '+${formatMoney(a.amount)}đ vào mục tiêu${a.accountLabel.isEmpty ? '' : ' · ${a.accountLabel}'}'
                    : a.isPay
                    ? '${formatMoney(a.amount)}đ từ ${a.accountLabel}'
                    : '${formatMoney(a.amount)}đ (lãi ${formatMoney(a.interest)}đ) → ${a.accountLabel.isEmpty ? 'chưa có TK nhận' : a.accountLabel}',
                style: const TextStyle(fontSize: 12, color: AppColors.slate500),
              ),
              const SizedBox(height: 3),
              Text('${fmtDate(a.createdAt)}${a.reverted && a.revertedAt != null ? ' · đã hoàn tác ${fmtDate(a.revertedAt!)}' : ''}',
                  style: const TextStyle(fontSize: 10, color: AppColors.slate400)),
            ]),
          ),
          const SizedBox(width: 8),
          a.reverted
              ? const Text('Đã hoàn tác', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate400))
              : GestureDetector(
                  onTap: _busy == a.id ? null : () => _revert(a),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10)),
                    child: Text(_busy == a.id ? '...' : 'Hoàn tác', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.expense)),
                  ),
                ),
        ]),
      ),
    );
  }
}
