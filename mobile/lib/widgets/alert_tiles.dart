import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:go_router/go_router.dart';

import '../services/game_service.dart';
import '../state/finance_providers.dart';
import '../state/important_alerts.dart';

import '../core/statement.dart';
import '../models/bank_card.dart';
import '../models/card_share.dart';
import '../theme/app_theme.dart';
import 'card_thumb.dart';

/// "Thông báo quan trọng" rows shared by the dashboard and the notifications
/// screen — port of the web AlertCard (credit / savings variants).

/// Credit statement due this cycle: card thumb, real amount, urgency badge
/// (red + filled when the due date is ≤ 3 days away).
class CreditAlertTile extends StatelessWidget {
  final BankCard card;
  final num due;
  final VoidCallback onTap;
  const CreditAlertTile({super.key, required this.card, required this.due, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    int? days;
    DateTime? dueDate;
    if (card.paymentDueDay > 0) {
      dueDate = dayOfMonth(today.year, today.month, card.paymentDueDay);
      if (dueDate.isBefore(today)) dueDate = dayOfMonth(today.year, today.month + 1, card.paymentDueDay);
      days = daysBetween(today, dueDate);
    }
    final urgent = days != null && days <= 3;
    final badge = days == null
        ? 'Cần thanh toán'
        : days == 0
            ? '⚠️ Đến hạn hôm nay'
            : days <= 3
                ? '⚠️ Còn $days ngày'
                : 'Đến hạn ${dueDate!.day}/${dueDate.month}';
    final sub = days == null || days > 3 ? 'Cần thanh toán kỳ này' : days == 0 ? 'Đến hạn hôm nay' : 'Còn $days ngày để thanh toán';

    return _Shell(
      onTap: onTap,
      urgent: urgent,
      leading: CardThumb(card: card, size: CardThumbSize.md, showLast4: true),
      title: 'Sao kê ${card.bankName}',
      sub: sub,
      amount: formatCompact(due),
      amountColor: const Color(0xFFEF4444),
      badge: badge,
      badgeFg: urgent ? Colors.white : const Color(0xFFEF4444),
      badgeBg: urgent ? const Color(0xFFEF4444) : const Color(0xFFFEF2F2),
      badgeBorder: urgent ? const Color(0xFFEF4444) : const Color(0xFFFECACA),
    );
  }
}

/// Savings book maturing soon.
class SavingsAlertTile extends StatelessWidget {
  final BankCard card;
  final VoidCallback onTap;
  const SavingsAlertTile({super.key, required this.card, required this.onTap});

  @override
  Widget build(BuildContext context) => _Shell(
        onTap: onTap,
        urgent: false,
        leading: Container(
          width: 36, height: 36, alignment: Alignment.center,
          decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.event_outlined, size: 17, color: Color(0xFFF59E0B)),
        ),
        title: 'Sổ tiết kiệm ${card.bankShortName}',
        sub: 'Kiểm tra kỳ hạn',
        amount: formatCompact(card.balance),
        amountColor: const Color(0xFFF59E0B),
        badge: 'Xem chi tiết',
        badgeFg: const Color(0xFFD97706),
        badgeBg: const Color(0xFFFFFBEB),
        badgeBorder: const Color(0xFFFDE68A),
      );
}

/// Card-share invite with inline Accept / Decline (web ShareInviteCard).
class InviteTile extends StatefulWidget {
  final SharedCard invite;
  final Future<void> Function(bool accept) onRespond;
  const InviteTile({super.key, required this.invite, required this.onRespond});
  @override
  State<InviteTile> createState() => _InviteTileState();
}

class _InviteTileState extends State<InviteTile> {
  bool _busy = false;

  Future<void> _go(bool accept) async {
    setState(() => _busy = true);
    try {
      await widget.onRespond(accept);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i = widget.invite;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE0E7FF)),
      ),
      child: Row(children: [
        Container(
          width: 36, height: 36, alignment: Alignment.center,
          decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(10)),
          child: const Text('🤝', style: TextStyle(fontSize: 17)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${i.ownerName.isNotEmpty ? i.ownerName : 'Ai đó'} mời chia sẻ thẻ', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
            Text('${i.card.bankName} •••• ${i.card.cardNumber}', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
          ]),
        ),
        const SizedBox(width: 6),
        if (_busy)
          const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
        else ...[
          GestureDetector(
            onTap: () => _go(false),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(10)),
              child: const Text('Từ chối', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate500)),
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: () => _go(true),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(color: const Color(0xFF4F46E5), borderRadius: BorderRadius.circular(10)),
              child: const Text('Chấp nhận', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ),
        ],
      ]),
    );
  }
}

/// Card-game invite with inline Chơi / Từ chối (web GameInviteCard).
class GameInviteTile extends StatelessWidget {
  final Map<String, dynamic> match;
  final void Function(bool accept) onRespond;
  const GameInviteTile({super.key, required this.match, required this.onRespond});

  @override
  Widget build(BuildContext context) {
    final host = match['hostId'] is Map ? (match['hostId']['name'] ?? '').toString() : '';
    final game = match['gameType'] == 'phom' ? 'Phỏm' : 'Tiến lên miền Nam';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.85), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFEDE9FE))),
      child: Row(children: [
        Container(
          width: 36, height: 36, alignment: Alignment.center,
          decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(10)),
          child: const Text('🃏', style: TextStyle(fontSize: 17)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${host.isNotEmpty ? host : 'Ai đó'} mời chơi bài', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
            Text(game, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
          ]),
        ),
        GestureDetector(
          onTap: () => onRespond(false),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(10)),
            child: const Text('Từ chối', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate500)),
          ),
        ),
        const SizedBox(width: 6),
        GestureDetector(
          onTap: () => onRespond(true),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: const Color(0xFF047857), borderRadius: BorderRadius.circular(10)),
            child: const Text('Chơi', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white)),
          ),
        ),
      ]),
    );
  }
}

/// Accept → straight into the table; decline → just drop the invite.
Future<void> respondToGameInvite(BuildContext context, WidgetRef ref, Map<String, dynamic> match, bool accept) async {
  final messenger = ScaffoldMessenger.of(context);
  final router = GoRouter.of(context);
  try {
    final r = await GameService().respond(match['_id'].toString(), accept);
    ref.invalidate(gameInvitesProvider);
    if (accept) {
      router.push('/games/${r['_id'] ?? match['_id']}');
    } else {
      messenger.showSnackBar(const SnackBar(content: Text('Đã từ chối lời mời')));
    }
  } catch (_) {
    messenger.showSnackBar(const SnackBar(content: Text('Thao tác thất bại')));
  }
}

/// Accept / decline a share invite, then refresh what depends on it.
Future<void> respondToInvite(BuildContext context, WidgetRef ref, SharedCard invite, bool accept) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    await ref.read(financeServiceProvider).respondShare(invite.shareId, accept);
    ref.invalidate(incomingInvitesProvider);
    ref.invalidate(sharedCardsProvider);
    messenger.showSnackBar(SnackBar(content: Text(accept ? 'Đã tham gia thẻ ${invite.card.bankName}' : 'Đã từ chối lời mời')));
  } catch (_) {
    messenger.showSnackBar(const SnackBar(content: Text('Thao tác thất bại')));
  }
}

class _Shell extends StatelessWidget {
  final VoidCallback onTap;
  final bool urgent;
  final Widget leading;
  final String title, sub, amount, badge;
  final Color amountColor, badgeFg, badgeBg, badgeBorder;

  const _Shell({
    required this.onTap, required this.urgent, required this.leading, required this.title, required this.sub,
    required this.amount, required this.amountColor, required this.badge, required this.badgeFg, required this.badgeBg,
    required this.badgeBorder,
  });

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: urgent ? const Color(0xFFFEF2F2).withValues(alpha: 0.85) : Colors.white.withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: urgent ? const Color(0xFFFECACA) : AppColors.slate100),
            boxShadow: const [BoxShadow(color: Color(0x0F0F172A), blurRadius: 4, offset: Offset(0, 1))],
          ),
          child: Row(children: [
            leading,
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                const SizedBox(height: 2),
                Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
              ]),
            ),
            const SizedBox(width: 8),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(amount, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: amountColor)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: badgeBg, border: Border.all(color: badgeBorder), borderRadius: BorderRadius.circular(20)),
                child: Text(badge, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: badgeFg)),
              ),
            ]),
          ]),
        ),
      );
}
