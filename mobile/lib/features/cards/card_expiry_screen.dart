import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/card_expiry.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/card_thumb.dart';

/// "Hạn thẻ" — port of client/app/(app)/cards/expiry/page.tsx.
class CardExpiryScreen extends ConsumerWidget {
  const CardExpiryScreen({super.key});

  static const _style = {
    ExpiryStatus.expired: (Color(0xFFEF4444), 'Đã hết hạn'),
    ExpiryStatus.soon: (Color(0xFFF59E0B), 'Sắp hết hạn'),
    ExpiryStatus.ok: (Color(0xFF10B981), 'Còn hạn'),
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(cardsProvider).valueOrNull ?? const [];
    final rows = expiryRows(cards, DateTime.now());
    final fee = rows.where((r) => r.feeDueSoon).length;
    final soon = rows.where((r) => r.status != ExpiryStatus.ok).length;

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(fallback: '/accounts'),
        title: const PageTitle('Hạn thẻ', subtitle: 'Quản lý'),
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
        Row(children: [
          _stat('${rows.length}', 'Tổng thẻ', const Color(0xFF6366F1)),
          const SizedBox(width: 8),
          _stat('$fee', 'Sắp đóng phí', const Color(0xFFF59E0B)),
          const SizedBox(width: 8),
          _stat('$soon', 'Sắp/đã hết hạn', const Color(0xFFEF4444)),
        ]),
        const SizedBox(height: 16),
        if (rows.isEmpty)
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
            child: const Column(children: [
              Icon(Icons.event_outlined, size: 30, color: Color(0xFF6366F1)),
              SizedBox(height: 8),
              Text('Chưa có thẻ nào có ngày hết hạn', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate700)),
              SizedBox(height: 4),
              Text('Thêm ngày hết hạn (MM/YY) khi tạo/sửa thẻ để theo dõi ở đây.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.slate400)),
            ]),
          ),
        for (final r in rows)
          GestureDetector(
            onTap: () => context.push('/cards/${r.card.id}'),
            child: Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
              child: Row(children: [
                CardThumb(card: r.card, size: CardThumbSize.lg),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text.rich(TextSpan(children: [
                      TextSpan(text: r.card.bankName, style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.slate800)),
                      TextSpan(text: '  •••• ${r.card.cardNumber}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.slate400)),
                    ]), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14)),
                    const SizedBox(height: 2),
                    Text.rich(TextSpan(children: [
                      const TextSpan(text: 'Hết hạn '),
                      TextSpan(text: r.label, style: TextStyle(fontWeight: FontWeight.bold, color: _style[r.status]!.$1)),
                      TextSpan(text: ' · ${r.remaining}'),
                    ]), style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
                    if (r.annualFee > 0)
                      Text(
                        r.feeDueSoon
                            ? '⚠ Sắp đóng phí TN ${formatMoney(r.annualFee)}đ · còn ${r.feeDays < 0 ? 0 : r.feeDays} ngày'
                            : 'Phí TN ${formatMoney(r.annualFee)}đ · đóng T${r.feeMonth} hằng năm',
                        style: TextStyle(fontSize: 12, color: r.feeDueSoon ? const Color(0xFFF59E0B) : AppColors.slate400,
                            fontWeight: r.feeDueSoon ? FontWeight.bold : FontWeight.normal),
                      ),
                  ]),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (r.feeDueSoon ? const Color(0xFFF59E0B) : _style[r.status]!.$1).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(r.feeDueSoon ? 'Sắp đóng phí' : _style[r.status]!.$2,
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: r.feeDueSoon ? const Color(0xFFF59E0B) : _style[r.status]!.$1)),
                ),
              ]),
            ),
          ),
      ]),
    );
  }

  Widget _stat(String v, String label, Color c) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: kCardShadow),
          child: Column(children: [
            Text(v, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: c)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.slate400)),
          ]),
        ),
      );
}
