import 'dart:ui' as ui;
import '../../models/card_share.dart';
import 'package:flutter/material.dart';
import '../../core/bank_logos.dart';
import '../../core/card_art.dart';

import '../../widgets/card_thumb.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/bank_card.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../cards/card_form_sheet.dart';
import '../savings/savings_screen.dart' show SavingsDeck;
import '../../widgets/tab_header.dart';
import 'package:flutter_svg/flutter_svg.dart';

class AccountsScreen extends ConsumerStatefulWidget {
  const AccountsScreen({super.key});
  @override
  ConsumerState<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends ConsumerState<AccountsScreen> {
  String _tab = 'cards'; // cards | savings
  String? _frontId; // credit card on top of the deck
  bool _payExpanded = true; // "Tài khoản thanh toán" section open

  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(cardsProvider);
    final totals = ref.watch(cardTotalsProvider);
    final cards = cardsAsync.valueOrNull ?? const <BankCard>[];
    final credit = cards.where((c) => c.isCredit).toList();
    final payment = cards
        .where(
          (c) =>
              c.cardType == 'debit' ||
              c.cardType == 'eWallet' ||
              c.cardType == 'crypto',
        )
        .toList();
    final savings = cards.where((c) => c.isSavings).toList();

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(cardsProvider);
            await ref
                .read(cardsProvider.future)
                .catchError((_) => <BankCard>[]);
          },
          child: cardsAsync.isLoading && cards.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
                  children: [
                    TabHeader(
                      title: 'Tài khoản & Tài sản',
                      subtitle: 'Tài chính',
                      actions: [
                        HeaderButton(
                          icon: Icons.refresh_rounded,
                          tooltip: 'Làm mới',
                          onTap: () => refreshFinance(ref),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    _netWorthCard(totals),
                    const SizedBox(height: 18),
                    _tabs(credit.length + payment.length, savings.length),
                    const SizedBox(height: 18),
                    if (_tab == 'cards')
                      ..._cardsTab(credit, payment)
                    else
                      ..._savingsTab(savings),
                  ],
                ),
        ),
      ),
    );
  }

  // ── Tabs ──
  Widget _tabs(int cardsCount, int savingsCount) {
    Widget tab(String v, String label, int count) {
      final active = _tab == v;
      return Expanded(
        child: GestureDetector(
          onTap: () => setState(() => _tab = v),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? AppColors.brand : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: active ? Colors.white : AppColors.slate500,
                  ),
                ),
                if (count > 0) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 1,
                    ),
                    decoration: BoxDecoration(
                      color: active
                          ? Colors.white
                          : AppColors.brandLight.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '$count',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppColors.brand,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: kCardShadow,
      ),
      child: Row(
        children: [
          tab('cards', 'Thẻ & Ví', cardsCount),
          tab('savings', 'Tiết kiệm', savingsCount),
        ],
      ),
    );
  }

  // ── Cards tab ──
  List<Widget> _cardsTab(List<BankCard> credit, List<BankCard> payment) => [
    if (credit.isNotEmpty) ...[
      _deck(credit),
      const SizedBox(height: 14),
      Row(children: [
        Expanded(child: _quickLink('Lịch sao kê', '/statements')),
        const SizedBox(width: 10),
        Expanded(child: _quickLink('Tự động', '/auto-actions')),
      ]),
      const SizedBox(height: 20),
    ],
    // Cards without artwork → one-tap matcher (same banner as the web).
    if ([...credit, ...payment].where((c) => c.cardType != 'eWallet' && safeCardImage(c.cardImage) == null).isNotEmpty) ...[
      GestureDetector(
        onTap: () => context.push('/cards/designs'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${[...credit, ...payment].where((c) => c.cardType != 'eWallet' && safeCardImage(c.cardImage) == null).length} thẻ chưa có ảnh',
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                const Text('Tự gắn ảnh theo tên thẻ bạn đã đặt', style: TextStyle(fontSize: 11, color: AppColors.slate500)),
              ]),
            ),
            const Text('Gắn ảnh ›', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary)),
          ]),
        ),
      ),
      const SizedBox(height: 20),
    ],
    Row(children: [
      GestureDetector(
        onTap: payment.isEmpty ? null : () => setState(() => _payExpanded = !_payExpanded),
        behavior: HitTestBehavior.opaque,
        child: Row(children: [
          const Text('TÀI KHOẢN THANH TOÁN', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.slate400, letterSpacing: 1.8)),
          if (payment.isNotEmpty) ...[
            const SizedBox(width: 4),
            AnimatedRotation(
              turns: _payExpanded ? 0 : -0.25,
              duration: const Duration(milliseconds: 200),
              child: const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: AppColors.slate400),
            ),
          ],
        ]),
      ),
      const Spacer(),
      GestureDetector(
        onTap: () => showCardFormSheet(context, initialType: 'debit'),
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.brand,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [BoxShadow(color: AppColors.brand.withValues(alpha: 0.3), blurRadius: 4, offset: const Offset(0, 1))],
          ),
          child: const Icon(Icons.add, size: 16, color: Colors.white),
        ),
      ),
    ]),
    const SizedBox(height: 12),
    if (payment.isEmpty)
      Container(
        padding: const EdgeInsets.symmetric(vertical: 40),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.slate200)),
        child: const Center(
          child: Text('Chưa có tài khoản thanh toán', style: TextStyle(color: AppColors.slate400, fontSize: 14, fontStyle: FontStyle.italic, fontWeight: FontWeight.w500)),
        ),
      )
    else if (_payExpanded)
      for (final c in payment) ...[_accountRow(c), const SizedBox(height: 8)]
    else
      GestureDetector(
        onTap: () => setState(() => _payExpanded = true),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF3F4F6)), boxShadow: kCardShadow),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${payment.length} tài khoản & ví', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate800)),
                const SizedBox(height: 2),
                Text('Tổng số dư: ${formatMoney(payment.fold<num>(0, (s, c) => s + c.balance))}đ', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
              ]),
            ),
            const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.slate300),
          ]),
        ),
      ),
      // Cards other people shared with me (web "Thẻ được chia sẻ").
      ...() {
        final shared = ref.watch(sharedCardsProvider).valueOrNull ?? const <SharedCard>[];
        if (shared.isEmpty) return const <Widget>[];
        return <Widget>[
          const SizedBox(height: 8),
          Row(children: [
            const Text('THẺ ĐƯỢC CHIA SẺ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.slate400, letterSpacing: 1)),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: const Color(0xFFEEF2FF), borderRadius: BorderRadius.circular(20)),
              child: Text('${shared.length} thẻ', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF6366F1))),
            ),
          ]),
          const SizedBox(height: 10),
          for (final sc in shared)
            GestureDetector(
              onTap: () => context.push('/cards/${sc.card.id}'),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE0E7FF))),
                child: Row(children: [
                  CardThumb(card: sc.card, size: CardThumbSize.md, showLast4: true),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(sc.card.bankName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                      Text('Chia sẻ bởi ${sc.ownerName.isNotEmpty ? sc.ownerName : sc.ownerEmail}', style: const TextStyle(fontSize: 11, color: Color(0xFF6366F1))),
                    ]),
                  ),
                  Text('${formatCompact(sc.card.balance)}đ', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                ]),
              ),
            ),
        ];
      }(),
  ];

  // ── Savings tab (web: "Sổ tiết kiệm online" + SavingsDeck) ──
  List<Widget> _savingsTab(List<BankCard> savings) => [
    Row(children: [
      const Expanded(
        child: Text('SỔ TIẾT KIỆM ONLINE', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate400, letterSpacing: 1.8)),
      ),
      GestureDetector(
        onTap: () => showCardFormSheet(context, initialType: 'savings'),
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppColors.brand,
            shape: BoxShape.circle,
            boxShadow: [BoxShadow(color: AppColors.brand.withValues(alpha: 0.3), blurRadius: 4, offset: const Offset(0, 1))],
          ),
          child: const Icon(Icons.add, size: 16, color: Colors.white),
        ),
      ),
    ]),
    const SizedBox(height: 12),
    if (savings.isEmpty)
      Container(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.slate200)),
        child: Column(children: [
          Transform.rotate(
            angle: 0.05,
            child: Container(
              width: 80,
              height: 80,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: const Color(0xFFFAF5FF), borderRadius: BorderRadius.circular(40)),
              child: SvgPicture.asset('assets/icons/acct_soTietKiem.svg'),
            ),
          ),
          const SizedBox(height: 24),
          const Text('Chưa có sổ tiết kiệm', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.slate700)),
          const SizedBox(height: 8),
          const Text('Hãy thêm các sổ tiết kiệm của bạn để theo dõi lãi suất và ngày đáo hạn tự động.',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.slate400, height: 1.5)),
          const SizedBox(height: 24),
          GestureDetector(
            onTap: () => showCardFormSheet(context, initialType: 'savings'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              decoration: BoxDecoration(color: AppColors.brand, borderRadius: BorderRadius.circular(12)),
              child: const Text('+ Thêm sổ tiết kiệm', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ]),
      )
    else
      Padding(padding: const EdgeInsets.only(top: 4), child: SavingsDeck(books: savings)),
  ];

  Widget _netWorthCard(AsyncValue<CardTotals> totals) {
    final t = totals.valueOrNull;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.white, Color(0xFFF1ECFF)],
        ),
        border: Border.all(color: const Color(0xFFE4D8FF)),
        boxShadow: kCardShadow,
      ),
      child: Column(
        children: [
          const Text(
            'Tổng tài sản ròng',
            style: TextStyle(fontSize: 13, color: AppColors.slate500),
          ),
          const SizedBox(height: 6),
          Text(
            t == null ? '—' : '${formatMoney(t.netWorth)} đ',
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppColors.slate900,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _stat('Tài sản', t?.assets, AppColors.income),
              _divider(),
              _stat('Tiết kiệm', t?.savings, AppColors.blue),
              _divider(),
              _stat('Dư nợ', t?.debt, AppColors.expense, negative: true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _divider() =>
      Container(width: 1, height: 34, color: AppColors.slate200);

  Widget _stat(
    String label,
    num? value,
    Color color, {
    bool negative = false,
  }) => Expanded(
    child: Column(
      children: [
        Text(
          value == null
              ? '—'
              : '${negative && value > 0 ? '-' : ''}${formatCompact(value)}',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.slate400),
        ),
      ],
    ),
  );

  // Credit card visual for the carousel.
  Widget _creditVisual(BankCard c) {
    final base = hexColor(c.color, fallback: AppColors.brand);
    final pct = c.creditLimit > 0
        ? (c.balance / c.creditLimit).clamp(0.0, 1.0)
        : 0.0;
    final art = cardArtDecoration(c);
    if (art != null) return _artCreditVisual(c, art, pct.toDouble());
    return GestureDetector(
      onTap: () => context.push('/cards/${c.id}'),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          // Artwork wins over the colour gradient (same rule as the web card face).
          image: cardArtDecoration(c),
          gradient: cardArtDecoration(c) == null
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [base, Color.lerp(base, Colors.black, 0.4)!],
                )
              : null,
          boxShadow: [
            BoxShadow(
              color: base.withValues(alpha: 0.4),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: cardArtDecoration(c) == null
              ? null
              : BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: kArtScrim,
                ),
          child: DefaultTextStyle.merge(
            style: TextStyle(
              shadows: cardArtDecoration(c) == null ? null : kArtTextShadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'TÍN DỤNG',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                Text(
                  '••••  ${c.cardNumber}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Dư nợ',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 9,
                          ),
                        ),
                        Text(
                          '${formatCompact(c.balance)}đ',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Hạn mức',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.7),
                            fontSize: 9,
                          ),
                        ),
                        Text(
                          '${formatCompact(c.creditLimit)}đ',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.9),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: pct,
                    minHeight: 5,
                    backgroundColor: Colors.white.withValues(alpha: 0.25),
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Card with artwork: the art already shows bank/brand/chip, so nothing is
  // drawn over it except a frosted strip at the bottom with debt / limit.
  Widget _artCreditVisual(BankCard c, DecorationImage art, double pct) {
    return GestureDetector(
      onTap: () => context.push('/cards/${c.id}'),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.28), blurRadius: 20, offset: const Offset(0, 10))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Stack(fit: StackFit.expand, children: [
            DecoratedBox(decoration: BoxDecoration(image: art)),
            // One compact frosted line (~15% of the card) so the artwork —
            // including text printed near its bottom edge — stays visible.
            Positioned(
              left: 0, right: 0, bottom: 0,
              child: ClipRect(
                child: BackdropFilter(
                  filter: ui.ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(14, 6, 14, 7),
                    color: Colors.black.withValues(alpha: 0.36),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                      Text('••${c.cardNumber}', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)),
                      const SizedBox(width: 10),
                      Text('Dư nợ ', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 10)),
                      Text('${formatCompact(c.balance)}đ', style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                      const Spacer(),
                      Text('${(pct * 100).round()}% · ', style: TextStyle(color: pct > 0.8 ? const Color(0xFFFDA4AF) : Colors.white.withValues(alpha: 0.75), fontSize: 10, fontWeight: FontWeight.w700)),
                      Text('HM ${formatCompact(c.creditLimit)}đ', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                    ]),
                  ),
                ),
              ),
            ),
            // Usage as a hairline on the bottom edge.
            Positioned(
              left: 0, right: 0, bottom: 0, height: 3,
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(
                  widthFactor: pct,
                  child: Container(color: pct > 0.8 ? const Color(0xFFFB7185) : Colors.white.withValues(alpha: 0.9)),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }

  // ── Credit card deck (web CreditCardCarousel) ──
  // Front card + 2 peeking behind, "+N" badge, "Xem tất cả" sheet.
  static const _maxPeek = 2;

  Widget _deck(List<BankCard> credit) {
    final fi = credit.indexWhere((c) => c.id == _frontId);
    final front = credit[fi < 0 ? 0 : fi];
    final stack = [front, ...credit.where((c) => c.id != front.id)];
    final remaining = credit.length - (_maxPeek + 1);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Text('Thẻ của tôi', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.slate800)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: const Color(0xFFE0E7FF), borderRadius: BorderRadius.circular(999)),
          child: Text('${credit.length} thẻ', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF4F46E5))),
        ),
        const Spacer(),
        if (credit.length > 1)
          GestureDetector(
            onTap: () => _allCardsSheet(credit, front.id),
            child: const Row(children: [
              Text('Xem tất cả', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.brand)),
              Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.brand),
            ]),
          ),
      ]),
      const SizedBox(height: 16),
      LayoutBuilder(builder: (_, cons) {
        final w = cons.maxWidth - 34;
        final h = w / 1.586;
        return SizedBox(
          height: h,
          child: Stack(clipBehavior: Clip.none, children: [
            for (var depth = stack.length - 1; depth >= 0; depth--)
              if (depth <= _maxPeek)
                AnimatedContainer(
                  key: ValueKey(stack[depth].id),
                  duration: const Duration(milliseconds: 450),
                  curve: Curves.easeOutBack,
                  width: w,
                  height: h,
                  // Scale toward the right edge so each card behind peeks ~16px.
                  transformAlignment: Alignment.centerRight,
                  transform: Matrix4.identity()
                    ..translateByDouble(depth * 16.0, 0, 0, 1)
                    ..scaleByDouble(1 - depth * 0.05, 1 - depth * 0.05, 1, 1),
                  child: depth == 0
                      ? _creditVisual(stack[0])
                      : GestureDetector(onTap: () => setState(() => _frontId = stack[depth].id), child: _cardBack(stack[depth])),
                ),
            if (remaining > 0)
              Positioned(
                right: -4,
                top: h / 2 - 18,
                child: GestureDetector(
                  onTap: () => _allCardsSheet(credit, front.id),
                  child: ClipOval(
                    child: BackdropFilter(
                      filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                      child: Container(
                        width: 36,
                        height: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.4),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
                        ),
                        child: Text('+$remaining', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white, shadows: [Shadow(color: Color(0x66000000), blurRadius: 3)])),
                      ),
                    ),
                  ),
                ),
              ),
          ]),
        );
      }),
      const SizedBox(height: 12),
      Row(children: [
        if (credit.length > 1) const Text('Chạm thẻ sau để đưa lên trước', style: TextStyle(fontSize: 12, color: AppColors.slate400)),
        const Spacer(),
        GestureDetector(
          onTap: () => showCardFormSheet(context, initialType: 'credit'),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.brand,
              borderRadius: BorderRadius.circular(999),
              boxShadow: [BoxShadow(color: AppColors.brand.withValues(alpha: 0.3), blurRadius: 4, offset: const Offset(0, 1))],
            ),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Text('+ Thêm thẻ', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
            ]),
          ),
        ),
      ]),
    ]);
  }

  /// A peeking card behind the front one: just its face + last 4 digits.
  Widget _cardBack(BankCard c) {
    final art = cardArtDecoration(c);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        image: art,
        gradient: art == null
            ? LinearGradient(colors: [hexColor(c.color, fallback: AppColors.brand), hexColor(c.color, fallback: AppColors.brand).withValues(alpha: 0.75)])
            : null,
        boxShadow: [BoxShadow(color: const Color(0xFF1F1147).withValues(alpha: 0.4), blurRadius: 24, offset: const Offset(0, 12), spreadRadius: -10)],
      ),
      alignment: Alignment.topRight,
      padding: const EdgeInsets.all(16),
      child: Text(c.cardNumber,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: 2.5, color: Colors.white, shadows: [Shadow(color: Color(0x99000000), blurRadius: 4)])),
    );
  }

  static const _networks = {'visa': 'Visa', 'mastercard': 'Mastercard', 'jcb': 'JCB', 'amex': 'Amex', 'napas': 'NAPAS'};

  /// "Tất cả thẻ (N)" — compact list; tapping one brings it to the front.
  void _allCardsSheet(List<BankCard> credit, String frontId) {
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheet) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * 0.78),
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.paddingOf(sheet).bottom + 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 12),
            Row(children: [
              Text.rich(TextSpan(style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.slate800), children: [
                const TextSpan(text: 'Tất cả thẻ '),
                TextSpan(text: '(${credit.length})', style: const TextStyle(color: AppColors.slate400, fontWeight: FontWeight.w600)),
              ])),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pop(sheet),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(color: Color(0xFFF3F4F6), shape: BoxShape.circle),
                  child: const Icon(Icons.close_rounded, size: 16, color: AppColors.slate500),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            Flexible(
              child: ListView(shrinkWrap: true, children: [
                for (final c in credit)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Material(
                      color: c.id == frontId ? const Color(0xB3EEF2FF) : Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: c.id == frontId ? const Color(0xFFA5B4FC) : Colors.transparent),
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () {
                          Navigator.pop(sheet);
                          setState(() => _frontId = c.id);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Row(children: [
                            CardThumb(card: c, size: CardThumbSize.md),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(
                                  _networks[c.cardNetwork] != null ? '${c.bankName} ${_networks[c.cardNetwork]}' : c.bankName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.slate800),
                                ),
                                Text('•••• ${c.cardNumber}', style: const TextStyle(fontSize: 13, color: AppColors.slate400, letterSpacing: 1)),
                              ]),
                            ),
                            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Text('${formatMoney(c.balance)}₫',
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.balance > 0 ? const Color(0xFFF43F5E) : AppColors.slate400)),
                              const Text('dư nợ', style: TextStyle(fontSize: 10, color: AppColors.slate400)),
                            ]),
                          ]),
                        ),
                      ),
                    ),
                  ),
                GestureDetector(
                  onTap: () {
                    Navigator.pop(sheet);
                    showCardFormSheet(context, initialType: 'credit');
                  },
                  child: Container(
                    margin: const EdgeInsets.only(top: 6),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.slate200)),
                    child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text('+ Thêm thẻ mới', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.brand)),
                    ]),
                  ),
                ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _quickLink(String label, String route) => GestureDetector(
        onTap: () => context.push(route),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: kCardShadow),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          ]),
        ),
      );

  Widget _accountRow(BankCard c) {
    final wallet = c.cardType == 'eWallet';
    final logo = bankLogo(c.bankShortName, c.bankName);
    Widget lead;
    if (safeCardImage(c.cardImage) != null) {
      lead = CardThumb(card: c, size: CardThumbSize.md, showLast4: true);
    } else if (logo != null && !wallet) {
      lead = Container(
        width: 40,
        height: 40,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFF3F4F6))),
        child: Image.network(logo, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox()),
      );
    } else {
      lead = Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: wallet ? const Color(0xFFFAF5FF) : const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(8)),
        child: Text(
          (c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName).trim().padRight(1).substring(0, 1).toUpperCase(),
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: wallet ? const Color(0xFF8B5CF6) : const Color(0xFF3D7BF0)),
        ),
      );
    }
    return GestureDetector(
      onTap: () => context.push('/cards/${c.id}'),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFF3F4F6)),
          boxShadow: const [BoxShadow(color: Color(0x08000000), blurRadius: 8, offset: Offset(0, 2))],
        ),
        child: Row(children: [
          lead,
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(c.bankName.isNotEmpty ? c.bankName : c.bankShortName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate800))),
                if (c.isDefault) ...[const SizedBox(width: 6), const Text('Mặc định', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF6366F1)))],
              ]),
              Text('••${c.cardNumber}${c.cardHolder.isNotEmpty ? ' · ${c.cardHolder}' : ''}',
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
            ]),
          ),
          const SizedBox(width: 8),
          Text(formatMoney(c.balance), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF059669))),
        ]),
      ),
    );
  }
}
