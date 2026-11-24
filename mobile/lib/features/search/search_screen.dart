import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/prefs.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/transaction_row.dart';
import '../transactions/transaction_detail_sheet.dart';

/// "Tìm kiếm" — port of client/app/(app)/search/page.tsx: features + transactions
/// by note / category / amount digits, with recent searches kept on-device.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  static const _recentKey = 'recentTransactionSearches';
  static const _maxRecent = 8;
  static const _features = [
    (label: 'Thẻ & Tài khoản', route: '/accounts', icon: '💳'),
    (label: 'Lịch sao kê', route: '/statements', icon: '🗓️'),
    (label: 'Hoàn tiền', route: '/cashback', icon: '🪙'),
    (label: 'Tiết kiệm', route: '/savings', icon: '🐷'),
    (label: 'Trả góp', route: '/installments', icon: '📆'),
    (label: 'Hạn thẻ', route: '/cards/expiry', icon: '⏳'),
    (label: 'Giao dịch tự động', route: '/auto-actions', icon: '🔁'),
  ];

  final _ctrl = TextEditingController();
  List<String> _recent = const [];

  @override
  void initState() {
    super.initState();
    Prefs.list(_recentKey).then((v) => mounted ? setState(() => _recent = v) : null);
    _ctrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _remember(String term) {
    final t = term.trim();
    if (t.isEmpty) return;
    final next = [t, ..._recent.where((s) => s.toLowerCase() != t.toLowerCase())].take(_maxRecent).toList();
    setState(() => _recent = next);
    Prefs.setList(_recentKey, next);
  }

  void _forget(String term) {
    final next = _recent.where((s) => s != term).toList();
    setState(() => _recent = next);
    Prefs.setList(_recentKey, next);
  }

  @override
  Widget build(BuildContext context) {
    final q = _ctrl.text.trim().toLowerCase();
    final txs = ref.watch(transactionsProvider).valueOrNull ?? const <TransactionModel>[];
    final digits = q.replaceAll(RegExp(r'\D'), '');
    final features = q.isEmpty ? const [] : _features.where((f) => f.label.toLowerCase().contains(q)).toList();
    final results = q.isEmpty
        ? const <TransactionModel>[]
        : (txs.where((t) =>
                t.note.toLowerCase().contains(q) ||
                t.category.toLowerCase().contains(q) ||
                (digits.isNotEmpty && t.amount.round().toString().contains(digits))).toList()
              ..sort((a, b) => b.date.compareTo(a.date)))
            .take(50)
            .toList();

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(),
        title: const PageTitle('Tìm kiếm'),
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
        TextField(
          controller: _ctrl,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onSubmitted: _remember,
          decoration: InputDecoration(
            hintText: 'Tìm tính năng, giao dịch...',
            prefixIcon: const Icon(Icons.search, size: 20, color: AppColors.slate400),
            suffixIcon: _ctrl.text.isEmpty
                ? null
                : IconButton(icon: const Icon(Icons.close, size: 18, color: AppColors.slate400), onPressed: _ctrl.clear),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.slate100)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.slate100)),
          ),
        ),
        const SizedBox(height: 16),
        if (q.isEmpty) ...[
          if (_recent.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 8),
              child: Text('TÌM KIẾM GẦN ĐÂY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate400, letterSpacing: 0.5)),
            ),
            Container(
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.slate100)),
              child: Column(children: [
                for (final term in _recent)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.history, size: 18, color: AppColors.slate400),
                    title: Text(term, style: const TextStyle(fontSize: 14, color: AppColors.slate700)),
                    trailing: IconButton(icon: const Icon(Icons.close, size: 16, color: AppColors.slate200), onPressed: () => _forget(term)),
                    onTap: () {
                      _ctrl.text = term;
                      _ctrl.selection = TextSelection.collapsed(offset: term.length);
                    },
                  ),
              ]),
            ),
          ] else
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 60),
              child: Column(children: [
                Icon(Icons.search, size: 44, color: Color(0xFFE2E8F0)),
                SizedBox(height: 8),
                Text('Tìm theo ghi chú, danh mục hoặc số tiền', style: TextStyle(color: AppColors.slate400, fontSize: 13)),
              ]),
            ),
        ] else ...[
          if (features.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.only(left: 4, bottom: 8),
              child: Text('TÍNH NĂNG', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate400, letterSpacing: 0.5)),
            ),
            for (final f in features)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.slate100)),
                child: ListTile(
                  leading: Text(f.icon, style: const TextStyle(fontSize: 20)),
                  title: Text(f.label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.slate800)),
                  trailing: const Icon(Icons.chevron_right, color: AppColors.slate400),
                  onTap: () {
                    _remember(f.label);
                    context.push(f.route);
                  },
                ),
              ),
            const SizedBox(height: 8),
          ],
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text('GIAO DỊCH (${results.length}${results.length == 50 ? '+' : ''})',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate400, letterSpacing: 0.5)),
          ),
          if (results.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: Text('Không tìm thấy giao dịch phù hợp', style: TextStyle(color: AppColors.slate400, fontSize: 13))),
            )
          else
            Container(
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.slate100)),
              child: Column(children: [
                for (final (i, t) in results.indexed) ...[
                  if (i > 0) const Divider(height: 1, color: AppColors.slate100, indent: 62),
                  TransactionRow(
                    tx: t,
                    source: '${t.date.day.toString().padLeft(2, '0')}/${t.date.month.toString().padLeft(2, '0')}/${t.date.year}',
                    onTap: () {
                      _remember(_ctrl.text);
                      showTransactionDetailSheet(context, t);
                    },
                  ),
                ],
              ]),
            ),
        ],
      ]),
    );
  }
}
