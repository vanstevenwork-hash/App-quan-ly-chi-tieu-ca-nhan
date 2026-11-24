import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/prefs.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import 'mailbox_screen.dart' show ReadFilter;

/// "Voucher Traveloka" — port of client/app/(app)/mailbox/traveloka: every
/// Traveloka gift-voucher mail (unread by default) with each code + value one
/// tap from the clipboard, denomination filter, copied-code marks, mark read.
class TravelokaScreen extends ConsumerStatefulWidget {
  const TravelokaScreen({super.key});
  @override
  ConsumerState<TravelokaScreen> createState() => _TravelokaScreenState();
}

class _TravelokaScreenState extends ConsumerState<TravelokaScreen> {
  static const _copiedKey = 'traveloka-copied-codes';
  String _status = 'unread';
  num? _amount;
  List<Map<String, dynamic>> _emails = const [];
  bool _loading = true;
  String? _error;
  Set<String> _copied = {};

  @override
  void initState() {
    super.initState();
    Prefs.list(_copiedKey).then((v) => mounted ? setState(() => _copied = v.toSet()) : null);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await ref.read(financeServiceProvider).travelokaVouchers(_status);
      if (mounted) setState(() => _emails = list);
    } catch (e) {
      if (mounted) setState(() => _error = 'Không tải được thư Traveloka');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _vouchers(Map<String, dynamic> e) =>
      (e['vouchers'] as List? ?? const []).whereType<Map>().map((v) => Map<String, dynamic>.from(v)).toList();

  void _markCopied(Iterable<String> codes) {
    setState(() => _copied = {..._copied, ...codes});
    final list = _copied.toList();
    Prefs.setList(_copiedKey, list.length > 2000 ? list.sublist(list.length - 2000) : list);
  }

  Future<void> _copy(List<Map<String, dynamic>> vs, String what) async {
    if (vs.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: vs.map((v) => v['code']).join('\n')));
    _markCopied(vs.map((v) => v['code'].toString()));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          duration: const Duration(milliseconds: 1500),
          content: Text(vs.length == 1 ? 'Đã copy mã ${_money(vs.first)}' : 'Đã copy ${vs.length} mã $what')));
    }
  }

  Future<void> _setSeen(List<int> uids, bool seen) async {
    try {
      await ref.read(financeServiceProvider).mailboxFlags('all', uids, seen: seen);
      setState(() {
        final leaves = (_status == 'unread' && seen) || (_status == 'read' && !seen);
        _emails = leaves
            ? _emails.where((e) => !uids.contains(e['uid'])).toList()
            : [for (final e in _emails) uids.contains(e['uid']) ? {...e, 'seen': seen} : e];
      });
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Thao tác thất bại')));
    }
  }

  static String _money(Map<String, dynamic> v) {
    final a = (v['amount'] as num?) ?? 0;
    final cur = (v['currency'] ?? 'VND').toString();
    return a == 0 ? '—' : '${formatMoney(a)}${cur == 'VND' ? 'đ' : ' $cur'}';
  }

  static String _day(String? s) {
    final d = DateTime.tryParse(s ?? '')?.toLocal();
    return d == null ? '' : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    // Denominations + filter
    final counts = <num, int>{};
    for (final e in _emails) {
      for (final v in _vouchers(e)) {
        final a = (v['amount'] as num?) ?? 0;
        counts[a] = (counts[a] ?? 0) + 1;
      }
    }
    final denoms = counts.keys.toList()..sort((a, b) => b.compareTo(a));
    final visible = [
      for (final e in _emails)
        (e: e, vs: _vouchers(e).where((v) => _amount == null || v['amount'] == _amount).toList()),
    ].where((x) => x.vs.isNotEmpty).toList();
    final allVs = [for (final x in visible) ...x.vs];
    final total = allVs.fold<num>(0, (s, v) => s + ((v['amount'] as num?) ?? 0));
    final notCopied = allVs.where((v) => !_copied.contains(v['code'])).toList();
    final unreadVs = [for (final x in visible.where((x) => x.e['seen'] != true)) ...x.vs];
    final unreadUids = [for (final x in visible.where((x) => x.e['seen'] != true)) x.e['uid'] as int];

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(),
        title: PageTitle('Voucher Traveloka', subtitle: _status == 'unread' ? 'Thư chưa đọc' : _status == 'read' ? 'Thư đã đọc' : 'Tất cả thư'),
        actions: [IconButton(onPressed: _loading ? null : _load, icon: const Icon(Icons.refresh, color: AppColors.slate700))],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), boxShadow: kCardShadow),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${allVs.length} mã · ${visible.length} thư${_amount != null ? ' · mệnh giá ${formatMoney(_amount!)}đ' : ''}',
                  style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
              Text('${formatMoney(total)}đ', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              const SizedBox(height: 10),
              Row(children: [
                if (_status != 'read') ...[
                  Expanded(child: _btn('Copy tất cả ${unreadVs.length} mã chưa đọc', true, unreadVs.isEmpty ? null : () => _copy(unreadVs, 'từ thư chưa đọc'))),
                  const SizedBox(width: 8),
                ],
                Expanded(child: _btn('Copy ${notCopied.length} mã chưa copy', _status == 'read', notCopied.isEmpty ? null : () => _copy(notCopied, 'chưa copy'))),
              ]),
              const SizedBox(height: 10),
              ReadFilter(value: _status, onChanged: (v) {
                setState(() {
                  _status = v;
                  _amount = null;
                });
                _load();
              }),
            ]),
          ),
          if (denoms.length > 1) ...[
            const SizedBox(height: 12),
            SizedBox(
              height: 34,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                _chip('Tất cả', _amount == null, () => setState(() => _amount = null)),
                for (final a in denoms) _chip('${a == 0 ? 'Không rõ' : '${formatMoney(a)}đ'} ×${counts[a]}', _amount == a, () => setState(() => _amount = a)),
              ]),
            ),
          ],
          const SizedBox(height: 12),
          if (_loading && _emails.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: Text('Đang đọc thư Traveloka…', style: TextStyle(color: AppColors.slate400)))),
          if (!_loading && _error != null)
            Padding(padding: const EdgeInsets.symmetric(vertical: 40), child: Center(child: Text(_error!, style: const TextStyle(color: AppColors.expense)))),
          if (!_loading && _error == null && visible.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: Text(_status == 'unread' ? 'Không còn thư voucher Traveloka nào chưa đọc 🎉' : 'Không có thư voucher Traveloka',
                    style: const TextStyle(color: AppColors.slate400)),
              ),
            ),
          for (final x in visible) _emailCard(x.e, x.vs),
          if (_status != 'read' && unreadUids.isNotEmpty)
            OutlinedButton(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    content: Text('Đánh dấu đã đọc ${unreadUids.length} thư chưa đọc đang hiển thị?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
                      TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Đồng ý')),
                    ],
                  ),
                );
                if (ok == true) _setSeen(unreadUids, true);
              },
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 46)),
              child: Text('Đánh dấu đã đọc tất cả (${unreadUids.length} thư)'),
            ),
        ]),
      ),
    );
  }

  Widget _btn(String t, bool primary, VoidCallback? onTap) => GestureDetector(
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.4 : 1,
          child: Container(
            height: 40,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(color: primary ? AppColors.brand : AppColors.brand.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
            child: Text(t, textAlign: TextAlign.center, maxLines: 2, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: primary ? Colors.white : AppColors.brand)),
          ),
        ),
      );

  Widget _chip(String t, bool active, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? AppColors.brand : Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: active ? AppColors.brand : AppColors.slate200),
            ),
            child: Text(t, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: active ? Colors.white : AppColors.slate700)),
          ),
        ),
      );

  Widget _emailCard(Map<String, dynamic> e, List<Map<String, dynamic>> vs) {
    final seen = e['seen'] == true;
    final exp = DateTime.tryParse((e['expiresAt'] ?? '').toString());
    final left = exp?.difference(DateTime.now()).inDays;
    final sender = (e['sender'] ?? '').toString();
    return Opacity(
      opacity: seen ? 0.7 : 1,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 10, 6),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    if (!seen) Container(width: 7, height: 7, margin: const EdgeInsets.only(right: 6), decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle)),
                    Flexible(child: Text('${sender.isNotEmpty ? 'Từ $sender' : 'Traveloka'} · ${_day(e['date']?.toString())}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.slate800))),
                  ]),
                  if (exp != null)
                    Text('HSD ${_day(e['expiresAt'].toString())}${left != null && left <= 30 ? ' · còn ${left < 0 ? 0 : left} ngày' : ''}',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: left != null && left <= 30 ? AppColors.expense : AppColors.slate400)),
                ]),
              ),
              if (vs.length > 1)
                _smallBtn('Copy ${vs.length} mã', AppColors.brand, AppColors.brand.withValues(alpha: 0.1), () => _copy(vs, 'trong thư')),
              const SizedBox(width: 6),
              _smallBtn(seen ? 'Chưa đọc' : 'Đã đọc', AppColors.slate500, AppColors.slate100, () => _setSeen([e['uid'] as int], !seen)),
            ]),
          ),
          for (final v in vs)
            InkWell(
              onTap: () => _copy([v], ''),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.slate100))),
                child: Row(children: [
                  SizedBox(width: 92, child: Text(_money(v), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800))),
                  Expanded(
                    child: Text(v['code'].toString(), maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: 'Menlo', fontSize: 12.5, letterSpacing: 0.5,
                          color: _copied.contains(v['code']) ? AppColors.slate400 : AppColors.slate800,
                          decoration: _copied.contains(v['code']) ? TextDecoration.lineThrough : null,
                        )),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _copied.contains(v['code']) ? const Color(0xFFECFDF5) : AppColors.brand,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_copied.contains(v['code']) ? 'Đã copy' : 'Copy',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: _copied.contains(v['code']) ? AppColors.income : Colors.white)),
                  ),
                ]),
              ),
            ),
        ]),
      ),
    );
  }

  Widget _smallBtn(String t, Color fg, Color bg, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
          child: Text(t, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg)),
        ),
      );
}
