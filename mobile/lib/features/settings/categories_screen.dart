import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../constants/categories.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';
import '../../widgets/common.dart';

/// "Danh mục" — port of client/app/(app)/settings/categories: built-in
/// categories (read-only) + the user's own, add / delete.
class CategoriesScreen extends ConsumerStatefulWidget {
  const CategoriesScreen({super.key});
  @override
  ConsumerState<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends ConsumerState<CategoriesScreen> {
  bool _income = false;
  List<Map<String, dynamic>> _raw = const [];
  bool _loading = true;

  static const _colors = ['#F59E0B', '#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F97316', '#EF4444', '#06B6D4', '#6C63FF', '#6B7280'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(financeServiceProvider).getCustomCategories();
      _apply(list);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _apply(List<Map<String, dynamic>> list) {
    setCustomCategories(list);
    if (mounted) setState(() => _raw = list);
  }

  Future<void> _delete(Map<String, dynamic> c) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text('Xóa danh mục "${c['label']}"? Giao dịch cũ vẫn giữ tên này.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Xoá', style: TextStyle(color: AppColors.expense))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      _apply(await ref.read(financeServiceProvider).deleteCustomCategory(c['_id'].toString()));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Xóa thất bại')));
    }
  }

  Future<void> _add() async {
    final name = TextEditingController();
    var icon = 'muaSam';
    var color = _colors.first;
    final result = await showModalBottomSheet<Map<String, dynamic>>(useRootNavigator: true, 
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => Padding(
          padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.viewInsetsOf(ctx).bottom + 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Thêm danh mục ${_income ? 'thu nhập' : 'chi tiêu'}', style: AppText.sheetTitle),
            const SizedBox(height: 12),
            TextField(controller: name, autofocus: true, decoration: const InputDecoration(hintText: 'Tên (vd: Shopee, Lazada)', isDense: true)),
            const SizedBox(height: 14),
            const Text('Biểu tượng', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final t in kIconTypes)
                GestureDetector(
                  onTap: () => setS(() => icon = t),
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: icon == t ? AppColors.brand : Colors.transparent, width: 2)),
                    child: CategoryTile(iconType: t, color: hexColor(color), size: 38),
                  ),
                ),
            ]),
            const SizedBox(height: 14),
            const Text('Màu', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
            const SizedBox(height: 8),
            Wrap(spacing: 10, children: [
              for (final c in _colors)
                GestureDetector(
                  onTap: () => setS(() => color = c),
                  child: Container(
                    width: 30, height: 30,
                    decoration: BoxDecoration(color: hexColor(c), shape: BoxShape.circle, border: color == c ? Border.all(color: AppColors.slate800, width: 2.5) : null),
                  ),
                ),
            ]),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: AppColors.brand),
                onPressed: () {
                  if (name.text.trim().isEmpty) return;
                  Navigator.pop(ctx, {'label': name.text.trim(), 'catIconType': icon, 'color': color, 'type': _income ? 'income' : 'expense'});
                },
                child: const Text('Thêm', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ]),
        ),
      ),
    );
    name.dispose();
    if (result == null) return;
    try {
      _apply(await ref.read(financeServiceProvider).createCustomCategory(result));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Thêm thất bại')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final builtIn = kCategories.where((c) => c.isIncome == _income).toList();
    final own = _raw.where((c) => (c['type'] == 'income') == _income).toList();
    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(fallback: '/settings'),
        title: const PageTitle('Danh mục', subtitle: 'Cài đặt'),
        actions: [IconButton(onPressed: _add, icon: const Icon(Icons.add_circle_outline, color: AppColors.brand))],
      ),
      body: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            for (final (inc, label) in const [(false, 'Chi tiêu'), (true, 'Thu nhập')])
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _income = inc),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: _income == inc ? AppColors.brand : Colors.transparent, borderRadius: BorderRadius.circular(9)),
                    child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _income == inc ? Colors.white : AppColors.slate500)),
                  ),
                ),
              ),
          ]),
        ),
        const SizedBox(height: 16),
        Row(children: [
          const Expanded(child: Text('Danh mục của bạn', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800))),
          TextButton.icon(onPressed: _add, icon: const Icon(Icons.add, size: 18), label: const Text('Thêm')),
        ]),
        if (_loading) const LoadingBox(height: 60),
        if (!_loading && own.isEmpty)
          const Padding(padding: EdgeInsets.all(12), child: Text('Chưa có danh mục riêng', style: TextStyle(fontSize: 12, color: AppColors.slate400))),
        for (final c in own)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: kCardShadow),
            child: Row(children: [
              CategoryTile(iconType: categoryByLabel(c['label'].toString()).iconType, color: hexColor((c['color'] ?? '#6B7280').toString()), size: 38),
              const SizedBox(width: 12),
              Expanded(child: Text(c['label'].toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.slate800))),
              IconButton(onPressed: () => _delete(c), icon: const Icon(Icons.delete_outline, color: AppColors.expense, size: 20)),
            ]),
          ),
        const SizedBox(height: 16),
        const Text('Danh mục mặc định', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800)),
        const SizedBox(height: 8),
        Wrap(spacing: 10, runSpacing: 10, children: [
          for (final c in builtIn)
            Container(
              padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                CategoryTile(iconType: c.iconType, color: c.color, size: 30),
                const SizedBox(width: 8),
                Text(c.label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.slate700)),
              ]),
            ),
        ]),
      ]),
    );
  }
}
