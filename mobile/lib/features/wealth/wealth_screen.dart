import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/bank_logos.dart';
import '../../models/bank_card.dart';
import '../cards/card_form_sheet.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/card_thumb.dart';
import '../../widgets/common.dart';

final wealthSourcesProvider = FutureProvider.autoDispose((ref) => ref.read(financeServiceProvider).getWealthSources());

const _categories = <String, (String, String)>{
  'stock': ('📈', 'Cổ phiếu'),
  'gold': ('🪙', 'Vàng bạc'),
  'crypto': ('₿', 'Crypto'),
  'real_estate': ('🏠', 'Bất động sản'),
  'savings': ('🐷', 'Sổ tiết kiệm'),
  'cashback': ('🎁', 'Hoàn tiền'),
  'affiliate': ('🤝', 'Affiliate'),
  'other': ('💼', 'Khác'),
};

/// "Tài sản ròng" — port of client/app/(app)/wealth + WealthTabContent:
/// floating net-worth hero, Tài khoản / Tiết kiệm / Khác tabs, cards grouped
/// per bank+type (expandable, credit usage bars), zero-balance accounts tucked
/// into "Không hoạt động". Tap a row to edit, long-press to delete.
class WealthScreen extends ConsumerStatefulWidget {
  const WealthScreen({super.key});
  @override
  ConsumerState<WealthScreen> createState() => _WealthScreenState();
}

enum _Tab { accounts, savings, other }

/// One row of the wealth list: a card, or a user-entered wealth source.
class _Src {
  final String id, name, category, note;
  final num balance;
  final Color color;
  final BankCard? card;
  final Map<String, dynamic>? raw;
  const _Src({required this.id, required this.name, required this.category, required this.note, required this.balance, required this.color, this.card, this.raw});
}

class _Group {
  final String key, title;
  final List<_Src> items;
  const _Group(this.key, this.title, this.items);
  num get total => items.fold<num>(0, (s, i) => s + i.balance);
}

const _catLabels = {
  'savings': 'Sổ tiết kiệm', 'gold': 'Vàng bạc', 'crypto': 'Crypto', 'cashback': 'Hoàn tiền', 'affiliate': 'Affiliate',
  'stock': 'Cổ phiếu', 'real_estate': 'Bất động sản', 'other': 'Khác', 'credit': 'Thẻ tín dụng', 'bank': 'Tài khoản thanh toán', 'eWallet': 'Ví điện tử',
};
const _emerald = Color(0xFF059669);
const _red = Color(0xFFEF4444);

Color _usage(num pct) => pct >= 80 ? _red : pct >= 50 ? const Color(0xFFF59E0B) : const Color(0xFF6366F1);
Color _amountColor(num v) => v < 0 ? _red : v > 0 ? _emerald : AppColors.slate400;

String _fmtLimit(num n) {
  final a = n.abs();
  if (a >= 1e9) return '${(a / 1e9).toStringAsFixed(1).replaceAll('.', ',')}tỷ';
  if (a >= 1e6) return '${(a / 1e6).round()}tr';
  if (a >= 1e3) return '${(a / 1e3).round()}k';
  return '${a.round()}';
}

String _fmtShortSigned(num n) {
  final a = n.abs();
  final sign = n < 0 ? '-' : '+';
  String v;
  if (a >= 1e9) {
    v = '${(a / 1e9).toStringAsFixed(2).replaceAll('.', ',')} tỷ';
  } else if (a >= 1e6) {
    v = '${(a / 1e6).toStringAsFixed(a >= 1e7 ? 1 : 2).replaceAll('.', ',')}tr';
  } else if (a >= 1e3) {
    v = '${(a / 1e3).round()}k';
  } else {
    v = '${a.round()}';
  }
  return '$sign$v';
}

class _WealthScreenState extends ConsumerState<WealthScreen> {
  _Tab _tab = _Tab.accounts;
  bool _visible = false;
  final Set<String> _expanded = {};

  _Src _fromCard(BankCard c) {
    final cat = c.isSavings ? 'savings' : c.isCredit ? 'credit' : c.isWallet ? 'eWallet' : 'bank';
    return _Src(
      id: c.id,
      name: '${c.bankShortName} ${c.cardNumber.isNotEmpty ? '••${c.cardNumber}' : ''}'.trim(),
      category: cat,
      note: c.isCredit ? 'Thẻ tín dụng' : c.isSavings ? 'Sổ tiết kiệm' : 'Tài khoản',
      balance: c.isCredit ? -c.balance : c.balance,
      color: hexColor(c.bankColor.isNotEmpty ? c.bankColor : '#3B82F6'),
      card: c,
    );
  }

  _Src _fromSource(Map<String, dynamic> s) => _Src(
        id: (s['_id'] ?? '').toString(),
        name: (s['name'] ?? '').toString(),
        category: (s['category'] ?? 'other').toString(),
        note: (s['note'] ?? '').toString(),
        balance: (s['balance'] as num?) ?? 0,
        color: hexColor((s['color'] ?? '#06B6D4').toString()),
        raw: s,
      );

  /// Group by bank+cardType (web getGroupedItems); optional ascending sort by total.
  List<_Group> _grouped(List<_Src> list, {bool sortAsc = false}) {
    final groups = <String, List<_Src>>{};
    final out = <_Group>[];
    for (final s in list) {
      final c = s.card;
      if (c != null && c.bankShortName.isNotEmpty) {
        groups.putIfAbsent('${c.bankShortName}_${c.cardType}', () => []).add(s);
      } else {
        out.add(_Group(s.id, s.name, [s]));
      }
    }
    for (final e in groups.entries) {
      out.insert(0, _Group(e.key, e.value.length > 1 ? e.value.first.card!.bankShortName : e.value.first.name, e.value));
    }
    if (sortAsc) out.sort((a, b) => a.total.compareTo(b.total));
    return out;
  }

  Future<void> _refresh() async {
    ref.invalidate(wealthSourcesProvider);
    refreshFinance(ref);
    try {
      await Future.wait<Object>([ref.read(wealthSourcesProvider.future), ref.read(cardsProvider.future)]);
    } catch (_) {}
  }

  Future<void> _edit(_Src s) async {
    if (s.card != null) {
      final ok = await showCardFormSheet(context, initial: s.card);
      if (ok == true) refreshFinance(ref);
    } else {
      await _editSource(context, ref, s.raw);
    }
  }

  Future<void> _delete(_Src s) async {
    HapticFeedback.mediumImpact();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Xoá "${s.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Xoá', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final svc = ref.read(financeServiceProvider);
    try {
      if (s.card != null) {
        await svc.deleteCard(s.id);
      } else {
        await svc.deleteWealthSource(s.id);
      }
      ref.invalidate(wealthSourcesProvider);
      refreshFinance(ref);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.card != null ? 'Đã xoá thẻ/tài khoản' : 'Đã xoá tài sản')));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Xoá thất bại')));
    }
  }

  Future<void> _add() async {
    if (_tab == _Tab.other) {
      await _editSource(context, ref, null);
    } else {
      final ok = await showCardFormSheet(context, initialType: _tab == _Tab.savings ? 'savings' : 'debit');
      if (ok == true) refreshFinance(ref);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sourcesAsync = ref.watch(wealthSourcesProvider);
    final cardsAsync = ref.watch(cardsProvider);
    final loading = (sourcesAsync.isLoading && !sourcesAsync.hasValue) || (cardsAsync.isLoading && !cardsAsync.hasValue);
    final all = [
      for (final s in sourcesAsync.valueOrNull ?? const <Map<String, dynamic>>[]) _fromSource(s),
      for (final c in cardsAsync.valueOrNull ?? const <BankCard>[]) _fromCard(c),
    ];
    final total = all.fold<num>(0, (s, x) => s + x.balance);
    final catCount = all.map((s) => s.category).toSet().length;

    final credit = _grouped(all.where((s) => s.category == 'credit').toList(), sortAsc: true);
    final banks = _grouped(all.where((s) => s.category == 'bank' || s.category == 'eWallet').toList(), sortAsc: true);
    final savings = _grouped(all.where((s) => s.category == 'savings').toList());
    final others = all.where((s) => !const {'bank', 'credit', 'eWallet', 'savings'}.contains(s.category)).toList();

    final top = MediaQuery.paddingOf(context).top + 60;
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        flexibleSpace: ClipRect(
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(color: const Color(0x26F8F9FF)),
          ),
        ),
        leading: const AppBackButton(),
        title: const PageTitle('Tài sản ròng', subtitle: 'Quản lý'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: GestureDetector(
                onTap: _refresh,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.brandLight.withValues(alpha: 0.6),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.brand.withValues(alpha: 0.15)),
                  ),
                  child: const Icon(Icons.refresh_rounded, size: 20, color: AppColors.brand),
                ),
              ),
            ),
          ),
        ],
      ),
      body: Stack(children: [
        // Soft top gradient blob (web: rgba(196,181,253,.35) → transparent, h-72)
        Container(
          height: 288,
          decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x59C4B5FD), Color(0x00C4B5FD)])),
        ),
        RefreshIndicator(
          onRefresh: _refresh,
          edgeOffset: top,
          child: ListView(padding: EdgeInsets.fromLTRB(20, top + 8, 20, 120), children: [
            _hero(total, catCount),
            const SizedBox(height: 20),
            _tabs(),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(
                child: Text(_tab == _Tab.accounts ? 'Danh sách tài khoản' : _tab == _Tab.savings ? 'Sổ tiết kiệm' : 'Tài sản khác',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1F2937))),
              ),
              GestureDetector(
                onTap: _add,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: const Color(0x80FAF5FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFF3E8FF)),
                  ),
                  child: const Icon(Icons.add, size: 16, color: Color(0xFF9333EA)),
                ),
              ),
            ]),
            const SizedBox(height: 20),
            if (loading)
              for (var i = 0; i < 3; i++) const Padding(padding: EdgeInsets.only(bottom: 12), child: LoadingBox(height: 80))
            else ..._content(credit, banks, savings, others),
          ]),
        ),
      ]),
    );
  }

  Widget _hero(num total, int catCount) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Colors.white, Color(0xFFF5F0FF)]),
          border: Border.all(color: const Color(0xFFE9D5FF)),
          boxShadow: const [BoxShadow(color: Color(0x1F8B5CF6), blurRadius: 20, offset: Offset(0, 4), spreadRadius: -2)],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Expanded(child: Text('Tổng tài sản ròng', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.slate500))),
            GestureDetector(
              onTap: () => setState(() => _visible = !_visible),
              child: Icon(_visible ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 16, color: AppColors.slate400),
            ),
          ]),
          const SizedBox(height: 10),
          Text(_visible ? '${formatMoney(total)}đ' : '*******',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.4, height: 1, color: AppColors.slate800, fontFeatures: [FontFeature.tabularFigures()])),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0xFFD1FAE5))),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text('$catCount danh mục quản lý', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _emerald)),
            ]),
          ),
        ]),
      );

  Widget _tabs() => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          for (final (t, l) in [(_Tab.accounts, 'Tài khoản'), (_Tab.savings, 'Tiết kiệm'), (_Tab.other, 'Khác')])
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _tab = t),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _tab == t ? AppColors.brand : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: _tab == t ? const [BoxShadow(color: Color(0x14000000), blurRadius: 2, offset: Offset(0, 1))] : null,
                  ),
                  child: Text(l, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _tab == t ? Colors.white : AppColors.slate500)),
                ),
              ),
            ),
        ]),
      );

  List<Widget> _content(List<_Group> credit, List<_Group> banks, List<_Group> savings, List<_Src> others) {
    Widget empty(String t) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Text(t, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: AppColors.slate500)),
        );
    switch (_tab) {
      case _Tab.accounts:
        if (credit.isEmpty && banks.isEmpty) return [empty('Chưa có thẻ hoặc tài khoản nào.')];
        final active = banks.where((g) => g.total != 0).toList()..sort((a, b) => b.total.compareTo(a.total));
        final inactive = banks.where((g) => g.total == 0).toList();
        return [
          if (credit.isNotEmpty) ...[
            _sectionHeader('Thẻ tín dụng', credit.fold<num>(0, (s, g) => s + g.total)),
            for (final g in credit) _gap(_groupCard(g)),
            const SizedBox(height: 10),
          ],
          if (banks.isNotEmpty) ...[
            _sectionHeader('Tài khoản', banks.fold<num>(0, (s, g) => s + g.total)),
            for (final g in active) _gap(_groupCard(g)),
            if (inactive.isNotEmpty) _inactive(inactive),
          ],
        ];
      case _Tab.savings:
        if (savings.isEmpty) return [empty('Chưa có sổ tiết kiệm nào.')];
        return [
          _sectionHeader('Sổ tiết kiệm', savings.fold<num>(0, (s, g) => s + g.total)),
          for (final g in savings) _gap(_groupCard(g)),
        ];
      case _Tab.other:
        if (others.isEmpty) return [empty('Chưa có tài sản khác.')];
        return [
          _sectionHeader('Tài sản khác', others.fold<num>(0, (s, o) => s + o.balance)),
          for (final s in others) _gap(_row(s)),
        ];
    }
  }

  Widget _gap(Widget w) => Padding(padding: const EdgeInsets.only(bottom: 10), child: w);

  Widget _sectionHeader(String label, num total) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
        child: Row(children: [
          Expanded(child: Text(label.toUpperCase(), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.slate400, letterSpacing: 1.8))),
          Text(_fmtShortSigned(total), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _amountColor(total), fontFeatures: const [FontFeature.tabularFigures()])),
        ]),
      );

  BoxDecoration _cardBox({bool active = false}) => BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: active ? const Color(0xFFE9D5FF) : const Color(0xFFF3F4F6)),
        boxShadow: const [BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1))],
      );

  /// Bank logo on white, or a solid colour chip with the bank code.
  Widget _bankTile(BankCard c, double size) {
    final logo = bankLogo(c.bankShortName, c.bankName);
    final r = BorderRadius.circular(size >= 40 ? 16 : 12);
    final chip = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: hexColor(c.bankColor.isNotEmpty ? c.bankColor : '#3B82F6'), borderRadius: r),
      child: Text((c.bankShortName.isNotEmpty ? c.bankShortName : '?').substring(0, c.bankShortName.length.clamp(1, 3)).toUpperCase(),
          style: TextStyle(fontSize: (size * 0.28).roundToDouble(), fontWeight: FontWeight.w900, color: Colors.white)),
    );
    if (logo == null) return chip;
    return Container(
      width: size,
      height: size,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: r),
      child: Image.network(logo, fit: BoxFit.contain, errorBuilder: (_, _, _) => chip),
    );
  }

  Widget _lead(_Src s, {bool small = false}) {
    final c = s.card;
    if (c != null) {
      if (c.cardImage.isNotEmpty) return CardThumb(card: c, size: small ? CardThumbSize.sm : CardThumbSize.lg);
      return _bankTile(c, small ? 30 : 42);
    }
    final name = s.name.trim();
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: s.color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: s.color.withValues(alpha: 0.19)),
      ),
      alignment: Alignment.center,
      child: Text(name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: s.color)),
    );
  }

  Widget _usageBar(num pct, num limit, {double width = 128, bool small = false, Widget? bar}) {
    final color = _usage(pct);
    return SizedBox(
      width: width,
      child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
        SizedBox(height: small ? 4 : 6),
        bar ??
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(value: (pct / 100).clamp(0, 1).toDouble(), minHeight: small ? 4 : 6, backgroundColor: AppColors.slate100, color: color),
            ),
        SizedBox(height: small ? 2 : 4),
        Text.rich(
          TextSpan(children: [
            TextSpan(text: '${pct.toStringAsFixed(0)}% ', style: TextStyle(fontWeight: FontWeight.w700, color: color)),
            TextSpan(text: small ? '· hạn mức' : '· hạn mức ${_fmtLimit(limit)}', style: const TextStyle(fontWeight: FontWeight.w500, color: AppColors.slate400)),
          ]),
          maxLines: 1,
          style: TextStyle(fontSize: small ? 10 : 11),
        ),
      ]),
    );
  }

  Widget _amount(num v, {double size = 15, FontWeight weight = FontWeight.w700}) => Text(formatMoney(v),
      maxLines: 1,
      style: TextStyle(fontSize: size, fontWeight: weight, letterSpacing: -0.3, color: _amountColor(v), fontFeatures: const [FontFeature.tabularFigures()]));

  /// Single source / card row (web WealthCard).
  Widget _row(_Src s) {
    final c = s.card;
    final label = _catLabels[s.category] ?? 'Khác';
    final subtitle = c == null && s.note.isNotEmpty && s.note != label ? '$label · ${s.note}' : (s.note.isNotEmpty ? s.note : label);
    final limit = c?.creditLimit ?? 0;
    final pct = limit > 0 ? (s.balance.abs() / limit * 100).clamp(0, 100) : 0;
    return GestureDetector(
      onTap: () => _edit(s),
      onLongPress: () => _delete(s),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: _cardBox(),
        child: Row(children: [
          _lead(s),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              c != null
                  ? Text.rich(
                      TextSpan(children: [
                        TextSpan(text: c.bankShortName),
                        if (c.cardNumber.isNotEmpty) TextSpan(text: ' •••• ${c.cardNumber}', style: const TextStyle(color: AppColors.slate400, fontWeight: FontWeight.w600)),
                      ]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.slate800),
                    )
                  : Text(s.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.slate800)),
              const SizedBox(height: 2),
              Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
            ]),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
            _amount(s.balance),
            if (c != null && c.isCredit && limit > 0) _usageBar(pct, limit),
          ]),
        ]),
      ),
    );
  }

  /// Bank+type group (web GroupedWealthCard) — expandable, pooled-limit aware.
  Widget _groupCard(_Group g) {
    if (g.items.length == 1) return _row(g.items.first);
    final first = g.items.first.card!;
    final type = first.cardType;
    final unit = type == 'credit' ? 'thẻ' : type == 'savings' ? 'sổ' : 'mục';
    final subtitle = type == 'credit' ? 'Nhóm thẻ tín dụng' : type == 'savings' ? 'Nhóm sổ tiết kiệm' : 'Nhóm tài khoản';
    final expanded = _expanded.contains(g.key);
    final isCredit = type == 'credit';
    final shared = isCredit && g.items.any((i) => i.card!.sharedLimit);
    final limit = !isCredit
        ? 0
        : shared
            ? g.items.map((i) => i.card!.effectiveCreditLimit ?? i.card!.creditLimit).fold<num>(0, (m, v) => v > m ? v : m)
            : g.items.fold<num>(0, (s, i) => s + i.card!.creditLimit);
    final debt = g.items.fold<num>(0, (s, i) => s + i.balance.abs());
    final pct = limit > 0 ? (debt / limit * 100).clamp(0, 100) : 0;
    final color = _usage(pct);

    Widget? segBar;
    if (shared && limit > 0) {
      segBar = SizedBox(
        height: 6,
        child: LayoutBuilder(builder: (_, cons) {
          final w = cons.maxWidth;
          return Row(children: [
            for (final i in g.items)
              if (i.balance.abs() > 0)
                Container(
                  width: ((i.balance.abs() / limit) * w).clamp(3, w).toDouble(),
                  margin: const EdgeInsets.only(right: 2),
                  decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(999)),
                ),
            Expanded(child: Container(decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(999)))),
          ]);
        }),
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: _cardBox(active: expanded),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        InkWell(
          onTap: () => setState(() => expanded ? _expanded.remove(g.key) : _expanded.add(g.key)),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              _bankTile(first, 42),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(g.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.slate800))),
                    const SizedBox(width: 8),
                    _chip(g.items.length, unit, expanded),
                  ]),
                  const SizedBox(height: 2),
                  Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                ]),
              ),
              const SizedBox(width: 8),
              Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                _amount(g.total),
                if (isCredit && limit > 0) _usageBar(pct, limit, bar: segBar),
              ]),
            ]),
          ),
        ),
        if (expanded)
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
            child: Container(
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
              clipBehavior: Clip.antiAlias,
              child: Stack(children: [
                Column(children: [
                  for (var i = 0; i < g.items.length; i++) _childRow(g.items[i], g.title, i == 0, shared ? limit : null),
                ]),
                Positioned(
                  left: 0,
                  top: 0,
                  bottom: 0,
                  child: Container(
                    width: 3,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFA855F7), Color(0x66A855F7), Color(0x00A855F7)]),
                    ),
                  ),
                ),
              ]),
            ),
          ),
      ]),
    );
  }

  Widget _chip(int count, String unit, bool expanded) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.slate100,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.slate200.withValues(alpha: 0.7)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text('$count $unit', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.slate500)),
          const SizedBox(width: 2),
          AnimatedRotation(turns: expanded ? 0.5 : 0, duration: const Duration(milliseconds: 200), child: const Icon(Icons.keyboard_arrow_down_rounded, size: 12, color: AppColors.slate500)),
        ]),
      );

  /// Member row inside an expanded group (web ChildRow).
  Widget _childRow(_Src s, String bankShort, bool first, num? sharedLimit) {
    final c = s.card!;
    final suffix = c.bankName.isNotEmpty && c.bankName != bankShort ? ' · ${c.bankName}' : '';
    final limit = sharedLimit ?? c.creditLimit;
    final pct = limit > 0 ? (s.balance.abs() / limit * 100).clamp(0, 100) : 0;
    return GestureDetector(
      onTap: () => _edit(s),
      onLongPress: () => _delete(s),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 12, 10),
        decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: AppColors.slate200.withValues(alpha: 0.7)))),
        child: Row(children: [
          _lead(s, small: true),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: '•••• ${c.cardNumber}'),
                  TextSpan(text: suffix, style: const TextStyle(color: AppColors.slate400, fontWeight: FontWeight.w600)),
                ]),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate700),
              ),
              const SizedBox(height: 2),
              Text(s.note, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
            _amount(s.balance, size: 13, weight: FontWeight.w900),
            if (c.isCredit && limit > 0) _usageBar(pct, limit, width: 96, small: true),
          ]),
        ]),
      ),
    );
  }

  /// Zero-balance accounts bundled into one quiet row (web InactiveGroup).
  Widget _inactive(List<_Group> groups) {
    const key = '__inactive__';
    final open = _expanded.contains(key);
    final count = groups.fold<int>(0, (s, g) => s + g.items.length);
    final names = <String>{for (final g in groups) g.items.first.card?.bankShortName ?? g.title}.toList();
    final preview = names.take(3).join(', ') + (names.length > 3 ? '…' : '');
    return Column(children: [
      GestureDetector(
        onTap: () => setState(() => open ? _expanded.remove(key) : _expanded.add(key)),
        child: Opacity(
          opacity: open ? 1 : 0.75,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: _cardBox().copyWith(color: Colors.white.withValues(alpha: 0.7)),
            child: Row(children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(16)),
                child: const Icon(Icons.more_horiz_rounded, size: 18, color: AppColors.slate400),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Text('Không hoạt động', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.slate500)),
                    const SizedBox(width: 8),
                    _chip(count, 'mục', open),
                  ]),
                  const SizedBox(height: 2),
                  Text('Số dư 0đ · $preview', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                ]),
              ),
            ]),
          ),
        ),
      ),
      if (open)
        Padding(
          padding: const EdgeInsets.only(left: 20, top: 8),
          child: Column(children: [for (final g in groups) _gap(_groupCard(g))]),
        ),
    ]);
  }
}

Future<void> _editSource(BuildContext context, WidgetRef ref, Map<String, dynamic>? s) async {
  final changed = await showModalBottomSheet<bool>(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (_) => _SourceSheet(initial: s),
  );
  if (changed == true) {
    ref.invalidate(wealthSourcesProvider);
    ref.invalidate(wealthTotalProvider);
  }
}

class _SourceSheet extends ConsumerStatefulWidget {
  final Map<String, dynamic>? initial;
  const _SourceSheet({this.initial});
  @override
  ConsumerState<_SourceSheet> createState() => _SourceSheetState();
}

class _SourceSheetState extends ConsumerState<_SourceSheet> {
  late final _name = TextEditingController(text: (widget.initial?['name'] ?? '').toString());
  late final _balance = TextEditingController(text: ((widget.initial?['balance'] as num?) ?? 0) == 0 ? '' : ((widget.initial?['balance'] as num).round()).toString());
  late final _note = TextEditingController(text: (widget.initial?['note'] ?? '').toString());
  late String _cat = (widget.initial?['category'] ?? 'stock').toString();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _balance.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) return;
    setState(() => _busy = true);
    final svc = ref.read(financeServiceProvider);
    final data = {
      'name': _name.text.trim(),
      'balance': num.tryParse(_balance.text.replaceAll(RegExp(r'[^\d]'), '')) ?? 0,
      'category': _cat,
      'icon': _categories[_cat]!.$1,
      'note': _note.text.trim(),
    };
    try {
      final id = widget.initial?['_id']?.toString();
      if (id != null) {
        await svc.updateWealthSource(id, data);
      } else {
        await svc.createWealthSource(data);
      }
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lưu thất bại')));
      }
    }
  }

  Future<void> _delete() async {
    final id = widget.initial?['_id']?.toString();
    if (id == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xoá tài sản?'),
        content: Text('"${_name.text}" sẽ bị xoá khỏi tổng tài sản.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xoá', style: TextStyle(color: AppColors.expense))),
        ],
      ),
    );
    if (ok != true) return;
    await ref.read(financeServiceProvider).deleteWealthSource(id).catchError((_) {});
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final edit = widget.initial != null;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Center(child: Container(width: 44, height: 5, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3)))),
        const SizedBox(height: 12),
        Center(child: Text(edit ? 'Sửa tài sản' : 'Thêm tài sản', style: AppText.sheetTitle)),
        const SizedBox(height: 14),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final e in _categories.entries.where((e) => e.key != 'savings' && e.key != 'cashback'))
            ChoiceChip(
              label: Text(e.value.$2),
              selected: _cat == e.key,
              onSelected: (_) => setState(() => _cat = e.key),
              selectedColor: AppColors.brand,
              labelStyle: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _cat == e.key ? Colors.white : AppColors.slate700),
            ),
        ]),
        const SizedBox(height: 12),
        TextField(controller: _name, decoration: _dec('Tên (vd: Cổ phiếu FPT, 2 chỉ vàng SJC)')),
        const SizedBox(height: 10),
        TextField(controller: _balance, keyboardType: TextInputType.number, decoration: _dec('Giá trị hiện tại (₫)')),
        const SizedBox(height: 10),
        TextField(controller: _note, decoration: _dec('Ghi chú')),
        const SizedBox(height: 16),
        Row(children: [
          if (edit) ...[
            Expanded(child: OutlinedButton(onPressed: _busy ? null : _delete, style: OutlinedButton.styleFrom(foregroundColor: AppColors.expense, minimumSize: const Size(0, 48)), child: const Text('Xoá'))),
            const SizedBox(width: 10),
          ],
          Expanded(
            flex: 2,
            child: FilledButton(
              onPressed: _busy ? null : _save,
              style: FilledButton.styleFrom(backgroundColor: AppColors.brand, minimumSize: const Size(0, 48)),
              child: Text(_busy ? 'Đang lưu…' : edit ? 'Cập nhật' : 'Thêm', style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ]),
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
