import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/card_art.dart';
import '../../core/card_catalog.dart';
import '../../models/bank_card.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/card_thumb.dart';
import '../../widgets/common.dart';

final _catalogProvider = FutureProvider((_) => CardCatalog.load());

/// "Gắn ảnh thẻ" — port of client/app/(app)/cards/designs/page.tsx: match
/// existing cards to bundled designs from the name the user typed, confirm
/// or pick another, then save all choices at once.
class CardDesignsScreen extends ConsumerStatefulWidget {
  const CardDesignsScreen({super.key});

  @override
  ConsumerState<CardDesignsScreen> createState() => _CardDesignsScreenState();
}

class _CardDesignsScreenState extends ConsumerState<CardDesignsScreen> {
  final Map<String, String> _choice = {}; // cardId → src ('' = none)
  bool _includeWithArt = false;
  String? _openPicker;
  bool _saving = false;

  String _picked(BankCard c, MatchResult m) =>
      _choice[c.id] ?? (m.confidence == MatchConfidence.high ? m.best!.design.src : '');

  Future<void> _apply(List<({BankCard card, MatchResult match})> rows) async {
    final todo = rows.where((r) {
      final p = _picked(r.card, r.match);
      return p.isNotEmpty && p != r.card.cardImage;
    }).toList();
    if (todo.isEmpty) return;
    setState(() => _saving = true);
    final svc = ref.read(financeServiceProvider);
    var ok = 0;
    final queue = [...todo];
    // A few at a time — no need to hammer a free-tier server.
    await Future.wait(List.generate(4, (_) async {
      while (queue.isNotEmpty) {
        final r = queue.removeAt(0);
        try {
          await svc.updateCard(r.card.id, {'cardImage': _picked(r.card, r.match)});
          ok++;
        } catch (_) {}
      }
    }));
    ref.invalidate(cardsProvider);
    if (!mounted) return;
    setState(() {
      _saving = false;
      _choice.clear();
    });
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ok == todo.length ? 'Đã gắn ảnh cho $ok thẻ' : 'Đã gắn $ok/${todo.length} thẻ — thử lại các thẻ còn lại')));
  }

  @override
  Widget build(BuildContext context) {
    final cardsAsync = ref.watch(cardsProvider);
    final catAsync = ref.watch(_catalogProvider);

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(fallback: '/accounts'),
        title: const PageTitle('Gắn ảnh thẻ'),
      ),
      body: (cardsAsync.isLoading || catAsync.isLoading)
          ? const Center(child: CircularProgressIndicator())
          : cardsAsync.hasError || catAsync.hasError
              ? ErrorRetry(onRetry: () => ref.invalidate(cardsProvider))
              : _body(cardsAsync.valueOrNull!, catAsync.valueOrNull!),
    );
  }

  Widget _body(List<BankCard> cards, CardCatalog cat) {
    final eligible = cards.where((c) => c.cardType == 'credit' || c.cardType == 'debit');
    final rows = eligible
        .where((c) => _includeWithArt || safeCardImage(c.cardImage) == null)
        .map((c) => (card: c, match: cat.match(bankShortName: c.bankShortName, bankName: c.bankName, cardNetwork: c.cardNetwork, cardType: c.cardType)))
        .toList()
      ..sort((a, b) => a.match.confidence.index.compareTo(b.match.confidence.index));
    final todo = rows.where((r) {
      final p = _picked(r.card, r.match);
      return p.isNotEmpty && p != r.card.cardImage;
    }).length;

    return Stack(children: [
      ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 110), children: [
        WhiteCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text(
              'App đọc tên thẻ bạn đã đặt, ngân hàng, mạng thẻ để gợi ý mẫu. "Khớp tên" được chọn sẵn; "Gợi ý" thì chạm vào ảnh để xác nhận hoặc đổi mẫu.',
              style: TextStyle(fontSize: 12, color: AppColors.slate500, height: 1.4),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() {
                    for (final r in rows) {
                      if (r.match.best != null) _choice[r.card.id] = r.match.best!.design.src;
                    }
                  }),
                  child: const Text('Chọn tất cả gợi ý'),
                ),
              ),
              const SizedBox(width: 8),
              const Text('Cả thẻ có ảnh', style: TextStyle(fontSize: 12, color: AppColors.slate500)),
              Switch.adaptive(value: _includeWithArt, activeTrackColor: AppColors.brand, onChanged: (v) => setState(() => _includeWithArt = v)),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: Text('Không có thẻ nào cần gắn ảnh 🎉', style: TextStyle(color: AppColors.slate400))),
          ),
        for (final r in rows) _rowCard(r.card, r.match),
      ]),
      Positioned(
        left: 20, right: 20, bottom: 24,
        child: SafeArea(
          child: GestureDetector(
            onTap: todo == 0 || _saving ? null : () => _apply(rows),
            child: Container(
              height: 50,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: todo == 0 ? AppColors.slate200 : AppColors.brand, borderRadius: BorderRadius.circular(16)),
              child: Text(_saving ? 'Đang lưu…' : todo > 0 ? 'Áp dụng ảnh cho $todo thẻ' : 'Chọn mẫu để áp dụng',
                  style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ),
        ),
      ),
    ]);
  }

  Widget _rowCard(BankCard c, MatchResult m) {
    final sel = _picked(c, m);
    final shownDesign = m.candidates.where((x) => x.design.src == sel).map((x) => x.design).firstOrNull ?? m.best?.design;
    final open = _openPicker == c.id;
    final badge = switch (m.confidence) {
      MatchConfidence.high => ('Khớp tên', AppColors.income),
      MatchConfidence.low => (m.noNameMatch ? 'Chưa có mẫu đúng tên' : 'Gợi ý', AppColors.gold),
      MatchConfidence.none => (null, AppColors.slate400),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: kCardShadow),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            CardThumb(card: c, size: CardThumbSize.md, showLast4: true),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${c.bankName} ••${c.cardNumber}', maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                Text('${c.isCredit ? 'Tín dụng' : 'Ghi nợ'}${c.cardNetwork.isNotEmpty ? ' · ${c.cardNetwork.toUpperCase()}' : ''}',
                    style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                if (badge.$1 != null)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: badge.$2.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                    child: Text(badge.$1!, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: badge.$2)),
                  ),
              ]),
            ),
          ]),
        ),
        if (m.confidence == MatchConfidence.none)
          const Padding(
            padding: EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Text('Chưa có mẫu cho ngân hàng này.', style: TextStyle(fontSize: 11, color: AppColors.slate400)),
          )
        else ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: Row(children: [
              GestureDetector(
                onTap: () => setState(() => _choice[c.id] = sel.isNotEmpty ? '' : m.best!.design.src),
                child: Opacity(
                  opacity: sel.isNotEmpty ? 1 : 0.55,
                  child: Container(
                    width: 120, height: 76,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: sel.isNotEmpty ? AppColors.brand : Colors.black12, width: sel.isNotEmpty ? 3 : 1),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(7),
                      child: Image.asset('assets${thumbSrc(shownDesign!.src)}', fit: BoxFit.cover),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(shownDesign.name, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.slate700)),
                  const SizedBox(height: 6),
                  Row(children: [
                    GestureDetector(
                      onTap: () => setState(() => _openPicker = open ? null : c.id),
                      child: Text(open ? 'Đóng' : 'Đổi mẫu', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary)),
                    ),
                    if (sel.isNotEmpty) ...[
                      const SizedBox(width: 14),
                      GestureDetector(
                        onTap: () => setState(() => _choice[c.id] = ''),
                        child: const Text('Bỏ chọn', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.slate400)),
                      ),
                    ],
                  ]),
                ]),
              ),
            ]),
          ),
          if (open)
            SizedBox(
              height: 72,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                children: [
                  for (final x in m.candidates)
                    GestureDetector(
                      onTap: () => setState(() {
                        _choice[c.id] = x.design.src;
                        _openPicker = null;
                      }),
                      child: Container(
                        width: 96,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: sel == x.design.src ? AppColors.brand : Colors.black12, width: sel == x.design.src ? 3 : 1),
                        ),
                        child: ClipRRect(borderRadius: BorderRadius.circular(6), child: Image.asset('assets${thumbSrc(x.design.src)}', fit: BoxFit.cover)),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ]),
    );
  }
}
