import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../models/bank_card.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';
import '../cards/card_form_sheet.dart';

class AccountsScreen extends ConsumerStatefulWidget {
  const AccountsScreen({super.key});
  @override
  ConsumerState<AccountsScreen> createState() => _AccountsScreenState();
}

class _AccountsScreenState extends ConsumerState<AccountsScreen> {
  String _tab = 'cards'; // cards | savings
  final _pageCtrl = PageController(viewportFraction: 0.9);
  int _page = 0;

  @override
  void dispose() {
    _pageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(cardsProvider);
    final totals = ref.watch(cardTotalsProvider);
    final cards = cardsAsync.valueOrNull ?? const <BankCard>[];
    final credit = cards.where((c) => c.isCredit).toList();
    final payment = cards.where((c) => c.cardType == 'debit' || c.cardType == 'eWallet' || c.cardType == 'crypto').toList();
    final savings = cards.where((c) => c.isSavings).toList();

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.primary,
          onRefresh: () async {
            ref.invalidate(cardsProvider);
            await ref.read(cardsProvider.future).catchError((_) => <BankCard>[]);
          },
          child: cardsAsync.isLoading && cards.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
                  children: [
                    const Text('Tài sản', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                    const SizedBox(height: 16),
                    _netWorthCard(totals),
                    const SizedBox(height: 18),
                    _tabs(credit.length + payment.length, savings.length),
                    const SizedBox(height: 18),
                    if (_tab == 'cards') ..._cardsTab(credit, payment) else ..._savingsTab(savings),
                  ],
                ),
        ),
      ),
    );
  }

  // ── Tabs ──
  Widget _tabs(int cardsCount, int savingsCount) {
    Widget tab(String v, IconData icon, String label, int count) {
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
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 16, color: active ? Colors.white : AppColors.slate500),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: active ? Colors.white : AppColors.slate500)),
              if (count > 0) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(color: active ? Colors.white : AppColors.brandLight.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(20)),
                  child: Text('$count', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.brand)),
                ),
              ],
            ]),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: kCardShadow),
      child: Row(children: [
        tab('cards', Icons.account_balance_wallet_outlined, 'Thẻ & Ví', cardsCount),
        tab('savings', Icons.savings_outlined, 'Tiết kiệm', savingsCount),
      ]),
    );
  }

  // ── Cards tab ──
  List<Widget> _cardsTab(List<BankCard> credit, List<BankCard> payment) => [
        if (credit.isNotEmpty) ...[
          SizedBox(
            height: 196,
            child: PageView.builder(
              controller: _pageCtrl,
              itemCount: credit.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (_, i) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 5),
                child: _creditVisual(credit[i]),
              ),
            ),
          ),
          if (credit.length > 1) ...[
            const SizedBox(height: 10),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (int i = 0; i < credit.length; i++)
                Container(
                  width: _page == i ? 18 : 6, height: 6,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(color: _page == i ? AppColors.brand : AppColors.slate200, borderRadius: BorderRadius.circular(3)),
                ),
            ]),
          ],
          const SizedBox(height: 20),
        ],
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('TÀI KHOẢN THANH TOÁN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.slate400, letterSpacing: 1)),
          GestureDetector(
            onTap: () => showCardFormSheet(context),
            child: const Row(children: [
              Icon(Icons.add, size: 15, color: AppColors.brand),
              SizedBox(width: 2),
              Text('Thêm', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.brand)),
            ]),
          ),
        ]),
        const SizedBox(height: 10),
        if (payment.isEmpty)
          const WhiteCard(padding: EdgeInsets.all(20), child: Center(child: Text('Chưa có tài khoản thanh toán', style: TextStyle(color: AppColors.slate400, fontSize: 13))))
        else
          for (final c in payment) ...[_accountRow(c), const SizedBox(height: 12)],
      ];

  // ── Savings tab ──
  List<Widget> _savingsTab(List<BankCard> savings) => [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('SỔ TIẾT KIỆM', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.slate400, letterSpacing: 1)),
          GestureDetector(
            onTap: () => showCardFormSheet(context),
            child: const Row(children: [
              Icon(Icons.add, size: 15, color: AppColors.brand),
              SizedBox(width: 2),
              Text('Thêm', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.brand)),
            ]),
          ),
        ]),
        const SizedBox(height: 10),
        if (savings.isEmpty)
          const WhiteCard(
            padding: EdgeInsets.all(28),
            child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('🏦', style: TextStyle(fontSize: 30)),
              SizedBox(height: 10),
              Text('Chưa có sổ tiết kiệm', style: TextStyle(color: AppColors.slate400, fontSize: 13)),
            ])),
          )
        else
          for (final c in savings) ...[_savingsRow(c), const SizedBox(height: 12)],
      ];

  Widget _netWorthCard(AsyncValue<CardTotals> totals) {
    final t = totals.valueOrNull;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Colors.white, Color(0xFFF1ECFF)]),
        border: Border.all(color: const Color(0xFFE4D8FF)),
        boxShadow: kCardShadow,
      ),
      child: Column(children: [
        const Text('Tổng tài sản ròng', style: TextStyle(fontSize: 13, color: AppColors.slate500)),
        const SizedBox(height: 6),
        Text(t == null ? '—' : '${formatMoney(t.netWorth)} đ', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.slate900)),
        const SizedBox(height: 16),
        Row(children: [
          _stat('Tài sản', t?.assets, AppColors.income),
          _divider(),
          _stat('Tiết kiệm', t?.savings, AppColors.blue),
          _divider(),
          _stat('Dư nợ', t?.debt, AppColors.expense, negative: true),
        ]),
      ]),
    );
  }

  Widget _divider() => Container(width: 1, height: 34, color: AppColors.slate200);

  Widget _stat(String label, num? value, Color color, {bool negative = false}) => Expanded(
        child: Column(children: [
          Text(value == null ? '—' : '${negative && value > 0 ? '-' : ''}${formatCompact(value)}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
        ]),
      );

  // Credit card visual for the carousel.
  Widget _creditVisual(BankCard c) {
    final base = hexColor(c.color, fallback: AppColors.brand);
    final pct = c.creditLimit > 0 ? (c.balance / c.creditLimit).clamp(0.0, 1.0) : 0.0;
    return GestureDetector(
      onTap: () => context.push('/cards/${c.id}'),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [base, Color.lerp(base, Colors.black, 0.4)!]),
          boxShadow: [BoxShadow(color: base.withValues(alpha: 0.4), blurRadius: 20, offset: const Offset(0, 10))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Text(c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
              const Spacer(),
              Text('TÍN DỤNG', style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 1)),
            ]),
            const Spacer(),
            Text('••••  ${c.cardNumber}', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: 2)),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Dư nợ', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 9)),
                Text('${formatCompact(c.balance)}đ', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
              ]),
              const Spacer(),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('Hạn mức', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 9)),
                Text('${formatCompact(c.creditLimit)}đ', style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 13, fontWeight: FontWeight.w600)),
              ]),
            ]),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: pct, minHeight: 5, backgroundColor: Colors.white.withValues(alpha: 0.25), valueColor: const AlwaysStoppedAnimation(Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _accountRow(BankCard c) {
    final wallet = c.cardType == 'eWallet';
    return GestureDetector(
      onTap: () => context.push('/cards/${c.id}'),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: kCardShadow),
        child: Row(children: [
          Container(
            width: 46, height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: hexColor(c.color).withValues(alpha: 0.14), borderRadius: BorderRadius.circular(13)),
            child: Icon(wallet ? Icons.account_balance_wallet_outlined : Icons.credit_card, color: hexColor(c.color), size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              const SizedBox(height: 2),
              Text('${wallet ? 'Ví điện tử' : 'Thẻ ghi nợ'} · ••${c.cardNumber}', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
            ]),
          ),
          Text('${formatCompact(c.balance)}đ', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
        ]),
      ),
    );
  }

  Widget _savingsRow(BankCard c) => GestureDetector(
        onTap: () => context.push('/cards/${c.id}'),
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: kCardShadow),
          child: Row(children: [
            Container(
              width: 46, height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: AppColors.blue.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(13)),
              child: const Icon(Icons.savings_outlined, color: AppColors.blue, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                const SizedBox(height: 2),
                Text('Sổ tiết kiệm${c.interestRate > 0 ? ' · ${c.interestRate}%/năm' : ''}', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
              ]),
            ),
            Text('${formatCompact(c.balance)}đ', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.income)),
          ]),
        ),
      );
}
