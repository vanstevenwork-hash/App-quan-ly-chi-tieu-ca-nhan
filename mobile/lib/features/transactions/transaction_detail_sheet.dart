import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../constants/categories.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import 'add_transaction_sheet.dart';

Future<void> showTransactionDetailSheet(BuildContext context, TransactionModel tx) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _TransactionDetailSheet(tx: tx),
  );
}

class _TransactionDetailSheet extends ConsumerStatefulWidget {
  final TransactionModel tx;
  const _TransactionDetailSheet({required this.tx});
  @override
  ConsumerState<_TransactionDetailSheet> createState() => _TransactionDetailSheetState();
}

class _TransactionDetailSheetState extends ConsumerState<_TransactionDetailSheet> {
  bool _deleting = false;

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Xóa giao dịch?'),
        content: const Text('Giao dịch này sẽ bị xóa vĩnh viễn.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Hủy')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _deleting = true);
    try {
      await ref.read(financeServiceProvider).deleteTransaction(widget.tx.id);
      refreshFinance(ref);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) {
        setState(() => _deleting = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Xóa thất bại')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tx;
    final cat = categoryByLabel(t.category);
    final d = t.date;
    final time = '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.pageLight,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).padding.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 10),
          Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3))),
          const SizedBox(height: 20),
          CategoryTile(iconType: cat.iconType, color: cat.color, size: 64),
          const SizedBox(height: 12),
          Text(t.note.isNotEmpty ? t.note : t.category,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          const SizedBox(height: 4),
          Text('${t.isIncome ? '+' : '-'}${formatMoney(t.amount)}đ',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: t.isIncome ? AppColors.income : AppColors.expense)),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: WhiteCard(
              child: Column(children: [
                _row('Danh mục', t.category),
                const Divider(height: 18, color: AppColors.slate100),
                _row('Ngày', '${d.day}/${d.month}/${d.year} · $time'),
                const Divider(height: 18, color: AppColors.slate100),
                _row('Phương thức', t.paymentMethod == 'card' ? 'Thẻ / Ví' : 'Tiền mặt'),
                const Divider(height: 18, color: AppColors.slate100),
                _row('Loại', t.isIncome ? 'Thu nhập' : 'Chi tiêu'),
              ]),
            ),
          ),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(children: [
              Expanded(
                child: GestureDetector(
                  onTap: _deleting ? null : () async {
                    Navigator.of(context).pop();
                    await showAddTransactionSheet(context, initial: t);
                  },
                  child: Container(
                    height: 50,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: AppColors.brand, borderRadius: BorderRadius.circular(14)),
                    child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.edit_outlined, size: 18, color: Colors.white),
                      SizedBox(width: 8),
                      Text('Sửa', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                    ]),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GestureDetector(
                  onTap: _deleting ? null : _delete,
                  child: Container(
                    height: 50,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: AppColors.expense.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
                    child: _deleting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: AppColors.expense))
                        : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Icon(Icons.delete_outline, size: 18, color: AppColors.expense),
                            SizedBox(width: 8),
                            Text('Xóa', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold, fontSize: 15)),
                          ]),
                  ),
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _row(String k, String v) => Row(children: [
        Text(k, style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
        const Spacer(),
        Text(v, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate700)),
      ]);
}
