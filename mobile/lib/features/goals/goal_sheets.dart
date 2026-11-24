import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/goal.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

/// Port of the web GoalFormModal + GoalContributeModal.
const goalCategories = [
  (id: 'travel', icon: '✈️', label: 'Du lịch'),
  (id: 'house', icon: '🏠', label: 'Mua nhà'),
  (id: 'car', icon: '🚗', label: 'Mua xe'),
  (id: 'device', icon: '💻', label: 'Thiết bị'),
  (id: 'emergency', icon: '💰', label: 'Quỹ KẨN'),
  (id: 'education', icon: '🎓', label: 'Học tập'),
  (id: 'gift', icon: '🎁', label: 'Mua quà'),
  (id: 'vacation', icon: '🏖', label: 'Nghỉ dưỡng'),
  (id: 'investment', icon: '📈', label: 'Đầu tư'),
  (id: 'health', icon: '💪', label: 'Sức khỏe'),
  (id: 'wedding', icon: '💍', label: 'Đám cưới'),
  (id: 'other', icon: '🎯', label: 'Khác'),
];
const _goalColors = ['#6C63FF', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'];

String _p2(int n) => n.toString().padLeft(2, '0');

String _err(Object e, String fb) {
  if (e is DioException && e.response?.data is Map) {
    final m = (e.response!.data['message'] ?? '').toString();
    if (m.isNotEmpty) return m;
  }
  return fb;
}

class _Thousands extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue o, TextEditingValue n) {
    final d = n.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (d.isEmpty) return const TextEditingValue(text: '');
    final out = formatMoney(int.parse(d));
    return TextEditingValue(text: out, selection: TextSelection.collapsed(offset: out.length));
  }
}

InputDecoration _dec(String hint, {String? error, String? suffix}) => InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.slate400, fontWeight: FontWeight.w400),
      errorText: error,
      suffixText: suffix,
      isDense: true,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary)),
      errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFF87171))),
    );

Widget _label(String t) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(t, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.slate700)),
    );

Widget _handle(BuildContext context) => GestureDetector(
      onTap: () => Navigator.pop(context),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.only(top: 10, bottom: 6),
        alignment: Alignment.center,
        child: Container(width: 48, height: 5, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3))),
      ),
    );

// ═══════════════════════════════════════════════════════════════════════
// Create / edit
// ═══════════════════════════════════════════════════════════════════════

Future<bool?> showGoalFormSheet(BuildContext context, {Goal? initial, String? presetCategory}) => showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _GoalForm(initial: initial, presetCategory: presetCategory),
    );

class _GoalForm extends ConsumerStatefulWidget {
  final Goal? initial;
  final String? presetCategory;
  const _GoalForm({this.initial, this.presetCategory});
  @override
  ConsumerState<_GoalForm> createState() => _GoalFormState();
}

class _GoalFormState extends ConsumerState<_GoalForm> {
  final _name = TextEditingController();
  final _target = TextEditingController();
  final _desc = TextEditingController();
  final _autoAmount = TextEditingController();
  String _autoFreq = ''; // '' | daily | weekly | monthly
  String _category = 'other';
  String _color = '#6C63FF';
  DateTime? _deadline;
  bool _saving = false;
  String? _errName, _errTarget;

  @override
  void initState() {
    super.initState();
    final g = widget.initial;
    if (g != null) {
      _name.text = g.name;
      _target.text = g.targetAmount > 0 ? formatMoney(g.targetAmount) : '';
      _desc.text = g.description;
      _category = goalCategories.any((c) => c.id == g.category) ? g.category : 'other';
      _color = g.color;
      _deadline = g.deadline;
      _autoAmount.text = g.autoSaveAmount > 0 ? formatMoney(g.autoSaveAmount) : '';
      _autoFreq = g.autoSaveFrequency;
    } else if (widget.presetCategory != null) {
      _category = widget.presetCategory!;
      final c = goalCategories.firstWhere((c) => c.id == _category);
      _name.text = c.label;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _target.dispose();
    _desc.dispose();
    _autoAmount.dispose();
    super.dispose();
  }

  /// First automatic deposit: start of the next day / week (Mon) / month.
  String? get _firstAutoDate {
    final now = DateTime.now();
    final d = switch (_autoFreq) {
      'daily' => DateTime(now.year, now.month, now.day + 1),
      'weekly' => DateTime(now.year, now.month, now.day + (8 - now.weekday)),
      'monthly' => DateTime(now.year, now.month + 1, 1),
      _ => null,
    };
    return d == null ? null : '${_p2(d.day)}/${_p2(d.month)}';
  }

  Future<void> _save() async {
    final amt = int.tryParse(_target.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    setState(() {
      _errName = _name.text.trim().isEmpty ? 'Vui lòng nhập tên mục tiêu' : null;
      _errTarget = amt <= 0 ? 'Vui lòng nhập số tiền hợp lệ' : null;
    });
    final autoAmt = int.tryParse(_autoAmount.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    if (_autoFreq.isNotEmpty && autoAmt <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nhập số tiền góp tự động hoặc tắt góp tự động')));
      return;
    }
    if (_errName != null || _errTarget != null) return;
    setState(() => _saving = true);
    final g = widget.initial;
    final data = <String, dynamic>{
      'name': _name.text.trim(),
      'targetAmount': amt,
      'deadline': _deadline == null ? null : DateTime(_deadline!.year, _deadline!.month, _deadline!.day).toIso8601String(),
      'icon': goalCategories.firstWhere((c) => c.id == _category).icon,
      'color': _color,
      'category': _category,
      'description': _desc.text.trim(),
      'autoSaveAmount': _autoFreq.isEmpty ? 0 : (int.tryParse(_autoAmount.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0),
      'autoSaveFrequency': _autoFreq,
    };
    try {
      final svc = ref.read(financeServiceProvider);
      if (g != null) {
        await svc.updateGoal(g.id, data);
      } else {
        await svc.createGoal(data);
      }
      ref.invalidate(goalsProvider);
      if (!mounted) return;
      final m = ScaffoldMessenger.of(context);
      Navigator.pop(context, true);
      m.showSnackBar(SnackBar(content: Text(g != null ? 'Đã cập nhật mục tiêu' : 'Đã tạo mục tiêu mới')));
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_err(e, 'Lỗi khi lưu mục tiêu'))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = hexColor(_color, fallback: AppColors.primary);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        height: MediaQuery.sizeOf(context).height * 0.8,
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(children: [
          _handle(context),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.initial != null ? 'Chỉnh sửa mục tiêu' : 'Tạo mục tiêu', style: AppText.sheetTitle),
                  const SizedBox(height: 2),
                  const Text('Đặt mục tiêu & theo dõi tiến độ', style: TextStyle(fontSize: 12, color: AppColors.slate400)),
                ]),
              ),
            ]),
          ),
          const Divider(height: 1, color: AppColors.slate100),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                _label('Tên mục tiêu *'),
                TextField(
                  controller: _name,
                  onChanged: (_) => setState(() => _errName = null),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  decoration: _dec('VD: Mua laptop mới, Du lịch Nhật...', error: _errName),
                ),
                const SizedBox(height: 16),
                _label('Số tiền mục tiêu *'),
                TextField(
                  controller: _target,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, _Thousands()],
                  onChanged: (_) => setState(() => _errTarget = null),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  decoration: _dec('0', error: _errTarget, suffix: '₫'),
                ),
                const SizedBox(height: 16),
                _label('Danh mục'),
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 1.15,
                  children: [
                    for (final c in goalCategories)
                      GestureDetector(
                        onTap: () => setState(() => _category = c.id),
                        child: Container(
                          decoration: BoxDecoration(
                            color: _category == c.id ? AppColors.brandLight.withValues(alpha: 0.5) : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: _category == c.id ? AppColors.brand : AppColors.slate200, width: 2),
                          ),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Text(c.icon, style: const TextStyle(fontSize: 20)),
                            const SizedBox(height: 2),
                            Text(c.label,
                                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: _category == c.id ? AppColors.primary : AppColors.slate500)),
                          ]),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                _label('Màu sắc'),
                Wrap(spacing: 12, runSpacing: 10, children: [
                  for (final c in _goalColors)
                    GestureDetector(
                      onTap: () => setState(() => _color = c),
                      child: AnimatedScale(
                        scale: _color == c ? 1.2 : 1,
                        duration: const Duration(milliseconds: 150),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: hexColor(c),
                            shape: BoxShape.circle,
                            boxShadow: _color == c ? [const BoxShadow(color: Colors.white, spreadRadius: 2), BoxShadow(color: hexColor(c), spreadRadius: 4)] : null,
                          ),
                        ),
                      ),
                    ),
                ]),
                const SizedBox(height: 16),
                _label('Ngày hoàn thành'),
                GestureDetector(
                  onTap: () async {
                    final now = DateTime.now();
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _deadline != null && _deadline!.isAfter(now) ? _deadline! : now.add(const Duration(days: 30)),
                      firstDate: now,
                      lastDate: DateTime(now.year + 30),
                    );
                    if (d != null) setState(() => _deadline = d);
                  },
                  child: InputDecorator(
                    decoration: _dec(''),
                    child: Row(children: [
                      Text(_deadline == null ? 'dd/mm/yyyy' : '${_p2(_deadline!.day)}/${_p2(_deadline!.month)}/${_deadline!.year}',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _deadline == null ? AppColors.slate400 : AppColors.slate900)),
                      const Spacer(),
                      if (_deadline != null)
                        GestureDetector(onTap: () => setState(() => _deadline = null), child: const Icon(Icons.close_rounded, size: 16, color: AppColors.slate400)),
                    ]),
                  ),
                ),
                const SizedBox(height: 16),
                _label('Góp tự động'),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate100)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      for (final (f, l) in [('', 'Tắt'), ('daily', 'Hằng ngày'), ('weekly', 'Hằng tuần'), ('monthly', 'Hằng tháng')]) ...[
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _autoFreq = f),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: _autoFreq == f ? AppColors.brand : Colors.white,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: _autoFreq == f ? AppColors.brand : AppColors.slate200),
                              ),
                              child: Text(l, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _autoFreq == f ? Colors.white : AppColors.slate500)),
                            ),
                          ),
                        ),
                        if (f != 'monthly') const SizedBox(width: 6),
                      ],
                    ]),
                    if (_autoFreq.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      TextField(
                        controller: _autoAmount,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly, _Thousands()],
                        onChanged: (_) => setState(() {}),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                        decoration: _dec('Số tiền mỗi lần', suffix: '₫'),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'App tự cộng số tiền này vào mục tiêu ${_autoFreq == 'daily' ? 'mỗi ngày' : _autoFreq == 'weekly' ? 'mỗi tuần (thứ 2)' : 'mỗi tháng (ngày 1)'}, '
                        'lần đầu ${_firstAutoDate ?? ''}. Mỗi lần góp có thông báo và hoàn tác được trong "Giao dịch tự động".',
                        style: const TextStyle(fontSize: 11, color: AppColors.slate500, height: 1.4),
                      ),
                    ],
                  ]),
                ),
                const SizedBox(height: 16),
                _label('Ghi chú'),
                TextField(controller: _desc, minLines: 2, maxLines: 3, style: const TextStyle(fontSize: 14), decoration: _dec('')),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(20, 12, 20, 12 + MediaQuery.paddingOf(context).bottom),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: AppColors.slate100))),
            child: GestureDetector(
              onTap: _saving ? null : _save,
              child: Opacity(
                opacity: _saving ? 0.6 : 1,
                child: Container(
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [color, color.withValues(alpha: 0.8)]),
                    boxShadow: [BoxShadow(color: color.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4))],
                  ),
                  child: Text(_saving ? 'Đang lưu...' : widget.initial != null ? 'Cập nhật mục tiêu' : 'Tạo mục tiêu',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Deposit / withdraw
// ═══════════════════════════════════════════════════════════════════════

Future<void> showGoalContributeSheet(BuildContext context, Goal goal) => showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _Contribute(goal: goal),
    );

class _Contribute extends ConsumerStatefulWidget {
  final Goal goal;
  const _Contribute({required this.goal});
  @override
  ConsumerState<_Contribute> createState() => _ContributeState();
}

class _ContributeState extends ConsumerState<_Contribute> {
  bool _deposit = true;
  final _amount = TextEditingController();
  final _note = TextEditingController();
  bool _saving = false;
  String? _error;

  int get _amt => int.tryParse(_amount.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  String _short(num n) => n >= 1e6 ? '${(n / 1e6).toStringAsFixed(1)}tr' : '${(n / 1e3).round()}k';

  Future<void> _submit() async {
    final g = widget.goal;
    if (_amt <= 0) return setState(() => _error = 'Vui lòng nhập số tiền hợp lệ');
    if (!_deposit && _amt > g.currentAmount) return setState(() => _error = 'Số tiền rút lớn hơn số tiền hiện có');
    setState(() => _saving = true);
    try {
      final updated = await ref.read(financeServiceProvider).goalContribute(g.id, deposit: _deposit, amount: _amt, note: _note.text.trim());
      ref.invalidate(goalsProvider);
      if (!mounted) return;
      final pct = updated.progress;
      final msg = !_deposit
          ? 'Đã rút ${formatMoney(_amt)}₫'
          : pct >= 100
              ? 'Chúc mừng! Bạn đã đạt mục tiêu'
              : pct >= 75
                  ? 'Đã đạt 75% — còn 25% nữa'
                  : pct >= 50
                      ? 'Đã đi được nửa chặng'
                      : pct >= 25
                          ? 'Đã đi được 25%'
                          : 'Đã nạp ${formatMoney(_amt)}₫';
      final m = ScaffoldMessenger.of(context);
      Navigator.pop(context);
      m.showSnackBar(SnackBar(content: Text(msg)));
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _err(e, 'Không thể xử lý');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final g = widget.goal;
    final color = hexColor(g.color, fallback: AppColors.primary);
    final history = g.contributions.reversed.take(20).toList();
    Widget modeBtn(bool dep) => Expanded(
          child: GestureDetector(
            onTap: () => setState(() {
              _deposit = dep;
              _error = null;
            }),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: _deposit == dep ? Colors.white : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
                boxShadow: _deposit == dep ? kCardShadow : null,
              ),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Text(dep ? 'Nạp tiền' : 'Rút tiền',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: _deposit == dep ? (dep ? const Color(0xFF059669) : const Color(0xFFEF4444)) : AppColors.slate400)),
              ]),
            ),
          ),
        );
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.85),
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _handle(context),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 12, 12),
            child: Column(children: [
              Row(children: [
                Text(g.icon, style: const TextStyle(fontSize: 24)),
                const SizedBox(width: 10),
                Expanded(child: Text(g.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppText.sheetTitle)),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded, size: 18, color: Color(0xFF6B7280))),
              ]),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Column(children: [
                  Row(children: [
                    Text('${formatMoney(g.currentAmount)}₫', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate700)),
                    const Spacer(),
                    Text('${g.progress}%', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
                  ]),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(value: g.progress / 100, minHeight: 8, backgroundColor: AppColors.slate100, color: color),
                  ),
                  const SizedBox(height: 4),
                  Align(alignment: Alignment.centerRight, child: Text('Mục tiêu: ${formatMoney(g.targetAmount)}₫', style: const TextStyle(fontSize: 11, color: AppColors.slate400))),
                ]),
              ),
            ]),
          ),
          const Divider(height: 1, color: AppColors.slate100),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + MediaQuery.paddingOf(context).bottom),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(16)),
                  child: Row(children: [modeBtn(true), modeBtn(false)]),
                ),
                const SizedBox(height: 16),
                _label('Số tiền'),
                TextField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, _Thousands()],
                  onChanged: (_) => setState(() => _error = null),
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  decoration: _dec('0', error: _error, suffix: '₫'),
                ),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final v in [100000, 200000, 500000, 1000000, 2000000, 5000000])
                    GestureDetector(
                      onTap: () => setState(() {
                        _amount.text = formatMoney(v);
                        _error = null;
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(999), border: Border.all(color: AppColors.slate200)),
                        child: Text(_short(v), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.slate600)),
                      ),
                    ),
                ]),
                const SizedBox(height: 16),
                _label('Ghi chú (tuỳ chọn)'),
                TextField(controller: _note, style: const TextStyle(fontSize: 14), decoration: _dec(_deposit ? 'VD: Tiết kiệm tháng 3...' : 'VD: Chi tiêu khẩn cấp...')),
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: _saving ? null : _submit,
                  child: Opacity(
                    opacity: _saving ? 0.6 : 1,
                    child: Container(
                      height: 54,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: LinearGradient(
                          colors: _deposit ? const [Color(0xFF10B981), Color(0xFF14B8A6)] : const [Color(0xFFEF4444), Color(0xFFF97316)],
                        ),
                      ),
                      child: Text(
                        _saving
                            ? 'Đang xử lý...'
                            : _deposit
                                ? 'Nạp ${_amt > 0 ? '${formatMoney(_amt)}₫' : 'tiền'}'
                                : 'Rút ${_amt > 0 ? '${formatMoney(_amt)}₫' : 'tiền'}',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
                      ),
                    ),
                  ),
                ),
                if (history.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  const Row(children: [
                    Text('Lịch sử đóng góp', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.slate700)),
                  ]),
                  const SizedBox(height: 10),
                  for (final c in history)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(c.note.isNotEmpty ? c.note : (c.isDeposit ? 'Nạp tiền' : 'Rút tiền'),
                                maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate700)),
                            Text('${_p2(c.date.day)}/${_p2(c.date.month)}/${c.date.year} ${_p2(c.date.hour)}:${_p2(c.date.minute)}',
                                style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                          ]),
                        ),
                        Text('${c.isDeposit ? '+' : '-'}${_short(c.amount)}',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.isDeposit ? const Color(0xFF059669) : const Color(0xFFEF4444))),
                      ]),
                    ),
                ],
              ],
            ),
          ),
        ]),
      ),
    );
  }
}
