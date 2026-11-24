import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/bank_logos.dart';
import '../../models/bank_card.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/common.dart';
import '../cards/card_form_sheet.dart';

/// "Tiết kiệm" — port of client/app/(app)/savings/page.tsx + SavingsDeck:
/// centered total on a mint wash, "Sổ của tôi" deck (front book + 2 peeking,
/// "+N", all-books sheet), quick actions, maturity alert, detail rows, tip
/// banner and a floating "+".
class SavingsScreen extends ConsumerStatefulWidget {
  const SavingsScreen({super.key});

  static num interestOf(BankCard c) => c.interestRate > 0 && c.term > 0 ? c.balance * c.interestRate / 100 * c.term / 12 : 0;
  static int? daysLeft(BankCard c) {
    if (c.maturityDate == null) return null;
    final now = DateTime.now();
    return DateTime(c.maturityDate!.year, c.maturityDate!.month, c.maturityDate!.day)
        .difference(DateTime(now.year, now.month, now.day))
        .inDays;
  }

  @override
  ConsumerState<SavingsScreen> createState() => _SavingsScreenState();
}

const _gradients = [
  [Color(0xFF667EEA), Color(0xFF764BA2)],
  [Color(0xFFF093FB), Color(0xFFF5576C)],
  [Color(0xFF4FACFE), Color(0xFF00F2FE)],
  [Color(0xFF43E97B), Color(0xFF38F9D7)],
  [Color(0xFFFA709A), Color(0xFFFEE140)],
  [Color(0xFFA18CD1), Color(0xFFFBC2EB)],
];
const _emerald = Color(0xFF10B981);

String _initials(BankCard c) {
  final t = (c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName).trim();
  return t.isEmpty ? '?' : t.substring(0, t.length.clamp(1, 3)).toUpperCase();
}

String _fmtShort(num n) {
  final a = n.abs();
  if (a >= 1e9) return '${(n / 1e9).toStringAsFixed(1)}tỷ';
  if (a >= 1e6) return '${(n / 1e6).toStringAsFixed(1)}tr';
  return '${(n / 1e3).round()}k';
}

String _dmy2(DateTime? d) => d == null ? '—' : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${(d.year % 100).toString().padLeft(2, '0')}';

/// Card background (web getCardGradient): bank colour → card colour → palette.
Gradient _bookGradient(BankCard c, int idx) {
  Color? base;
  if (c.color == '#111111' || c.color == '#FFFFFF') base = hexColor(c.color);
  if (base == null && c.bankColor.isNotEmpty && c.bankColor.toUpperCase() != '#1B4FD8') base = hexColor(c.bankColor);
  if (base == null && c.color.isNotEmpty && c.color.toUpperCase() != '#6C63FF') base = hexColor(c.color);
  if (base != null) return LinearGradient(colors: [base, base]);
  final g = _gradients[idx % _gradients.length];
  return LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: g);
}

({Color text, Color sub}) _textStyle(BankCard c) => c.color == '#111111'
    ? (text: const Color(0xFFF59E0B), sub: const Color(0xFFFCD34D))
    : c.color == '#FFFFFF'
        ? (text: const Color(0xFF1E293B), sub: const Color(0xFF64748B))
        : (text: Colors.white, sub: Colors.white.withValues(alpha: 0.82));

class _SavingsScreenState extends ConsumerState<SavingsScreen> {
  final _deckKey = GlobalKey<SavingsDeckState>();

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(cardsProvider);
    final books = (async.valueOrNull ?? const <BankCard>[]).where((c) => c.isSavings).toList();
    final total = books.fold<num>(0, (s, c) => s + c.balance);
    final interest = books.fold<num>(0, (s, c) => s + SavingsScreen.interestOf(c));
    final best = books.fold<num>(0, (m, c) => c.interestRate > m ? c.interestRate : m);
    final matured = books.where((c) => (SavingsScreen.daysLeft(c) ?? 1) <= 0).toList();
    final soon = books.where((c) {
      final d = SavingsScreen.daysLeft(c);
      return d != null && d >= 0 && d <= 30;
    }).toList();
    final top = MediaQuery.paddingOf(context).top + 60;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        flexibleSpace: ClipRect(
          child: BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12), child: Container(color: const Color(0x14F9FAFB))),
        ),
        leading: const AppBackButton(),
        title: const PageTitle('Tiết kiệm', subtitle: 'Tài chính'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: GestureDetector(
                onTap: () => refreshFinance(ref),
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFF3F4F6)),
                    boxShadow: kCardShadow,
                  ),
                  child: Stack(alignment: Alignment.center, children: [
                    const Icon(Icons.refresh_rounded, size: 18, color: AppColors.slate500),
                    if (soon.isNotEmpty)
                      Positioned(
                        top: 7,
                        right: 7,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(color: const Color(0xFFF97316), shape: BoxShape.circle, border: Border.all(color: Colors.white)),
                        ),
                      ),
                  ]),
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: GestureDetector(
          onTap: () => showCardFormSheet(context, initialType: 'savings'),
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(colors: [Color(0xFF4A3575), AppColors.brand]),
              boxShadow: [BoxShadow(color: _emerald.withValues(alpha: 0.4), blurRadius: 20)],
            ),
            child: const Icon(Icons.add_rounded, size: 28, color: Colors.white),
          ),
        ),
      ),
      body: Stack(children: [
        Container(
          height: 384,
          decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x4DA7F3D0), Color(0x00A7F3D0)])),
        ),
        if (async.isLoading && !async.hasValue)
          const Center(child: CircularProgressIndicator())
        else if (async.hasError && !async.hasValue)
          ErrorRetry(onRetry: () => ref.invalidate(cardsProvider))
        else
          RefreshIndicator(
            edgeOffset: top,
            onRefresh: () async => refreshFinance(ref),
            child: ListView(padding: EdgeInsets.fromLTRB(20, top + 8, 20, 110), children: [
              // ── Hero
              const Text('Tổng tiền đang gửi', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.slate500)),
              const SizedBox(height: 4),
              Text('${formatMoney(total)}₫',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.slate900)),
              if (interest > 0) ...[
                const SizedBox(height: 8),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text('Lãi tạm tính: +${_fmtShort(interest)}₫', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF059669))),
                ]),
              ],
              if (total == 0) ...[
                const SizedBox(height: 8),
                const Text('Chưa có sổ tiết kiệm nào', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: AppColors.slate400)),
              ],
              const SizedBox(height: 32),
              // ── Deck
              Row(children: [
                const Expanded(child: Text('Sổ của tôi', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.slate800))),
                if (books.isNotEmpty)
                  GestureDetector(
                    onTap: () => _deckKey.currentState?.openAll(),
                    child: Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0x99A7F3D0)),
                        boxShadow: kCardShadow,
                      ),
                      child: const Icon(Icons.arrow_forward_rounded, size: 16, color: Color(0xFF059669)),
                    ),
                  ),
              ]),
              const SizedBox(height: 16),
              if (books.isEmpty)
                GestureDetector(
                  onTap: () => showCardFormSheet(context, initialType: 'savings'),
                  child: Container(
                    height: 160,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(22),
                      border: Border.all(color: const Color(0xFFD1D5DB), width: 2),
                    ),
                    child: const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text('+ Thêm sổ tiết kiệm', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.slate400)),
                    ]),
                  ),
                )
              else
                SavingsDeck(key: _deckKey, books: books),
              const SizedBox(height: 20),
              // ── Quick actions
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
                  boxShadow: kCardShadow,
                ),
                child: Row(children: [
                  _quick(const Color(0xFF059669), const Color(0xFFD1FAE5), 'Gửi thêm', () => showCardFormSheet(context, initialType: 'savings')),
                  const SizedBox(width: 8),
                  _quick(const Color(0xFF2563EB), const Color(0xFFDBEAFE), 'Tái tục', () {
                    if (matured.isEmpty) {
                      _toast('Chưa có sổ nào đáo hạn để tái tục');
                    } else {
                      showRenewSheet(context, matured.first);
                    }
                  }),
                  const SizedBox(width: 8),
                  _quick(const Color(0xFFEA580C), const Color(0xFFFEF3C7), 'Lịch sử', () => context.push('/auto-actions')),
                  const SizedBox(width: 8),
                  _quick(const Color(0xFF9333EA), const Color(0xFFEDE9FE), 'Báo cáo', () => context.push('/wealth')),
                ]),
              ),
              // ── Maturity alert
              if (soon.isNotEmpty) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFFED7AA))),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${soon.length} sổ sắp đáo hạn trong 30 ngày', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF9A3412))),
                        for (final c in soon)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text('· ${c.bankName} — ${formatMoney(c.balance)}₫ · còn ${SavingsScreen.daysLeft(c)} ngày',
                                style: const TextStyle(fontSize: 12, color: Color(0xFFEA580C))),
                          ),
                      ]),
                    ),
                  ]),
                ),
              ],
              // ── Details
              const SizedBox(height: 20),
              const Text('Thông tin chi tiết', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.slate800)),
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFF3F4F6)),
                  boxShadow: kCardShadow,
                ),
                child: Column(children: [
                  ...() {
                    final dated = books.where((c) => c.maturityDate != null).toList()..sort((a, b) => a.maturityDate!.compareTo(b.maturityDate!));
                    if (dated.isEmpty) {
                      return [_detail('Không có sổ sắp đáo hạn', 'Tất cả đang hoạt động bình thường', 'Tốt 👍')];
                    }
                    final u = dated.first;
                    final d = SavingsScreen.daysLeft(u);
                    final urg = d == null
                        ? const Color(0xFF6B7280)
                        : d <= 0
                            ? const Color(0xFFEF4444)
                            : d <= 7
                                ? const Color(0xFFF97316)
                                : d <= 30
                                    ? const Color(0xFFF59E0B)
                                    : _emerald;
                    return [
                      _detail('${u.bankShortName} — Sắp đáo hạn', 'Ngày đáo hạn: ${_dmy2(u.maturityDate)}',
                          '${formatMoney(u.balance)}₫',
                          badge: d == null ? '—' : (d <= 0 ? 'Đã đáo hạn' : '${d}N nữa'), badgeColor: urg, onTap: d != null && d <= 0 ? () => showRenewSheet(context, u) : null),
                    ];
                  }(),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF3F4F6)),
                  _detail('Lãi tạm tính toàn bộ', '${books.length} sổ tiết kiệm',
                      interest > 0 ? '+${_fmtShort(interest)}₫' : '—',
                      badge: interest > 0 ? '+${_fmtShort(interest)}' : null, badgeColor: _emerald),
                  const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF3F4F6)),
                  _detail('Lãi suất cao nhất', 'Trong danh mục của bạn', best > 0 ? '$best%/năm' : '—'),
                ]),
              ),
              // ── Tip banner
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF059669), Color(0xFF0EA5E9)]),
                  boxShadow: [BoxShadow(color: const Color(0xFF059669).withValues(alpha: 0.25), blurRadius: 14, offset: const Offset(0, 6))],
                ),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Mẹo tiết kiệm', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.8))),
                      const SizedBox(height: 4),
                      const Text('Tái tục tự động để không\nbỏ lỡ chu kỳ lãi suất', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white, height: 1.25)),
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: () => context.push('/auto-actions'),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                          child: const Text('Tìm hiểu thêm', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF047857))),
                        ),
                      ),
                    ]),
                  ),
                ]),
              ),
            ]),
          ),
      ]),
    );
  }

  Widget _quick(Color fg, Color bg, String label, VoidCallback onTap) => Expanded(
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
            child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
          ),
        ),
      );

  Widget _detail(String title, String sub, String value, {String? badge, Color? badgeColor, VoidCallback? onTap}) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.slate800))),
                  if (badge != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: (badgeColor ?? _emerald).withValues(alpha: 0.09), borderRadius: BorderRadius.circular(8)),
                      child: Text(badge, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: badgeColor ?? _emerald)),
                    ),
                ]),
                const SizedBox(height: 2),
                Row(children: [
                  Expanded(child: Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.slate400))),
                  Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate800)),
                ]),
              ]),
            ),
          ]),
        ),
      );

}


/// Stacked passbook deck (web SavingsDeck) — front book + 2 peeking, "+N",
/// all-books sheet. Used on the Tiết kiệm page and the Tài sản → Tiết kiệm tab.
class SavingsDeck extends ConsumerStatefulWidget {
  final List<BankCard> books;
  const SavingsDeck({super.key, required this.books});
  @override
  ConsumerState<SavingsDeck> createState() => SavingsDeckState();
}

class SavingsDeckState extends ConsumerState<SavingsDeck> {
  String? _frontId;

  void openAll() => _allSheet(widget.books);

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _delete(BankCard c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text('Xoá sổ ${c.bankName}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Xoá', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(financeServiceProvider).deleteCard(c.id);
      refreshFinance(ref);
    } catch (_) {
      _toast('Xoá thất bại');
    }
  }

  @override
  Widget build(BuildContext context) => _deck(widget.books);

  // ── Deck (web SavingsDeck) ──
  Widget _deck(List<BankCard> books) {
    final fi = books.indexWhere((c) => c.id == _frontId);
    final front = books[fi < 0 ? 0 : fi];
    final rest = books.where((c) => c.id != front.id).toList();
    final backs = rest.take(2).toList();
    final remaining = books.length - 1 - backs.length;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.only(right: 34),
        child: Stack(clipBehavior: Clip.none, children: [
          for (var i = backs.length - 1; i >= 0; i--)
            Positioned.fill(
              child: AnimatedContainer(
                key: ValueKey(backs[i].id),
                duration: const Duration(milliseconds: 450),
                curve: Curves.easeOutBack,
                transformAlignment: Alignment.centerRight,
                transform: Matrix4.identity()
                  ..translateByDouble((i + 1) * 16.0, 0, 0, 1)
                  ..scaleByDouble(1 - (i + 1) * 0.05, 1 - (i + 1) * 0.05, 1, 1),
                child: GestureDetector(
                  onTap: () => setState(() => _frontId = backs[i].id),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: _bookGradient(backs[i], books.indexOf(backs[i])),
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: const [BoxShadow(color: Color(0x801F1147), blurRadius: 36, offset: Offset(0, 16), spreadRadius: -12)],
                    ),
                    alignment: Alignment.topRight,
                    padding: const EdgeInsets.all(16),
                    child: Text(backs[i].bankShortName.isNotEmpty ? backs[i].bankShortName : '••${backs[i].cardNumber}',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, letterSpacing: 1.5, color: _textStyle(backs[i]).text)),
                  ),
                ),
              ),
            ),
          _bookCard(front, books.indexOf(front)),
          if (remaining > 0)
            Positioned(
              right: -34,
              bottom: 8,
              child: GestureDetector(
                onTap: () => _allSheet(books),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: BackdropFilter(
                    filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 44),
                      height: 36,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.45)),
                      ),
                      child: Text('+$remaining', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white, shadows: [Shadow(color: Color(0x66000000), blurRadius: 3)])),
                    ),
                  ),
                ),
              ),
            ),
        ]),
      ),
      if (books.length > 1) ...[
        const SizedBox(height: 12),
        const Text('Chạm sổ sau để đưa lên trước', style: TextStyle(fontSize: 12, color: AppColors.slate400)),
      ],
    ]);
  }

  /// Front passbook (web SavingsCard).
  Widget _bookCard(BankCard c, int idx) {
    final ts = _textStyle(c);
    final logo = bankLogo(c.bankShortName, c.bankName);
    final days = SavingsScreen.daysLeft(c);
    final est = SavingsScreen.interestOf(c);
    final urgent = days != null && days <= 7;
    final st = days == null
        ? null
        : days <= 0
            ? (label: 'Đã đáo hạn', bg: const Color(0x47EF4444), ring: const Color(0x73FCA5A5), text: const Color(0xFFFEE2E2))
            : days <= 30
                ? (label: 'Còn $days ngày', bg: const Color(0x4DF59E0B), ring: const Color(0x80FDE68A), text: const Color(0xFFFEF3C7))
                : (label: 'Đang hoạt động', bg: const Color(0x5210B981), ring: const Color(0x806EE7B7), text: const Color(0xFFDCFCE7));
    Widget stat(String k, String v, {Color? vc}) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Column(children: [
              Text(k, style: TextStyle(fontSize: 10, color: ts.sub)),
              const SizedBox(height: 2),
              Text(v, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: vc ?? ts.text)),
            ]),
          ),
        );
    Widget roundBtn(IconData icon, Color color, VoidCallback onTap) => GestureDetector(
          onTap: onTap,
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
            ),
            child: Icon(icon, size: 15, color: color),
          ),
        );
    return GestureDetector(
      onTap: days != null && days <= 0 ? () => showRenewSheet(context, c) : null,
      child: Container(
        padding: const EdgeInsets.all(16),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: _bookGradient(c, idx),
          borderRadius: BorderRadius.circular(22),
          border: c.color == '#FFFFFF' ? Border.all(color: const Color(0xFFE2E8F0)) : null,
          boxShadow: const [
            BoxShadow(color: Color(0x801F1147), blurRadius: 36, offset: Offset(0, 16), spreadRadius: -12),
            BoxShadow(color: Color(0x42000000), blurRadius: 12, offset: Offset(0, 4), spreadRadius: -4),
          ],
        ),
        foregroundDecoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0x38FFFFFF), Color(0x00FFFFFF), Color(0x00000000), Color(0x1A000000)],
            stops: [0, 0.34, 0.6, 1],
          ),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 40,
              height: 40,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: logo != null ? Colors.white.withValues(alpha: 0.9) : Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.5)),
              ),
              alignment: Alignment.center,
              child: logo != null
                  ? Image.network(logo, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox())
                  : Text(_initials(c), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: ts.text)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.bankName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: ts.text)),
                const SizedBox(height: 2),
                Text('${c.term > 0 ? 'Kỳ hạn ${c.term} tháng' : 'Không kỳ hạn'}${c.cardNumber.isNotEmpty ? ' · ••${c.cardNumber}' : ''}',
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: ts.sub)),
              ]),
            ),
            roundBtn(Icons.edit_rounded, ts.text, () => showCardFormSheet(context, initial: c)),
            const SizedBox(width: 6),
            roundBtn(Icons.delete_outline_rounded, const Color(0xFFFCA5A5), () => _delete(c)),
          ]),
          const SizedBox(height: 12),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Số tiền gốc', style: TextStyle(fontSize: 11, color: ts.sub)),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text('${formatMoney(c.balance)}₫', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: ts.text)),
                ),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('Lãi tạm tính', style: TextStyle(fontSize: 11, color: ts.sub)),
              const SizedBox(height: 4),
              Text(est > 0 ? '+${_fmtShort(est)}' : '—', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: ts.text)),
            ]),
          ]),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
            ),
            child: IntrinsicHeight(
              child: Row(children: [
                stat('Lãi suất', c.interestRate > 0 ? '${c.interestRate}%' : '—'),
                VerticalDivider(width: 1, color: Colors.white.withValues(alpha: 0.15)),
                stat('Ngày gửi', _dmy2(c.depositDate)),
                VerticalDivider(width: 1, color: Colors.white.withValues(alpha: 0.15)),
                stat('Đáo hạn', _dmy2(c.maturityDate), vc: urgent ? const Color(0xFFFDE68A) : null),
              ]),
            ),
          ),
          if (st != null) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: st.bg, borderRadius: BorderRadius.circular(999), border: Border.all(color: st.ring)),
              child: Text(st.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: st.text)),
            ),
          ],
        ]),
      ),
    );
  }

  /// "Tất cả sổ tiết kiệm (N)" — tap one to bring it to the front.
  void _allSheet(List<BankCard> books) {
    final frontId = (_frontId != null && books.any((c) => c.id == _frontId)) ? _frontId : books.first.id;
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
                const TextSpan(text: 'Tất cả sổ tiết kiệm '),
                TextSpan(text: '(${books.length})', style: const TextStyle(color: AppColors.slate400, fontWeight: FontWeight.w600)),
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
                for (final c in books)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Material(
                      color: c.id == frontId ? AppColors.brandLight.withValues(alpha: 0.4) : Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: c.id == frontId ? AppColors.brand : Colors.transparent),
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
                            Container(
                              width: 40,
                              height: 40,
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFF3F4F6))),
                              child: bankLogo(c.bankShortName, c.bankName) != null
                                  ? Image.network(bankLogo(c.bankShortName, c.bankName)!, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox())
                                  : Center(child: Text(_initials(c), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.brand))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(c.bankName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.slate800)),
                                Text(c.term > 0 ? 'Kỳ hạn ${c.term} tháng' : 'Không kỳ hạn', style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
                              ]),
                            ),
                            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Text('${formatMoney(c.balance)}₫', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate800)),
                              Text(c.interestRate > 0 ? '${c.interestRate}%/năm' : 'sổ tiết kiệm', style: const TextStyle(fontSize: 10, color: AppColors.slate400)),
                            ]),
                          ]),
                        ),
                      ),
                    ),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

Future<void> showRenewSheet(BuildContext context, BankCard card) => showModalBottomSheet<void>(useRootNavigator: true, 
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _RenewSheet(card: card),
    );

class _RenewSheet extends ConsumerStatefulWidget {
  final BankCard card;
  const _RenewSheet({required this.card});
  @override
  ConsumerState<_RenewSheet> createState() => _RenewSheetState();
}

class _RenewSheetState extends ConsumerState<_RenewSheet> {
  static const _terms = [1, 3, 6, 12, 24];
  late final num _interest = SavingsScreen.interestOf(widget.card);
  late final _amount = TextEditingController(text: (widget.card.balance + _interest).round().toString());
  late final _rate = TextEditingController(text: widget.card.interestRate.toString());
  late int _term = widget.card.term > 0 ? widget.card.term : 12;
  bool _saving = false;

  @override
  void dispose() {
    _amount.dispose();
    _rate.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final amount = num.tryParse(_amount.text.replaceAll(RegExp(r'[^\d]'), '')) ?? 0;
    if (amount <= 0) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final earned = await ref.read(financeServiceProvider).renewSavings(widget.card.id,
          newAmount: amount, newRate: num.tryParse(_rate.text.replaceAll(',', '.')) ?? 0, newTerm: _term);
      refreshFinance(ref);
      if (mounted) Navigator.of(context).pop();
      messenger.showSnackBar(SnackBar(content: Text('Đã tái tục · lãi +${formatMoney(earned)}đ')));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Không thể tái tục')));
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.card;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Center(child: Container(width: 44, height: 5, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3)))),
        const SizedBox(height: 12),
        const Center(child: Text('Tái tục sổ tiết kiệm', style: AppText.sheetTitle)),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(c.bankName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                Text('Gốc ${formatMoney(c.balance)}₫ · ${c.interestRate}% · ${c.term} tháng', style: const TextStyle(fontSize: 11, color: AppColors.slate500)),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              const Text('Lãi nhận', style: TextStyle(fontSize: 10, color: AppColors.slate500)),
              Text('+${formatMoney(_interest)}₫', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.income)),
            ]),
          ]),
        ),
        const SizedBox(height: 14),
        const Text('Số tiền gửi lại', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
        const SizedBox(height: 6),
        TextField(controller: _amount, keyboardType: TextInputType.number, decoration: _dec('Gốc + lãi')),
        const SizedBox(height: 6),
        Wrap(spacing: 8, children: [
          ActionChip(label: Text('Gốc + lãi ${formatCompact(c.balance + _interest)}'), onPressed: () => _amount.text = (c.balance + _interest).round().toString()),
          ActionChip(label: Text('Chỉ gốc ${formatCompact(c.balance)}'), onPressed: () => _amount.text = c.balance.round().toString()),
        ]),
        const SizedBox(height: 12),
        const Text('Lãi suất mới (%/năm)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
        const SizedBox(height: 6),
        TextField(controller: _rate, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: _dec('6.5')),
        const SizedBox(height: 12),
        const Text('Kỳ hạn mới', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, children: [
          for (final m in _terms)
            ChoiceChip(
              label: Text('$m tháng'),
              selected: _term == m,
              onSelected: (_) => setState(() => _term = m),
              selectedColor: AppColors.brand,
              labelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _term == m ? Colors.white : AppColors.slate700),
            ),
        ]),
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          height: 50,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.brand, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
            onPressed: _saving ? null : _submit,
            child: Text(_saving ? 'Đang tái tục…' : 'Tái tục', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          ),
        ),
      ]),
    );
  }

  InputDecoration _dec(String hint) => InputDecoration(
        hintText: hint,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
      );
}
