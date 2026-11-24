import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../state/auth_provider.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';

/// Settings actions — ports of the handlers in client/app/(app)/settings/page.tsx.

final telegramStatusProvider = FutureProvider.autoDispose((ref) => ref.read(financeServiceProvider).telegramStatus());

void _toast(BuildContext context, String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
String _errMsg(Object e, String fallback) {
  if (e is DioException && e.response?.data is Map) {
    final m = (e.response!.data['message'] ?? '').toString();
    if (m.isNotEmpty) return m;
  }
  return fallback;
}

/// Đổi tên hiển thị.
Future<void> editName(BuildContext context, WidgetRef ref) async {
  final ctrl = TextEditingController(text: ref.read(authProvider).user?.name ?? '');
  final name = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Tên hiển thị'),
      content: TextField(controller: ctrl, autofocus: true, textCapitalization: TextCapitalization.words),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Huỷ')),
        TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('Lưu')),
      ],
    ),
  );
  ctrl.dispose();
  if (name == null) return;
  if (name.isEmpty) return context.mounted ? _toast(context, 'Tên không được để trống') : null;
  try {
    await ref.read(financeServiceProvider).updateProfile({'name': name});
    await ref.read(authProvider.notifier).reloadUser();
    if (context.mounted) _toast(context, 'Đã đổi tên hiển thị');
  } catch (_) {
    if (context.mounted) _toast(context, 'Đổi tên thất bại');
  }
}

/// Đổi email: nhập email mới → mã 6 số gửi về email đó → xác nhận.
Future<void> changeEmail(BuildContext context, WidgetRef ref) => showModalBottomSheet<void>(useRootNavigator: true, 
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => const _ChangeEmailSheet(),
    );

class _ChangeEmailSheet extends ConsumerStatefulWidget {
  const _ChangeEmailSheet();
  @override
  ConsumerState<_ChangeEmailSheet> createState() => _ChangeEmailSheetState();
}

class _ChangeEmailSheetState extends ConsumerState<_ChangeEmailSheet> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  String? _pending;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _request() async {
    final e = _email.text.trim().toLowerCase();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(e)) return _toast(context, 'Email không hợp lệ');
    setState(() => _busy = true);
    try {
      await ref.read(financeServiceProvider).requestEmailChange(e);
      setState(() => _pending = e);
      if (mounted) _toast(context, 'Đã gửi mã xác nhận tới $e');
    } catch (err) {
      if (mounted) _toast(context, _errMsg(err, 'Không gửi được mã'));
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _confirm() async {
    if (_code.text.trim().length < 6) return _toast(context, 'Nhập đủ mã 6 số');
    setState(() => _busy = true);
    try {
      await ref.read(financeServiceProvider).confirmEmailChange(_code.text.trim());
      await ref.read(authProvider.notifier).reloadUser();
      if (mounted) {
        Navigator.of(context).pop();
        _toast(context, 'Đã đổi email thành công');
      }
    } catch (err) {
      if (mounted) {
        _toast(context, _errMsg(err, 'Xác nhận thất bại'));
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Đổi email', style: AppText.sheetTitle),
        const SizedBox(height: 6),
        Text(_pending == null ? 'Nhập email mới — app gửi mã 6 số để xác nhận.' : 'Nhập mã 6 số vừa gửi tới $_pending',
            style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
        const SizedBox(height: 12),
        if (_pending == null)
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: const InputDecoration(hintText: 'Email mới'))
        else
          TextField(controller: _code, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(hintText: 'Mã xác nhận', counterText: '')),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.brand),
            onPressed: _busy ? null : (_pending == null ? _request : _confirm),
            child: Text(_busy ? '…' : _pending == null ? 'Gửi mã' : 'Xác nhận', style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
        ),
      ]),
    );
  }
}

/// Kết nối / ngắt Telegram bot.
Future<void> toggleTelegram(BuildContext context, WidgetRef ref, bool connected) async {
  final svc = ref.read(financeServiceProvider);
  if (connected) {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: const Text('Ngắt kết nối Telegram? Bạn sẽ không ghi chi tiêu qua bot được nữa.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Ngắt', style: TextStyle(color: AppColors.expense))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await svc.telegramUnlink();
      ref.invalidate(telegramStatusProvider);
      if (context.mounted) _toast(context, 'Đã ngắt kết nối Telegram');
    } catch (_) {
      if (context.mounted) _toast(context, 'Ngắt kết nối thất bại');
    }
    return;
  }
  try {
    final r = await svc.telegramLink();
    if (r.connected) {
      ref.invalidate(telegramStatusProvider);
      return;
    }
    if (r.url == null) {
      if (context.mounted) _toast(context, 'Server chưa cấu hình bot Telegram');
      return;
    }
    await launchUrl(Uri.parse(r.url!), mode: LaunchMode.externalApplication);
    if (context.mounted) _toast(context, 'Mở Telegram và bấm "Bắt đầu" để liên kết');
    // Re-check shortly after so the row flips to "Đã kết nối".
    Future.delayed(const Duration(seconds: 8), () => ref.invalidate(telegramStatusProvider));
  } catch (_) {
    if (context.mounted) _toast(context, 'Không lấy được liên kết Telegram');
  }
}

/// Xuất CSV giao dịch (same columns as the web, BOM for Excel) → share sheet.
Future<void> exportCsv(BuildContext context, WidgetRef ref) async {
  final txs = await ref.read(transactionsProvider.future);
  if (txs.isEmpty) {
    if (context.mounted) _toast(context, 'Chưa có giao dịch nào để xuất');
    return;
  }
  String q(String s) => '"${s.replaceAll('"', '""')}"';
  final rows = [
    'Ngày,Loại,Danh mục,Số tiền,Phương thức,Ghi chú',
    for (final t in txs)
      [
        '${t.date.day.toString().padLeft(2, '0')}/${t.date.month.toString().padLeft(2, '0')}/${t.date.year}',
        t.isIncome ? 'Thu nhập' : 'Chi tiêu',
        q(t.category),
        t.amount,
        t.paymentMethod,
        q(t.note),
      ].join(','),
  ];
  final dir = await getTemporaryDirectory();
  final now = DateTime.now();
  final file = File('${dir.path}/chi-tieu-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}.csv');
  await file.writeAsString('﻿${rows.join('\n')}');
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: 'text/csv')], subject: 'Giao dịch chi tiêu'));
}

/// Đồng bộ email: scan the bank inbox with live progress, preview the found
/// transactions, then only create the ones the user keeps.
Future<void> syncBankEmails(BuildContext context, WidgetRef ref) async {
  final progress = ValueNotifier<int?>(null);
  final svc = ref.read(financeServiceProvider);
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => AlertDialog(
      content: ValueListenableBuilder<int?>(
        valueListenable: progress,
        builder: (_, p, _) => Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 6),
          CircularProgressIndicator(value: p == null ? null : p / 100),
          const SizedBox(height: 14),
          Text(p == null ? 'Đang kết nối hộp thư…' : 'Đang quét email… $p%'),
        ]),
      ),
    ),
  );
  try {
    final r = await svc.scanBankEmails(7, (done, total) => progress.value = total > 0 ? (done * 100 ~/ total) : 100);
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
    if (!context.mounted) return;
    if (r.items.isEmpty) {
      _toast(context, r.statements > 0 ? 'Đã cập nhật ${r.statements} sao kê từ email' : 'Không có giao dịch mới trong email');
      return;
    }
    await showModalBottomSheet<void>(useRootNavigator: true, 
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _ImportReview(items: r.items),
    );
  } catch (e) {
    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop();
      _toast(context, e.toString().replaceFirst('Exception: ', ''));
    }
  } finally {
    progress.dispose();
  }
}

class _ImportReview extends ConsumerStatefulWidget {
  final List<Map<String, dynamic>> items;
  const _ImportReview({required this.items});
  @override
  ConsumerState<_ImportReview> createState() => _ImportReviewState();
}

class _ImportReviewState extends ConsumerState<_ImportReview> {
  late List<Map<String, dynamic>> _items = [...widget.items];
  bool _busy = false;

  Future<void> _commit() async {
    if (_items.isEmpty) return Navigator.of(context).pop();
    setState(() => _busy = true);
    try {
      final r = await ref.read(financeServiceProvider).commitEmailItems(_items);
      refreshFinance(ref);
      ref.invalidate(notificationsProvider);
      if (mounted) {
        Navigator.of(context).pop();
        _toast(context, 'Đã thêm ${r.created} giao dịch${r.skipped > 0 ? ' · bỏ ${r.skipped} trùng' : ''}');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        _toast(context, _errMsg(e, 'Thêm giao dịch thất bại'));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 18, 20, 4),
            child: Text('Xem trước giao dịch từ email', style: AppText.sheetTitle),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text('Chưa có gì được lưu. Bỏ những dòng không đúng rồi bấm Thêm.', style: TextStyle(fontSize: 12, color: AppColors.slate500)),
          ),
          Flexible(
            child: ListView(shrinkWrap: true, padding: const EdgeInsets.fromLTRB(20, 10, 20, 10), children: [
              for (final t in _items)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
                  decoration: BoxDecoration(
                    color: t['maybeDuplicate'] == true ? const Color(0xFFFFFBEB) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text((t['note'] ?? t['category'] ?? '').toString(), maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                        Text('${t['category'] ?? ''}${(t['source'] ?? '').toString().isNotEmpty ? ' · ${t['source']}' : ''}${t['maybeDuplicate'] == true ? ' · có thể trùng' : ''}',
                            style: TextStyle(fontSize: 11, color: t['maybeDuplicate'] == true ? const Color(0xFFD97706) : AppColors.slate400)),
                      ]),
                    ),
                    Text('${t['type'] == 'income' ? '+' : '-'}${formatMoney((t['amount'] as num?) ?? 0)}đ',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: t['type'] == 'income' ? AppColors.income : AppColors.expense)),
                    IconButton(
                      tooltip: 'Loại bỏ giao dịch này',
                      onPressed: () => setState(() => _items = _items.where((x) => x['sourceEmailId'] != t['sourceEmailId']).toList()),
                      icon: const Icon(Icons.close, size: 18, color: AppColors.slate400),
                    ),
                  ]),
                ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.brand),
                onPressed: _busy ? null : _commit,
                child: Text(_busy ? 'Đang thêm…' : 'Thêm ${_items.length} giao dịch', style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
