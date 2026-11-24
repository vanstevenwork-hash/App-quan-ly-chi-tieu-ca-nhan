import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../constants/categories.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/card_thumb.dart';
import '../../widgets/common.dart';

/// Opens the add/edit transaction sheet — port of the web AddTransactionModal.
/// Pass [initial] to edit an existing one; [scan] opens "Quét Bill" right away.
Future<bool?> showAddTransactionSheet(BuildContext context, {TransactionModel? initial, bool scan = false}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _AddTransactionSheet(initial: initial, autoScan: scan),
  );
}

const _bg = Color(0xFFF8F9FF);
const _gradEnd = Color(0xFF9B4DE8);
const _months = [3, 6, 9, 12, 18, 24, 36];

enum _Tab { cash, account, credit, shared }

class _AddTransactionSheet extends ConsumerStatefulWidget {
  const _AddTransactionSheet({this.initial, this.autoScan = false});
  final TransactionModel? initial;
  final bool autoScan;
  @override
  ConsumerState<_AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends ConsumerState<_AddTransactionSheet> {
  bool _isExpense = true;
  final _amount = TextEditingController();
  final _note = TextEditingController();
  final _feePct = TextEditingController();
  final _feeAmt = TextEditingController();
  String _category = '';
  DateTime _date = DateTime.now();
  _Tab _tab = _Tab.cash;
  String _cardId = 'cash';
  bool _isInstallment = false;
  int _installmentMonths = 12;
  bool _hasFee = false;
  String _receiptImage = '';
  bool _saving = false, _scanning = false, _uploading = false;
  String? _errAmount, _errCategory, _errFee;

  bool get _isEdit => widget.initial != null;
  int get _amountNum => int.tryParse(_amount.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
  int get _feeNum => _hasFee ? (int.tryParse(_feeAmt.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0) : 0;
  int get _monthly => _isInstallment && _installmentMonths > 0 ? (_amountNum / _installmentMonths).ceil() : 0;

  @override
  void initState() {
    super.initState();
    final t = widget.initial;
    if (t != null) {
      _isExpense = !t.isIncome;
      _category = t.category;
      _note.text = t.note;
      _date = t.date;
      _setAmount(t.amount.round());
      _isInstallment = t.isInstallment;
      _installmentMonths = t.installmentMonths > 0 ? t.installmentMonths : 12;
      _receiptImage = t.receiptImage;
      if (t.feeAmount > 0) {
        _hasFee = true;
        _feeAmt.text = _fmt(t.feeAmount.round());
        if (t.amount > 0) _feePct.text = _pctStr(t.feeAmount / t.amount * 100);
      }
      if (t.paymentMethod != 'cash' && t.cardId != null) {
        _cardId = t.cardId!;
        _tab = _Tab.account; // refined once cards are known (see _resolveTab)
        _needsTabResolve = true;
      }
    }
    if (widget.autoScan) WidgetsBinding.instance.addPostFrameCallback((_) => _scan());
  }

  bool _needsTabResolve = false;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    _feePct.dispose();
    _feeAmt.dispose();
    super.dispose();
  }

  // ── helpers ──────────────────────────────────────────────────────────
  static String _fmt(int n) => formatMoney(n);
  static String _pctStr(num p) => p.toStringAsFixed(2).replaceFirst(RegExp(r'\.?0+$'), '');
  void _setAmount(int n) => _amount.text = n > 0 ? _fmt(n) : '';
  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  bool _isCashCard(BankCard c) {
    final bn = c.bankName.toLowerCase();
    return bn.contains('tiền mặt') || bn.contains('ví') || c.isWallet;
  }

  List<BankCard> _cardsFor(_Tab tab, List<BankCard> cards, List<BankCard> shared) => switch (tab) {
        _Tab.cash => cards.where(_isCashCard).toList(),
        _Tab.account => cards.where((c) => c.cardType == 'debit' || c.isWallet).toList(),
        _Tab.credit => cards.where((c) => c.isCredit).toList(),
        _Tab.shared => shared,
      };

  void _selectTab(_Tab tab, List<BankCard> cards, List<BankCard> shared) {
    final list = _cardsFor(tab, cards, shared);
    setState(() {
      _tab = tab;
      if (tab == _Tab.cash) {
        _cardId = list.isNotEmpty ? list.first.id : 'cash';
      } else if (list.isNotEmpty && !list.any((c) => c.id == _cardId)) {
        _cardId = list.first.id;
      } else if (list.isEmpty) {
        _cardId = 'cash';
      }
      if (tab != _Tab.credit) _isInstallment = false;
    });
  }

  void _onFeePct(String v) {
    final p = double.tryParse(v.replaceAll(',', '.')) ?? 0;
    _feeAmt.text = _amountNum > 0 && v.isNotEmpty ? _fmt((_amountNum * p / 100).round()) : '';
    setState(() => _errFee = null);
  }

  void _onFeeAmt(String v) {
    final a = int.tryParse(v.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    _feePct.text = _amountNum > 0 && a > 0 ? _pctStr(a / _amountNum * 100) : '';
    setState(() => _errFee = null);
  }

  // ── actions ──────────────────────────────────────────────────────────
  Future<void> _scan() async {
    final src = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: const Text('Chụp bill'), onTap: () => Navigator.pop(c, ImageSource.camera)),
          ListTile(title: const Text('Chọn từ thư viện'), onTap: () => Navigator.pop(c, ImageSource.gallery)),
        ]),
      ),
    );
    if (src == null) return;
    final picked = await ImagePicker().pickImage(source: src, maxWidth: 1600, imageQuality: 85);
    if (picked == null) return;
    setState(() => _scanning = true);
    try {
      final r = await ref.read(financeServiceProvider).scanReceipt(picked.path);
      final amt = (r['amount'] is num) ? (r['amount'] as num).round() : int.tryParse('${r['amount']}') ?? 0;
      setState(() {
        if (amt > 0) _setAmount(amt);
        final d = DateTime.tryParse((r['date'] ?? '').toString());
        if (d != null) _date = DateTime(d.year, d.month, d.day, _date.hour, _date.minute);
        final note = (r['note'] ?? '').toString();
        if (note.isNotEmpty) _note.text = note.length > 200 ? note.substring(0, 200) : note;
        final cat = (r['suggestedCategory'] ?? '').toString();
        if (cat.isNotEmpty) _category = cat;
        final img = (r['imageUrl'] ?? '').toString();
        if (img.isNotEmpty) _receiptImage = img;
        _errAmount = _errCategory = null;
      });
      _toast('Đã điền thông tin từ bill');
    } on DioException catch (e) {
      final msg = e.response?.data is Map ? (e.response!.data['message'] ?? '').toString() : '';
      _toast(msg.isNotEmpty ? msg : 'Không đọc được bill, thử ảnh rõ hơn');
    } catch (_) {
      _toast('Không đọc được bill, thử ảnh rõ hơn');
    }
    if (mounted) setState(() => _scanning = false);
  }

  Future<void> _pickReceipt() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 85);
    if (picked == null) return;
    setState(() => _uploading = true);
    try {
      final url = await ref.read(financeServiceProvider).uploadImage(picked.path, folder: 'chi_tieu/receipts');
      setState(() => _receiptImage = url);
    } catch (_) {
      _toast('Tải ảnh thất bại');
    }
    if (mounted) setState(() => _uploading = false);
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _date = DateTime(picked.year, picked.month, picked.day, _date.hour, _date.minute));
  }

  Future<void> _save() async {
    final amount = _amountNum;
    setState(() {
      _errAmount = amount <= 0 ? 'Vui lòng nhập số tiền hợp lệ' : null;
      _errCategory = _category.isEmpty ? 'Vui lòng chọn danh mục' : null;
      _errFee = _cardId != 'cash' && _hasFee && _feeNum > amount ? 'Phí không được lớn hơn số tiền giao dịch' : null;
    });
    if (_errAmount != null || _errCategory != null || _errFee != null) return;
    setState(() => _saving = true);
    final inst = _tab == _Tab.credit && _isInstallment;
    final isCard = _cardId != 'cash';
    final data = <String, dynamic>{
      'type': _isExpense ? 'expense' : 'income',
      'amount': amount,
      'category': _category,
      'note': _note.text.trim(),
      'date': _date.toUtc().toIso8601String(),
      'paymentMethod': isCard ? 'card' : 'cash',
      'cardId': isCard ? _cardId : null,
      'receiptImage': _receiptImage,
      'isInstallment': inst,
      'installmentMonths': inst ? _installmentMonths : 0,
      'installmentMonthly': inst ? _monthly : 0,
      if (inst) 'installmentStartDate': _date.toUtc().toIso8601String(),
      'feeAmount': isCard && _hasFee ? _feeNum : 0,
    };
    try {
      await ref.read(financeServiceProvider).saveTransaction(data, id: widget.initial?.id);
      refreshFinance(ref);
      if (!mounted) return;
      final msg = _isEdit
          ? 'Đã cập nhật giao dịch!'
          : inst
              ? 'Đã thêm trả góp! Mỗi tháng: ${_fmt(_monthly)}₫'
              : _isExpense
                  ? 'Đã thêm chi tiêu!'
                  : 'Đã thêm thu nhập!';
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop(true);
      messenger.showSnackBar(SnackBar(content: Text(msg)));
    } on DioException catch (e) {
      final m = e.response?.data is Map ? (e.response!.data['message'] ?? '').toString() : '';
      _toast('Lỗi: ${m.isNotEmpty ? m : 'Lưu thất bại'}');
    } catch (_) {
      _toast('Lỗi: Lưu thất bại');
    }
    if (mounted) setState(() => _saving = false);
  }

  // ── UI ───────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final cards = ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[];
    final sharedRaw = (ref.watch(sharedCardsProvider).valueOrNull ?? const []).where((s) => s.permission != 'view-only').toList();
    final shared = [for (final s in sharedRaw) s.card];
    final ownerOf = {for (final s in sharedRaw) s.card.id: s.ownerName.split(' ').last};

    if (_needsTabResolve && cards.isNotEmpty) {
      _needsTabResolve = false;
      _tab = shared.any((c) => c.id == _cardId)
          ? _Tab.shared
          : cards.any((c) => c.id == _cardId && c.isCredit)
              ? _Tab.credit
              : cards.any((c) => c.id == _cardId && _isCashCard(c) && c.cardType != 'debit')
                  ? _Tab.cash
                  : _Tab.account;
    } else if (!_isEdit && _tab == _Tab.cash && _cardId == 'cash') {
      final cash = cards.where(_isCashCard);
      if (cash.isNotEmpty) _cardId = cash.first.id;
    }

    final h = MediaQuery.sizeOf(context).height;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        height: h * 0.85,
        decoration: const BoxDecoration(color: _bg, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 12, bottom: 4),
              alignment: Alignment.center,
              child: Container(width: 48, height: 5, decoration: BoxDecoration(color: AppColors.slate300, borderRadius: BorderRadius.circular(3))),
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.slate200.withValues(alpha: 0.5)))),
            child: Text(_isEdit ? 'Sửa giao dịch' : 'Thêm giao dịch',
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.black, letterSpacing: -0.2)),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 16),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                _typeToggle(),
                if (_scanning) ...[const SizedBox(height: 10), _scanningBanner()],
                const SizedBox(height: 10),
                _amountBlock(),
                const SizedBox(height: 10),
                _categoryBlock(),
                const SizedBox(height: 10),
                _paymentBlock(cards, shared, ownerOf),
                if (_tab == _Tab.credit && _cardId != 'cash') ...[const SizedBox(height: 10), _installmentBlock()],
                if (_cardId != 'cash' && _tab != _Tab.cash && _isExpense) ...[const SizedBox(height: 10), _feeBlock([...cards, ...shared])],
                const SizedBox(height: 10),
                _dateBlock(),
                const SizedBox(height: 10),
                _noteBlock(),
                const SizedBox(height: 10),
                _receiptBlock(),
              ],
            ),
          ),
          _bottomBar(),
        ]),
      ),
    );
  }

  Widget _block({required Widget child}) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.slate200)),
        child: child,
      );

  Widget _label(String t, {Widget? trailing}) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Text(t, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.slate700)),
          if (trailing != null) ...[const SizedBox(width: 8), Flexible(child: trailing)],
        ]),
      );

  Widget _err(String? e) => e == null
      ? const SizedBox.shrink()
      : Padding(padding: const EdgeInsets.only(top: 6), child: Text(e, style: const TextStyle(fontSize: 12, color: AppColors.expense)));

  Widget _typeToggle() => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(999)),
        child: Row(children: [
          for (final exp in [true, false])
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() {
                  if (_isExpense == exp) return;
                  _isExpense = exp;
                  _category = '';
                }),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _isExpense == exp ? Colors.white : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: _isExpense == exp ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 4, offset: const Offset(0, 1))] : null,
                  ),
                  child: Text(exp ? 'Chi tiêu' : 'Thu nhập',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _isExpense == exp ? AppColors.brand : AppColors.slate500)),
                ),
              ),
            ),
        ]),
      );

  Widget _scanningBanner() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(14)),
        child: const Row(children: [
          SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand)),
          SizedBox(width: 10),
          Expanded(child: Text('Đang đọc bill… (có thể mất ~30 giây)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.brand))),
        ]),
      );

  Widget _amountBlock() {
    final chips = <(String, VoidCallback)>[
      ('C', () => _amount.clear()),
      ('000', () { if (_amountNum > 0) _setAmount(_amountNum * 1000); }),
      for (final (l, v) in [('+50k', 50000), ('+100k', 100000), ('+200k', 200000), ('+500k', 500000), ('+1M', 1000000)])
        (l, () => _setAmount(_amountNum + v)),
    ];
    return _block(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _label('Số tiền'),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.only(bottom: 2),
              decoration: BoxDecoration(
                border: Border(bottom: BorderSide(width: 2, color: _errAmount != null ? AppColors.expense : AppColors.slate200)),
              ),
              child: Row(children: [
                const Text('₫', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.slate400)),
                const SizedBox(width: 6),
                Expanded(
                  child: TextField(
                    controller: _amount,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, _ThousandsFormatter()],
                    onChanged: (_) => setState(() => _errAmount = null),
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.slate900, fontFeatures: [FontFeature.tabularFigures()]),
                    decoration: const InputDecoration(
                      hintText: '0',
                      hintStyle: TextStyle(color: AppColors.slate300, fontWeight: FontWeight.w800),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(vertical: 6),
                    ),
                  ),
                ),
              ]),
            ),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: MediaQuery.sizeOf(context).width * 0.42,
            height: 30,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: chips.length,
              separatorBuilder: (_, _) => const SizedBox(width: 6),
              itemBuilder: (_, i) {
                final clear = i == 0;
                return GestureDetector(
                  onTap: () => setState(() {
                    chips[i].$2();
                    _errAmount = null;
                  }),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: clear ? const Color(0xFFFEF2F2) : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: clear ? const Color(0xFFFECACA) : AppColors.slate200),
                    ),
                    child: Text(chips[i].$1,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: clear ? AppColors.expense : AppColors.slate600)),
                  ),
                );
              },
            ),
          ),
        ]),
        _err(_errAmount),
      ]),
    );
  }

  Widget _categoryBlock() {
    final cats = categoriesFor(!_isExpense);
    return _block(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _label('Danh mục',
            trailing: _errCategory == null ? null : Text(_errCategory!, style: const TextStyle(fontSize: 12, color: AppColors.expense))),
        GridView.builder(
          shrinkWrap: true,
          padding: EdgeInsets.zero,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: cats.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 5, mainAxisSpacing: 12, crossAxisSpacing: 8, mainAxisExtent: 70),
          itemBuilder: (_, i) {
            final c = cats[i];
            final sel = c.label == _category;
            return GestureDetector(
              onTap: () => setState(() {
                _category = c.label;
                _errCategory = null;
              }),
              behavior: HitTestBehavior.opaque,
              child: Column(children: [
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                        color: sel ? AppColors.brand : (_errCategory != null ? const Color(0xFFFCA5A5) : Colors.transparent), width: sel ? 2 : 1),
                  ),
                  child: CategoryTile(iconType: c.iconType, color: sel ? AppColors.brand : c.color, size: 42),
                ),
                const SizedBox(height: 4),
                Text(c.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: sel ? AppColors.brand : AppColors.slate600)),
              ]),
            );
          },
        ),
      ]),
    );
  }

  Widget _paymentBlock(List<BankCard> cards, List<BankCard> shared, Map<String, String> ownerOf) {
    final tabs = [
      (_Tab.cash, 'Tiền mặt'),
      (_Tab.account, 'Tài khoản'),
      (_Tab.credit, 'Tín dụng'),
      if (shared.isNotEmpty) (_Tab.shared, 'Thẻ chung'),
    ];
    final list = _cardsFor(_tab, cards, shared);
    return _block(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _label('Phương thức thanh toán'),
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            for (final (t, l) in tabs)
              Expanded(
                child: GestureDetector(
                  onTap: () => _selectTab(t, cards, shared),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: _tab == t ? AppColors.brand : Colors.transparent, borderRadius: BorderRadius.circular(10)),
                    child: Text(l, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _tab == t ? Colors.white : AppColors.slate500)),
                  ),
                ),
              ),
          ]),
        ),
        const SizedBox(height: 10),
        if (list.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Text(
              _tab == _Tab.cash ? 'Thanh toán bằng tiền mặt' : 'Chưa có thẻ nào trong mục này',
              style: const TextStyle(fontSize: 12, color: AppColors.slate500, fontWeight: FontWeight.w600),
            ),
          )
        else
          SizedBox(
            height: 92,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (_, i) => _cardTile(list[i], owner: _tab == _Tab.shared ? ownerOf[list[i].id] : null),
            ),
          ),
      ]),
    );
  }

  Widget _cardTile(BankCard c, {String? owner}) {
    final sel = _cardId == c.id;
    final last4 = c.cardNumber.length > 4 ? c.cardNumber.substring(c.cardNumber.length - 4) : c.cardNumber;
    final amountLine = c.isCredit ? 'Còn ${formatCompact(c.creditLimit - c.balance)}' : formatCompact(c.balance);
    return GestureDetector(
      onTap: () => setState(() {
        _cardId = c.id;
        _errFee = null;
      }),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 128,
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: sel ? AppColors.brandLight.withValues(alpha: 0.25) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: sel ? AppColors.brand : AppColors.slate200, width: sel ? 2 : 1),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            CardThumb(card: c, size: CardThumbSize.sm),
            const Spacer(),
          ]),
          const Spacer(),
          Text('${c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName}${last4.isNotEmpty ? ' ••$last4' : ''}',
              maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.slate800)),
          Text(owner != null && owner.isNotEmpty ? '$owner · $amountLine' : amountLine,
              maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.slate500, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }

  Widget _switchRow({required String title, String? subtitle, required bool value, required ValueChanged<bool> onChanged, Color color = AppColors.brand}) =>
      Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate800)),
            if (subtitle != null) Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
          ]),
        ),
        Switch.adaptive(value: value, onChanged: onChanged, activeTrackColor: color),
      ]);

  Widget _installmentBlock() => _block(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _switchRow(
            title: 'Trả góp 0% lãi suất',
            subtitle: 'Chia nhỏ khoản chi theo tháng',
            value: _isInstallment,
            onChanged: (v) => setState(() => _isInstallment = v),
          ),
          if (_isInstallment) ...[
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final m in _months)
                GestureDetector(
                  onTap: () => setState(() => _installmentMonths = m),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: _installmentMonths == m ? AppColors.brand : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: _installmentMonths == m ? AppColors.brand : AppColors.slate200),
                    ),
                    child: Text('$m th',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _installmentMonths == m ? Colors.white : AppColors.slate600)),
                  ),
                ),
            ]),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                _kv('Tổng dư nợ', '${_fmt(_amountNum)}₫'),
                _kv('Số kỳ', '$_installmentMonths tháng'),
                _kv('Mỗi tháng', '${_fmt(_monthly)}₫', strong: true),
              ]),
            ),
          ],
        ]),
      );

  Widget _kv(String k, String v, {bool strong = false}) => Expanded(
        child: Column(children: [
          Text(k, style: const TextStyle(fontSize: 11, color: AppColors.slate500)),
          const SizedBox(height: 2),
          Text(v,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: strong ? AppColors.brand : AppColors.slate800)),
        ]),
      );

  Widget _feeBlock(List<BankCard> all) {
    const amber = Color(0xFFD97706);
    final card = all.where((c) => c.id == _cardId).firstOrNull;
    final rate = card?.cashbackRate ?? 0;
    final gross = (_amountNum * rate / 100).round();
    final net = gross - _feeNum;
    InputDecoration dec(String suffix) => InputDecoration(
          isDense: true,
          suffixText: suffix,
          filled: true,
          fillColor: const Color(0xFFFFFBEB),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFFDE68A))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFFDE68A))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: amber, width: 1.5)),
        );
    return _block(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _switchRow(
          title: 'Giao dịch bị tính phí',
          subtitle: 'Phí sẽ trừ vào tiền hoàn',
          value: _hasFee,
          color: amber,
          onChanged: (v) => setState(() {
            _hasFee = v;
            _errFee = null;
            if (!v) {
              _feePct.clear();
              _feeAmt.clear();
            }
          }),
        ),
        if (_hasFee) ...[
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _feePct,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                onChanged: _onFeePct,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                decoration: dec('%'),
              ),
            ),
            const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('=', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate400))),
            Expanded(
              flex: 2,
              child: TextField(
                controller: _feeAmt,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, _ThousandsFormatter()],
                onChanged: _onFeeAmt,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                decoration: dec('₫'),
              ),
            ),
          ]),
          _err(_errFee),
          if (rate > 0 && _amountNum > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text.rich(
                TextSpan(style: const TextStyle(fontSize: 12, color: AppColors.slate500), children: [
                  const TextSpan(text: 'Hoàn ước tính '),
                  TextSpan(text: '+${_fmt(gross)}', style: const TextStyle(color: AppColors.income, fontWeight: FontWeight.w700)),
                  const TextSpan(text: ' − '),
                  TextSpan(text: _fmt(_feeNum), style: const TextStyle(color: AppColors.expense, fontWeight: FontWeight.w700)),
                  const TextSpan(text: ' = '),
                  TextSpan(
                      text: '${net >= 0 ? '+' : ''}${_fmt(net)}₫',
                      style: TextStyle(color: net >= 0 ? AppColors.income : AppColors.expense, fontWeight: FontWeight.w800)),
                ]),
              ),
            ),
        ],
      ]),
    );
  }

  Widget _dateBlock() {
    final now = DateTime.now();
    final today = now.year == _date.year && now.month == _date.month && now.day == _date.day;
    return GestureDetector(
      onTap: _pickDate,
      child: _block(
        child: Row(children: [
          const Text('Ngày giao dịch', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.slate700)),
          const Spacer(),
          Text('${today ? 'Hôm nay, ' : ''}${_date.day} Thg ${_date.month}${_date.year != now.year ? ', ${_date.year}' : ''}',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.brand)),
        ]),
      ),
    );
  }

  Widget _noteBlock() => _block(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _label('Ghi chú'),
          TextField(
            controller: _note,
            maxLines: 3,
            minLines: 2,
            maxLength: 200,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(fontSize: 14, color: AppColors.slate800),
            decoration: InputDecoration(
              hintText: 'Thêm ghi chú…',
              hintStyle: const TextStyle(color: AppColors.slate400, fontSize: 14),
              counterText: '',
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              isDense: true,
              contentPadding: const EdgeInsets.all(10),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('${_note.text.length}/200', style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
            ),
          ),
        ]),
      );

  Widget _receiptBlock() => _block(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _label('Ảnh hóa đơn'),
          if (_receiptImage.isNotEmpty)
            Stack(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(_receiptImage, height: 140, width: double.infinity, fit: BoxFit.cover,
                    errorBuilder: (_, _, _) => Container(height: 80, color: AppColors.slate100, alignment: Alignment.center, child: const Icon(Icons.broken_image_outlined))),
              ),
              Positioned(
                top: 6,
                right: 6,
                child: GestureDetector(
                  onTap: () => setState(() => _receiptImage = ''),
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                    child: const Icon(Icons.close, size: 16, color: Colors.white),
                  ),
                ),
              ),
            ])
          else
            GestureDetector(
              onTap: _uploading ? null : _pickReceipt,
              child: Container(
                height: 64,
                width: double.infinity,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.slate200),
                ),
                child: _uploading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Row(mainAxisSize: MainAxisSize.min, children: [
                        Text('+ Thêm ảnh hóa đơn', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate500)),
                      ]),
              ),
            ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: _scanning ? null : _scan,
            child: const Text('Hoặc dùng Quét Bill để tự điền →', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.brand)),
          ),
        ]),
      );

  Widget _bottomBar() => Container(
        padding: EdgeInsets.fromLTRB(12, 10, 12, 10 + MediaQuery.paddingOf(context).bottom),
        decoration: BoxDecoration(color: _bg, border: Border(top: BorderSide(color: AppColors.slate200.withValues(alpha: 0.6)))),
        child: Row(children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(14)),
              child: const Text('Đóng', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate600)),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: _scanning ? null : _scan,
            child: Container(
              height: 48,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.brand, width: 1.5)),
              child: Row(children: [
                if (_scanning) ...[
                  const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brand)),
                  const SizedBox(width: 6),
                ],
                const Text('Quét Bill', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.brand)),
              ]),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: GestureDetector(
              onTap: _saving ? null : _save,
              child: Container(
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppColors.brand, _gradEnd]),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [BoxShadow(color: AppColors.brand.withValues(alpha: 0.25), blurRadius: 12, offset: const Offset(0, 4))],
                ),
                child: _saving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                    : Text(_isEdit ? 'Cập nhật →' : 'Thêm →', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
              ),
            ),
          ),
        ]),
      );
}

/// Formats the amount field with thousands separators as the user types.
class _ThousandsFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return newValue.copyWith(text: '', selection: const TextSelection.collapsed(offset: 0));
    final out = formatMoney(int.parse(digits));
    return TextEditingValue(text: out, selection: TextSelection.collapsed(offset: out.length));
  }
}
