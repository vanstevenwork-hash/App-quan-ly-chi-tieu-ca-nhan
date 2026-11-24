import 'dart:io';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../constants/categories.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

/// "Chia sẻ hoá đơn" — port of the web ExpenseShareModal: split an expense
/// between people, show a receipt ticket (with the receiving account's QR) to
/// send into a group chat, and tick people off as they pay you back.
Future<void> showExpenseShareSheet(BuildContext context, TransactionModel tx) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ExpenseShareSheet(tx: tx),
    );

const _avatarColors = [Color(0xFFF59E0B), Color(0xFF6366F1), Color(0xFF10B981), Color(0xFFEC4899), Color(0xFF06B6D4), Color(0xFF8B5CF6)];
const _gradEnd = Color(0xFF9B4DE8);
const _emerald = Color(0xFF10B981);

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, parts.first.length.clamp(0, 2)).toUpperCase();
  return (parts.first[0] + parts.last[0]).toUpperCase();
}

String _groupAcc(String n) => n.replaceAllMapped(RegExp(r'(\d{4})(?=\d)'), (m) => '${m[1]} ');

String _hm(dynamic iso) {
  final d = iso == null ? null : DateTime.tryParse(iso.toString())?.toLocal();
  return d == null ? '' : '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

class _Row {
  final TextEditingController name, amount, note;
  _Row({String n = '', num a = 0, String no = ''})
      : name = TextEditingController(text: n),
        amount = TextEditingController(text: a > 0 ? formatMoney(a) : ''),
        note = TextEditingController(text: no);
  int get amt => int.tryParse(amount.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
  void dispose() {
    name.dispose();
    amount.dispose();
    note.dispose();
  }
}

class _ExpenseShareSheet extends ConsumerStatefulWidget {
  final TransactionModel tx;
  const _ExpenseShareSheet({required this.tx});
  @override
  ConsumerState<_ExpenseShareSheet> createState() => _ExpenseShareSheetState();
}

class _ExpenseShareSheetState extends ConsumerState<_ExpenseShareSheet> {
  bool _loading = true, _saving = false, _editing = false, _exporting = false;
  Map<String, dynamic>? _share;
  List<_Row> _rows = [_Row()];
  String _receiveCardId = '';
  final _ticketKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  String _errMsg(Object e, String fb) {
    if (e is DioException && e.response?.data is Map) {
      final m = (e.response!.data['message'] ?? '').toString();
      if (m.isNotEmpty) return m;
    }
    return fb;
  }

  List<Map<String, dynamic>> get _participants =>
      ((_share?['participants'] as List?) ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  Map<String, dynamic> get _recv => _share?['receiveCardId'] is Map ? Map<String, dynamic>.from(_share!['receiveCardId']) : const {};

  void _setRows(List<_Row> rows) {
    for (final r in _rows) {
      r.dispose();
    }
    _rows = rows;
  }

  void _applyShare(Map<String, dynamic>? s) {
    _share = s;
    if (s != null) {
      _editing = false;
      _setRows([for (final p in _participants) _Row(n: '${p['name'] ?? ''}', a: (p['amount'] as num?) ?? 0, no: '${p['note'] ?? ''}')]);
      _receiveCardId = _recv['_id']?.toString() ?? '';
    }
  }

  Future<void> _load() async {
    try {
      final s = await ref.read(financeServiceProvider).expenseShareFor(widget.tx.id);
      if (!mounted) return;
      setState(() {
        _applyShare(s);
        if (s == null) _editing = true;
      });
    } catch (_) {
      if (mounted) {
        _toast('Không thể tải thông tin chia bill');
        setState(() => _editing = true);
      }
    }
    if (mounted) setState(() => _loading = false);
  }

  int get _sum => _rows.fold(0, (s, r) => s + r.amt);
  bool get _canSubmit =>
      _rows.isNotEmpty && _rows.every((r) => r.name.text.trim().isNotEmpty && r.amt > 0) && _sum <= widget.tx.amount && _receiveCardId.isNotEmpty;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _saving = true);
    try {
      final s = await ref.read(financeServiceProvider).saveExpenseShare(
            id: _share?['_id']?.toString(),
            transactionId: widget.tx.id,
            receiveCardId: _receiveCardId,
            participants: [for (final r in _rows) {'name': r.name.text.trim(), 'amount': r.amt, 'note': r.note.text.trim()}],
          );
      setState(() => _applyShare(s));
      _toast('Đã lưu chia bill');
    } catch (e) {
      _toast(_errMsg(e, 'Không thể lưu'));
    }
    if (mounted) setState(() => _saving = false);
  }

  Future<bool> _confirm(String msg) async =>
      await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          content: Text(msg),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Hủy')),
            TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Đồng ý', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold))),
          ],
        ),
      ) ==
      true;

  Future<void> _mark(Map<String, dynamic> p, bool paid) async {
    if (!paid && !await _confirm('Bỏ xác nhận đã nhận tiền? Giao dịch hoàn tiền tương ứng sẽ bị xoá.')) return;
    try {
      final s = await ref.read(financeServiceProvider).markSharePaid(_share!['_id'].toString(), p['_id'].toString(), paid);
      setState(() => _share = s ?? _share);
      refreshFinance(ref);
      _toast(paid ? 'Đã xác nhận nhận tiền' : 'Đã bỏ xác nhận');
    } catch (e) {
      _toast(_errMsg(e, paid ? 'Không thể xác nhận' : 'Không thể bỏ xác nhận'));
    }
  }

  Future<void> _delete() async {
    if (!await _confirm('Xoá bản chia bill này?')) return;
    try {
      await ref.read(financeServiceProvider).deleteExpenseShare(_share!['_id'].toString());
      setState(() {
        _share = null;
        _editing = true;
        _setRows([_Row()]);
      });
      _toast('Đã xoá');
    } catch (e) {
      _toast(_errMsg(e, 'Không thể xoá'));
    }
  }

  Future<void> _exportImage() async {
    setState(() => _exporting = true);
    try {
      final boundary = _ticketKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) throw Exception('no boundary');
      final img = await boundary.toImage(pixelRatio: 3);
      final bytes = (await img.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List();
      final dir = await getTemporaryDirectory();
      final f = File('${dir.path}/chia-bill-${widget.tx.id.substring(widget.tx.id.length - 6)}.png');
      await f.writeAsBytes(bytes);
      await SharePlus.instance.share(ShareParams(files: [XFile(f.path, mimeType: 'image/png')], text: 'Chia bill ${widget.tx.category}'));
    } catch (_) {
      _toast('Không thể tạo ảnh');
    }
    if (mounted) setState(() => _exporting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.sizeOf(context).height * 0.92,
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Column(children: [
        GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 10, bottom: 6),
            alignment: Alignment.center,
            child: Container(width: 48, height: 6, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3))),
          ),
        ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.slate100))),
          child: const Text('Chia sẻ hoá đơn', textAlign: TextAlign.center, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.black)),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.brand))
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  children: _editing ? _form() : (_share != null ? _ticket() : const []),
                ),
        ),
        if (_editing && !_loading)
          Container(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.slate100))),
            child: Opacity(
              opacity: _canSubmit && !_saving ? 1 : 0.5,
              child: GestureDetector(
                onTap: _canSubmit && !_saving ? _submit : null,
                child: Container(
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppColors.brand, _gradEnd]), borderRadius: BorderRadius.circular(14)),
                  child: Text(_saving ? 'Đang lưu...' : 'OK', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ),
      ]),
    );
  }

  InputDecoration _dec(String hint, {bool small = false}) => InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: AppColors.slate400, fontSize: small ? 12 : 14, fontWeight: FontWeight.w500),
        isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: small ? 9 : 12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.brand, width: 1.5)),
      );

  List<Widget> _form() {
    final total = widget.tx.amount;
    final mine = total - _sum;
    final receivable = (ref.watch(cardsProvider).valueOrNull ?? const []).where((c) => c.receiveQrImage.isNotEmpty && !c.isSavings).toList();
    if (_receiveCardId.isEmpty && receivable.isNotEmpty) _receiveCardId = receivable.first.id;
    return [
      Row(children: [
        Text.rich(TextSpan(style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black), children: [
          const TextSpan(text: 'Tổng: '),
          TextSpan(text: '${formatMoney(total)}đ', style: const TextStyle(color: AppColors.brand)),
        ])),
        const Spacer(),
        GestureDetector(
          onTap: () => setState(() {
            final each = (total / (_rows.length + 1)).floor();
            for (final r in _rows) {
              r.amount.text = formatMoney(each);
            }
          }),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(999)),
            child: const Text('Chia đều', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.brand)),
          ),
        ),
      ]),
      const SizedBox(height: 12),
      for (var i = 0; i < _rows.length; i++)
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate200)),
          child: Column(children: [
            Row(children: [
              Expanded(
                flex: 6,
                child: TextField(
                  controller: _rows[i].name,
                  onChanged: (_) => setState(() {}),
                  textCapitalization: TextCapitalization.words,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  decoration: _dec('Người ${i + 1}'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 5,
                child: TextField(
                  controller: _rows[i].amount,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, _Thousands()],
                  onChanged: (_) => setState(() {}),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                  decoration: _dec('Số tiền'),
                ),
              ),
              const SizedBox(width: 6),
              Opacity(
                opacity: _rows.length == 1 ? 0.3 : 1,
                child: GestureDetector(
                  onTap: _rows.length == 1
                      ? null
                      : () => setState(() {
                            _rows.removeAt(i).dispose();
                          }),
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.close, size: 15, color: AppColors.expense),
                  ),
                ),
              ),
            ]),
            const SizedBox(height: 6),
            TextField(
              controller: _rows[i].note,
              style: const TextStyle(fontSize: 12),
              decoration: _dec('Ghi chú: ăn gì, uống gì... (không bắt buộc)', small: true),
            ),
          ]),
        ),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton(
          onPressed: () => setState(() => _rows.add(_Row())),
          style: TextButton.styleFrom(padding: EdgeInsets.zero, foregroundColor: AppColors.brand),
          child: const Text('+ Thêm người', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Row(children: [
          const Text('Phần của bạn', style: TextStyle(fontSize: 12, color: AppColors.slate400)),
          const Spacer(),
          Text('${formatMoney(mine)}đ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: mine < 0 ? AppColors.expense : AppColors.slate600)),
        ]),
      ),
      const SizedBox(height: 16),
      const Text('Nhận vào tài khoản', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black)),
      const SizedBox(height: 8),
      if (receivable.isEmpty)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(12)),
          child: const Text('Chưa có tài khoản nào lưu QR — vào Thẻ → Sửa thẻ → mục "Thông tin nhận tiền" để thêm.',
              style: TextStyle(fontSize: 12, color: Color(0xFFD97706))),
        )
      else
        SizedBox(
          height: 38,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: receivable.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (_, i) {
              final c = receivable[i];
              final sel = c.id == _receiveCardId;
              return GestureDetector(
                onTap: () => setState(() => _receiveCardId = c.id),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: sel ? AppColors.brandLight.withValues(alpha: 0.6) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: sel ? AppColors.brand : AppColors.slate200),
                  ),
                  child: Text('${c.bankName} •• ${c.cardNumber}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: sel ? AppColors.brand : AppColors.slate600)),
                ),
              );
            },
          ),
        ),
    ];
  }

  List<Widget> _ticket() {
    final t = widget.tx;
    final cat = categoryByLabel(t.category);
    final ps = _participants;
    final owed = ps.fold<num>(0, (s, p) => s + ((p['amount'] as num?) ?? 0));
    final collected = ps.where((p) => p['status'] == 'paid').fold<num>(0, (s, p) => s + ((p['amount'] as num?) ?? 0));
    final pct = owed > 0 ? (collected / owed).clamp(0.0, 1.0).toDouble() : 0.0;
    final allPaid = ps.isNotEmpty && ps.every((p) => p['status'] == 'paid');
    final anyPaid = ps.any((p) => p['status'] == 'paid');
    final recv = _recv;
    final qr = (recv['receiveQrImage'] ?? '').toString();
    final d = t.date;
    Widget avatar(int i, String name, double s) => Container(
          width: s,
          height: s,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: _avatarColors[i % _avatarColors.length], shape: BoxShape.circle),
          child: Text(_initials(name), style: TextStyle(fontSize: s * 0.32, fontWeight: FontWeight.w900, color: Colors.white)),
        );

    return [
      RepaintBoundary(
        key: _ticketKey,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: AppColors.slate200),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              CategoryTile(iconType: cat.iconType, color: cat.color, size: 40),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(999)),
                child: const Text('CHIA BILL', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppColors.brand, letterSpacing: 0.6)),
              ),
            ]),
            const SizedBox(height: 12),
            Text(t.category, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.slate900)),
            Text('${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} · ${_hm(d.toIso8601String())} · ${ps.length + 1} người',
                style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Tổng hoá đơn', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.slate400)),
                  Text('${formatMoney(t.amount)}đ', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppColors.slate900)),
                ]),
                const Spacer(),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  const Text('Phần của bạn', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.slate400)),
                  Text('${formatMoney(t.amount - owed)}đ', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: AppColors.slate700)),
                ]),
              ]),
            ),
            const SizedBox(height: 4),
            for (var i = 0; i < ps.length; i++) ...[
              if (i > 0) const Divider(height: 1, color: AppColors.slate100),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(children: [
                  avatar(i, '${ps[i]['name']}', 36),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${ps[i]['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate800)),
                      if ('${ps[i]['note'] ?? ''}'.isNotEmpty)
                        Text('${ps[i]['note']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                      if (ps[i]['status'] == 'paid')
                        Text('Đã chuyển · ${_hm(ps[i]['paidAt'])}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _emerald)),
                    ]),
                  ),
                  Text('${formatMoney((ps[i]['amount'] as num?) ?? 0)}đ', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppColors.slate900)),
                  const SizedBox(width: 8),
                  ps[i]['status'] == 'paid'
                      ? Container(width: 20, height: 20, decoration: const BoxDecoration(color: Color(0xFF34D399), shape: BoxShape.circle), child: const Icon(Icons.check, size: 12, color: Colors.white))
                      : Container(width: 20, height: 20, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: AppColors.slate200, width: 2))),
                ]),
              ),
            ],
            if (qr.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(qr, width: 80, height: 80, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox(width: 80, height: 80)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(width: 6, height: 6, decoration: const BoxDecoration(color: _emerald, shape: BoxShape.circle)),
                      const SizedBox(width: 4),
                      Flexible(child: Text('${recv['bankName'] ?? ''}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _emerald))),
                    ]),
                    Text(_groupAcc('${recv['receiveAccountNumber'] ?? ''}'),
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppColors.slate900, letterSpacing: 0.5)),
                    Text('${recv['cardHolder'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
                    const SizedBox(height: 2),
                    const Text('◈ Quét mã để chuyển khoản', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.brand)),
                  ]),
                ),
              ]),
            ],
          ]),
        ),
      ),
      // Perforated tear line
      Container(
        height: 14,
        decoration: const BoxDecoration(color: Colors.white, border: Border.symmetric(vertical: BorderSide(color: AppColors.slate200))),
        child: const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Center(child: _Dashes())),
      ),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(color: Color(0xFF15122A), borderRadius: BorderRadius.vertical(bottom: Radius.circular(24))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('Tiến độ thu tiền', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.7))),
            const Spacer(),
            Text.rich(TextSpan(style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.7)), children: [
              TextSpan(text: '${formatMoney(collected)}đ', style: const TextStyle(color: Color(0xFF34D399))),
              TextSpan(text: ' / ${formatMoney(owed)}đ'),
            ])),
          ]),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(value: pct, minHeight: 8, backgroundColor: Colors.white.withValues(alpha: 0.1), color: const Color(0xFF34D399)),
          ),
          const SizedBox(height: 14),
          Text('XÁC NHẬN ĐÃ NHẬN TIỀN', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white.withValues(alpha: 0.4), letterSpacing: 0.6)),
          const SizedBox(height: 8),
          for (var i = 0; i < ps.length; i++)
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(12)),
              child: Row(children: [
                avatar(i, '${ps[i]['name']}', 32),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${ps[i]['name']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                    Text('${formatMoney((ps[i]['amount'] as num?) ?? 0)}đ${ps[i]['status'] == 'paid' ? ' · lúc ${_hm(ps[i]['paidAt'])}' : ''}',
                        style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.4))),
                  ]),
                ),
                ps[i]['status'] == 'paid'
                    ? GestureDetector(
                        onTap: () => _mark(ps[i], false),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(color: const Color(0xFF34D399).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(999)),
                          child: const Row(mainAxisSize: MainAxisSize.min, children: [
                            Text('Đã nhận', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF34D399))),
                          ]),
                        ),
                      )
                    : GestureDetector(
                        onTap: () => _mark(ps[i], true),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(color: AppColors.brand, borderRadius: BorderRadius.circular(999)),
                          child: const Text('Đánh dấu đã nhận', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
                        ),
                      ),
              ]),
            ),
          const SizedBox(height: 4),
          GestureDetector(
            onTap: _exporting ? null : _exportImage,
            child: Container(
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(gradient: const LinearGradient(colors: [AppColors.brand, _gradEnd]), borderRadius: BorderRadius.circular(12)),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (_exporting) ...[
                  const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
                  const SizedBox(width: 8),
                ],
                const Text('Lưu ảnh để gửi nhóm', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
              ]),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(
          child: Opacity(
            opacity: allPaid ? 0.4 : 1,
            child: OutlinedButton(
              onPressed: allPaid ? null : () => setState(() => _editing = true),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 40),
                side: const BorderSide(color: AppColors.slate200),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Sửa hoá đơn', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.slate600)),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Opacity(
            opacity: anyPaid ? 0.4 : 1,
            child: OutlinedButton(
              onPressed: anyPaid ? null : _delete,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 40),
                side: const BorderSide(color: Color(0xFFFECACA)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Xoá bản chia', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.expense)),
            ),
          ),
        ),
      ]),
    ];
  }
}

class _Dashes extends StatelessWidget {
  const _Dashes();
  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (_, c) {
        final n = (c.maxWidth / 9).floor();
        return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          for (var i = 0; i < n; i++) Container(width: 5, height: 2, color: AppColors.slate200),
        ]);
      });
}

class _Thousands extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return const TextEditingValue(text: '');
    final out = formatMoney(int.parse(digits));
    return TextEditingValue(text: out, selection: TextSelection.collapsed(offset: out.length));
  }
}
