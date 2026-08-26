import 'package:flutter/material.dart';
import '../constants/categories.dart';
import '../models/transaction.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// A single transaction line (category tile + note/time + signed amount),
/// reused by the dashboard, calendar and analytics lists.
class TransactionRow extends StatelessWidget {
  final TransactionModel tx;
  final VoidCallback? onTap;
  const TransactionRow({super.key, required this.tx, this.onTap});

  @override
  Widget build(BuildContext context) {
    final cat = categoryByLabel(tx.category);
    final time = TimeOfDay.fromDateTime(tx.date);
    final hh = time.hour.toString().padLeft(2, '0');
    final mm = time.minute.toString().padLeft(2, '0');
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            CategoryTile(iconType: cat.iconType, color: cat.color, size: 38),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tx.note.isNotEmpty ? tx.note : tx.category,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                  const SizedBox(height: 2),
                  Text('${tx.category} · $hh:$mm',
                      style: const TextStyle(fontSize: 11, color: AppColors.slate400, fontWeight: FontWeight.w500)),
                ],
              ),
            ),
            Text('${tx.isIncome ? '+' : '-'}${formatCompact(tx.amount)}đ',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: tx.isIncome ? AppColors.income : AppColors.expense)),
          ],
        ),
      ),
    );
  }
}
