import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../constants/categories.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/card_thumb.dart';
import '../../widgets/common.dart';
import 'add_transaction_sheet.dart';
import 'expense_share_sheet.dart';

/// Transaction detail — port of the web TransactionDetailModal.
Future<void> showTransactionDetailSheet(BuildContext context, TransactionModel tx) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _TransactionDetailSheet(tx: tx),
  );
}

const _bg = Color(0xFFF8F9FF);
const _gradEnd = Color(0xFF9B4DE8);
const _weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

String _sourceKind(String type) => switch (type) {
      'credit' => 'Thẻ tín dụng',
      'debit' => 'Thẻ ghi nợ',
      'eWallet' => 'Ví điện tử',
      'savings' => 'Sổ tiết kiệm',
      _ => 'Tài khoản',
    };

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
      builder: (c) => AlertDialog(
        title: const Text('Xóa giao dịch?'),
        content: const Text('Giao dịch này sẽ bị xóa vĩnh viễn.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Hủy')),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
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
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop();
      messenger.showSnackBar(const SnackBar(content: Text('Đã xóa giao dịch')));
    } catch (_) {
      if (mounted) {
        setState(() => _deleting = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Xóa thất bại')));
      }
    }
  }

  void _openLightbox(String url) => showDialog<void>(
        context: context,
        barrierColor: Colors.black.withValues(alpha: 0.95),
        builder: (c) => GestureDetector(
          onTap: () => Navigator.pop(c),
          child: Stack(children: [
            Center(child: InteractiveViewer(child: ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(url, fit: BoxFit.contain)))),
            Positioned(
              top: MediaQuery.paddingOf(c).top + 12,
              right: 16,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.1), shape: BoxShape.circle),
                child: const Icon(Icons.close, color: Colors.white, size: 18),
              ),
            ),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final t = widget.tx;
    final cat = categoryByLabel(t.category);
    final d = t.date;
    BankCard? card;
    if (t.paymentMethod != 'cash' && t.cardId != null) {
      final own = ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[];
      final shared = (ref.watch(sharedCardsProvider).valueOrNull ?? const []).map((s) => s.card);
      card = [...own, ...shared].where((c) => c.id == t.cardId).firstOrNull;
    }
    final hasReceipt = t.receiptImage.isNotEmpty;
    final time = '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    final dateStr = '${_weekdays[d.weekday - 1]}, ${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.92),
      decoration: const BoxDecoration(color: _bg, borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 12, bottom: 4),
            alignment: Alignment.center,
            child: Container(width: 48, height: 5, decoration: BoxDecoration(color: AppColors.slate300, borderRadius: BorderRadius.circular(3))),
          ),
        ),
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Column(children: [
              // ── Header: receipt polaroid or category tile, amount, pills
              if (hasReceipt)
                GestureDetector(
                  onTap: () => _openLightbox(t.receiptImage),
                  child: Padding(
                    padding: const EdgeInsets.only(top: 10, bottom: 14),
                    child: Stack(clipBehavior: Clip.none, children: [
                      Transform.rotate(
                        angle: -0.052,
                        child: Container(
                          width: 112,
                          height: 144,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white, width: 3),
                            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 14, offset: const Offset(0, 6))],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(13),
                            child: Image.network(t.receiptImage, fit: BoxFit.cover, errorBuilder: (_, _, _) => const Icon(Icons.receipt_long, color: AppColors.slate400)),
                          ),
                        ),
                      ),
                      Positioned(
                        bottom: -8,
                        right: -8,
                        child: Container(
                          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white, width: 3)),
                          child: CategoryTile(iconType: cat.iconType, color: cat.color, size: 36),
                        ),
                      ),
                    ]),
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(top: 4, bottom: 6),
                  child: CategoryTile(iconType: cat.iconType, color: cat.color, size: 40),
                ),
              Text('${t.isIncome ? '+' : '-'}${formatMoney(t.amount)}đ',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: -0.3, color: t.isIncome ? AppColors.income : AppColors.slate900)),
              const SizedBox(height: 8),
              Wrap(alignment: WrapAlignment.center, spacing: 8, runSpacing: 6, children: [
                _pill(t.category, bg: cat.color.withValues(alpha: 0.08), border: cat.color.withValues(alpha: 0.25), fg: cat.color),
                _pill(t.isIncome ? 'Thu nhập' : 'Chi tiêu', bg: AppColors.slate100, border: AppColors.slate200, fg: AppColors.slate500),
                if (hasReceipt)
                  _pill('Có hóa đơn', bg: const Color(0xFFECFDF5), border: const Color(0xFFA7F3D0), fg: const Color(0xFF059669)),
                if (t.isInstallment && t.installmentMonths > 0)
                  _pill('Trả góp ${t.installmentMonths} th', bg: AppColors.brandLight.withValues(alpha: 0.35), border: AppColors.brandLight, fg: AppColors.brand),
              ]),
              const SizedBox(height: 14),
              // ── Details block
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.slate200),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1))],
                ),
                child: Column(children: _divided([
                  _row(
                                        label: 'Thời gian',
                    value: dateStr,
                    sub: '$time · ${d.hour < 12 ? 'Buổi sáng' : 'Buổi chiều'}',
                  ),
                  _row(
                    lead: card != null ? CardThumb(card: card, size: CardThumbSize.md) : null,
                    label: 'Nguồn tiền',
                    value: card != null ? '${card.bankName}${card.cardNumber.isNotEmpty ? ' ••${card.cardNumber}' : ''}' : (t.paymentMethod == 'cash' ? 'Tiền mặt' : 'Thẻ / Tài khoản'),
                    sub: card != null ? _sourceKind(card.cardType) : (t.isIncome ? 'Nhận bằng tiền mặt' : 'Chi tiêu bằng tiền mặt'),
                  ),
                  if (t.isInstallment && t.installmentMonths > 0)
                    _row(
                      label: 'Trả góp',
                      value: '${formatMoney(t.installmentMonthly > 0 ? t.installmentMonthly : (t.amount / t.installmentMonths).ceil())}đ/tháng',
                      sub: '${t.installmentMonths} kỳ · 0% lãi suất',
                    ),
                  if (t.feeAmount > 0)
                    _row(
                      label: 'Phí giao dịch',
                      value: '-${formatMoney(t.feeAmount)}đ',
                      valueColor: AppColors.expense,
                      sub: '${(t.amount > 0 ? t.feeAmount / t.amount * 100 : 0).toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '')}% · trừ vào tiền hoàn',
                    ),
                  if (t.note.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Ghi chú', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.slate500)),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Text('"${t.note}"',
                              textAlign: TextAlign.right,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, fontStyle: FontStyle.italic, color: AppColors.slate700)),
                        ),
                      ]),
                    ),
                  _row(
                    label: 'Mã giao dịch',
                    trailing: GestureDetector(
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: t.id));
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã sao chép mã giao dịch')));
                      },
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Text(t.id.length > 8 ? t.id.substring(t.id.length - 8).toUpperCase() : t.id.toUpperCase(),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, fontFamily: 'Menlo', color: AppColors.slate800)),
                        const SizedBox(width: 8),
                        Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(8)),
                          child: const Icon(Icons.copy_rounded, size: 13, color: AppColors.slate400),
                        ),
                      ]),
                    ),
                  ),
                ])),
              ),
            ]),
          ),
        ),
        // ── Footer actions
        Container(
          padding: EdgeInsets.fromLTRB(12, 12, 12, 12 + MediaQuery.paddingOf(context).bottom),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.9), border: const Border(top: BorderSide(color: AppColors.slate100))),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            if (!t.isIncome) ...[
              GestureDetector(
                onTap: () => showExpenseShareSheet(context, t),
                child: Container(
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.brandLight.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.brand.withValues(alpha: 0.3)),
                  ),
                  child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text('Chia sẻ hoá đơn', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.brand)),
                  ]),
                ),
              ),
              const SizedBox(height: 8),
            ],
            GestureDetector(
              onTap: _deleting
                  ? null
                  : () {
                      final nav = Navigator.of(context);
                      final parent = nav.context;
                      nav.pop();
                      showAddTransactionSheet(parent, initial: t);
                    },
              child: Container(
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppColors.brand, _gradEnd]),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [BoxShadow(color: const Color(0xFFA855F7).withValues(alpha: 0.25), blurRadius: 14, offset: const Offset(0, 6))],
                ),
                child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text('Sửa giao dịch', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                ]),
              ),
            ),
            const SizedBox(height: 4),
            TextButton(
              onPressed: _deleting ? null : _delete,
              style: TextButton.styleFrom(minimumSize: const Size(double.infinity, 36)),
              child: _deleting
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.expense))
                  : const Text('Xóa giao dịch này', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.w700, fontSize: 14)),
            ),
          ]),
        ),
      ]),
    );
  }

  List<Widget> _divided(List<Widget> rows) => [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const Divider(height: 1, color: AppColors.slate100),
          rows[i],
        ],
      ];

  Widget _pill(String text, {required Color bg, required Color border, required Color fg}) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999), border: Border.all(color: border)),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
      );

  Widget _row({Widget? lead, required String label, String? value, String? sub, Color? valueColor, Widget? trailing}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(children: [
          if (lead != null) ...[lead, const SizedBox(width: 12)],
          Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.slate500)),
          const SizedBox(width: 12),
          Expanded(
            child: trailing != null
                ? Align(alignment: Alignment.centerRight, child: trailing)
                : Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(value ?? '',
                        textAlign: TextAlign.right,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: valueColor ?? AppColors.slate800)),
                    if (sub != null) ...[
                      const SizedBox(height: 2),
                      Text(sub, textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                    ],
                  ]),
          ),
        ]),
      );
}
