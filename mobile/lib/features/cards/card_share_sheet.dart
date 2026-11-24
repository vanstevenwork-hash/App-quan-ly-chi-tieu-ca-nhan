import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/card_share.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';

/// "Chia sẻ thẻ" — port of the web CardShareModal: invite by email (with a
/// live "does this account exist?" check), list who the card is shared with,
/// revoke access.
Future<void> showCardShareSheet(BuildContext context, {required String cardId, required String cardName}) =>
    showModalBottomSheet<void>(useRootNavigator: true, 
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _ShareSheet(cardId: cardId, cardName: cardName),
    );

final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

class _ShareSheet extends ConsumerStatefulWidget {
  final String cardId, cardName;
  const _ShareSheet({required this.cardId, required this.cardName});
  @override
  ConsumerState<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends ConsumerState<_ShareSheet> {
  final _email = TextEditingController();
  List<CardShareEntry> _shares = const [];
  bool _loading = true, _sending = false;
  ({bool loading, bool? exists, String name})? _check;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _fetch();
    _email.addListener(_onEmail);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _email.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    try {
      final list = await ref.read(financeServiceProvider).getCardShares(widget.cardId);
      if (mounted) setState(() => _shares = list.where((s) => s.status != 'revoked' && s.status != 'declined').toList());
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _onEmail() {
    final addr = _email.text.trim().toLowerCase();
    _debounce?.cancel();
    if (!_emailRe.hasMatch(addr)) {
      if (_check != null) setState(() => _check = null);
      return;
    }
    setState(() => _check = (loading: true, exists: null, name: ''));
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      try {
        final r = await ref.read(financeServiceProvider).checkEmail(addr);
        if (mounted && _email.text.trim().toLowerCase() == addr) setState(() => _check = (loading: false, exists: r.exists, name: r.name));
      } catch (_) {
        if (mounted) setState(() => _check = (loading: false, exists: null, name: ''));
      }
    });
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _invite() async {
    final addr = _email.text.trim().toLowerCase();
    if (!_emailRe.hasMatch(addr)) return _toast('Email không hợp lệ');
    if (_check?.exists == false) return _toast('Email này chưa có tài khoản trong app');
    setState(() => _sending = true);
    try {
      await ref.read(financeServiceProvider).inviteShare(widget.cardId, addr);
      _email.clear();
      _toast('Đã gửi lời mời!');
      await _fetch();
    } on DioException catch (e) {
      final msg = e.response?.data is Map ? (e.response!.data['message'] ?? '').toString() : '';
      _toast(msg.isNotEmpty ? msg : 'Không thể gửi lời mời');
    } catch (_) {
      _toast('Không thể gửi lời mời');
    }
    if (mounted) setState(() => _sending = false);
  }

  Future<void> _revoke(CardShareEntry s) async {
    try {
      await ref.read(financeServiceProvider).revokeShare(s.id);
      setState(() => _shares = _shares.where((x) => x.id != s.id).toList());
      _toast('Đã thu hồi quyền chia sẻ');
    } catch (_) {
      _toast('Không thể thu hồi');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _check;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Center(child: Container(width: 44, height: 5, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3)))),
        const SizedBox(height: 12),
        const Text('🤝 Chia sẻ thẻ', style: AppText.sheetTitle),
        Text(widget.cardName, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
        const SizedBox(height: 6),
        const Text('Người được mời sẽ ghi chi tiêu vào thẻ này; dư nợ, hạn mức và hoàn tiền được tính chung.',
            style: TextStyle(fontSize: 12, color: AppColors.slate500, height: 1.4)),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(
            child: TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: InputDecoration(
                hintText: 'Email người được mời',
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: _sending || c?.exists == false ? null : _invite,
            style: FilledButton.styleFrom(backgroundColor: AppColors.brand, minimumSize: const Size(0, 48)),
            child: Text(_sending ? '…' : 'Mời'),
          ),
        ]),
        if (c != null)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Text(
              c.loading
                  ? 'Đang kiểm tra…'
                  : c.exists == true
                      ? '✓ ${c.name.isNotEmpty ? c.name : 'Tài khoản'} có trong app'
                      : c.exists == false
                          ? '✗ Email này chưa có tài khoản trong app'
                          : '',
              style: TextStyle(fontSize: 12, color: c.exists == false ? AppColors.expense : c.exists == true ? AppColors.income : AppColors.slate400),
            ),
          ),
        const SizedBox(height: 16),
        const Text('Đang chia sẻ với', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
        const SizedBox(height: 6),
        if (_loading) const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator())),
        if (!_loading && _shares.isEmpty) const Text('Chưa chia sẻ với ai', style: TextStyle(fontSize: 12, color: AppColors.slate400)),
        for (final s in _shares)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
            child: Row(children: [
              CircleAvatar(radius: 16, backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                  child: Text((s.name.isNotEmpty ? s.name : s.email).substring(0, 1).toUpperCase(), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary))),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(s.name.isNotEmpty ? s.name : s.email, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate800)),
                  Text(s.status == 'accepted' ? 'Đã tham gia' : 'Đang chờ chấp nhận',
                      style: TextStyle(fontSize: 11, color: s.status == 'accepted' ? AppColors.income : AppColors.gold)),
                ]),
              ),
              TextButton(onPressed: () => _revoke(s), child: const Text('Thu hồi', style: TextStyle(color: AppColors.expense, fontSize: 12))),
            ]),
          ),
      ]),
    );
  }
}
