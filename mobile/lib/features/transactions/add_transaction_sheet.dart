import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../constants/categories.dart';
import '../../models/bank_card.dart';
import '../../models/transaction.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';

/// Opens the add/edit transaction sheet. Pass [initial] to edit an existing one.
Future<bool?> showAddTransactionSheet(BuildContext context, {TransactionModel? initial}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _AddTransactionSheet(initial: initial),
  );
}

class _AddTransactionSheet extends ConsumerStatefulWidget {
  const _AddTransactionSheet({this.initial});
  final TransactionModel? initial;
  @override
  ConsumerState<_AddTransactionSheet> createState() => _AddTransactionSheetState();
}

class _AddTransactionSheetState extends ConsumerState<_AddTransactionSheet> {
  bool _isExpense = true;
  final _amount = TextEditingController();
  final _note = TextEditingController();
  String _category = 'Ăn uống';
  DateTime _date = DateTime.now();
  String _method = 'cash';
  String? _cardId;
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.initial != null;

  @override
  void initState() {
    super.initState();
    final t = widget.initial;
    if (t != null) {
      _isExpense = !t.isIncome;
      _category = t.category;
      _note.text = t.note;
      _date = t.date;
      _method = t.paymentMethod == 'card' ? 'card' : 'cash';
      _cardId = t.cardId;
      // Prefill amount with thousands separators.
      final s = t.amount.round().toString();
      final buf = StringBuffer();
      for (int i = 0; i < s.length; i++) {
        if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
        buf.write(s[i]);
      }
      _amount.text = buf.toString();
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  void _switchType(bool expense) {
    setState(() {
      _isExpense = expense;
      _category = categoriesFor(!expense).first.label;
    });
  }

  Future<void> _save() async {
    final amount = num.tryParse(_amount.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    if (amount <= 0) return setState(() => _error = 'Nhập số tiền hợp lệ');
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final svc = ref.read(financeServiceProvider);
      final type = _isExpense ? 'expense' : 'income';
      final cardId = _method == 'card' ? _cardId : null;
      if (_isEdit) {
        await svc.updateTransaction(widget.initial!.id,
            type: type, amount: amount, category: _category, note: _note.text.trim(),
            date: _date, paymentMethod: _method, cardId: cardId);
      } else {
        await svc.createTransaction(
            type: type, amount: amount, category: _category, note: _note.text.trim(),
            date: _date, paymentMethod: _method, cardId: cardId);
      }
      refreshFinance(ref);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = 'Lưu thất bại, thử lại');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cats = categoriesFor(!_isExpense);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final accent = _isExpense ? AppColors.expense : AppColors.income;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.9),
        decoration: const BoxDecoration(
          color: AppColors.pageLight,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3))),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Row(
                children: [
                  Text(_isEdit ? 'Sửa giao dịch' : 'Thêm giao dịch', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                  const Spacer(),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: AppColors.slate400)),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Type toggle
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(14)),
                      child: Row(children: [
                        _typeBtn('Chi tiêu', _isExpense, AppColors.expense, () => _switchType(true)),
                        _typeBtn('Thu nhập', !_isExpense, AppColors.income, () => _switchType(false)),
                      ]),
                    ),
                    const SizedBox(height: 18),
                    // Amount
                    Center(
                      child: TextField(
                        controller: _amount,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly, _ThousandsFormatter()],
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: accent),
                        decoration: InputDecoration(
                          hintText: '0',
                          hintStyle: TextStyle(color: accent.withValues(alpha: 0.4), fontSize: 34, fontWeight: FontWeight.w800),
                          border: InputBorder.none,
                          suffixText: 'đ',
                          suffixStyle: TextStyle(color: accent, fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text('Danh mục', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: cats.map((c) {
                        final selected = c.label == _category;
                        return GestureDetector(
                          onTap: () => setState(() => _category = c.label),
                          child: Container(
                            width: 72,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: selected ? c.color.withValues(alpha: 0.15) : Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: selected ? c.color : AppColors.slate200, width: selected ? 1.5 : 1),
                            ),
                            child: Column(children: [
                              SvgPicture.asset(c.iconAsset, width: 24, height: 24),
                              const SizedBox(height: 4),
                              Text(c.label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.slate700)),
                            ]),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),
                    _label('Ghi chú'),
                    TextField(
                      controller: _note,
                      decoration: _inputDecoration('Nhập ghi chú (tuỳ chọn)'),
                    ),
                    const SizedBox(height: 14),
                    _label('Ngày'),
                    GestureDetector(
                      onTap: _pickDate,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.slate200)),
                        child: Row(children: [
                          const Icon(Icons.calendar_today_outlined, size: 18, color: AppColors.primary),
                          const SizedBox(width: 10),
                          Text('${_date.day}/${_date.month}/${_date.year}', style: const TextStyle(fontSize: 15, color: AppColors.slate800)),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _label('Phương thức'),
                    _methodPicker(),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: AppColors.expense, fontSize: 13, fontWeight: FontWeight.w600)),
                    ],
                    const SizedBox(height: 20),
                    GestureDetector(
                      onTap: _saving ? null : _save,
                      child: Container(
                        height: 52,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), color: AppColors.brand),
                        child: _saving
                            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                            : Text(_isEdit ? 'Cập nhật' : 'Lưu giao dịch', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _methodPicker() {
    final cardsAsync = ref.watch(cardsProvider);
    return Column(
      children: [
        Row(children: [
          _methodBtn('Tiền mặt', Icons.payments_outlined, _method == 'cash', () => setState(() => _method = 'cash')),
          const SizedBox(width: 10),
          _methodBtn('Thẻ / Ví', Icons.credit_card, _method == 'card', () => setState(() => _method = 'card')),
        ]),
        if (_method == 'card')
          cardsAsync.maybeWhen(
            data: (cards) {
              if (cards.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.only(top: 10),
                  child: Text('Chưa có thẻ nào', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                );
              }
              _cardId ??= cards.first.id;
              return Padding(
                padding: const EdgeInsets.only(top: 10),
                child: DropdownButtonFormField<String>(
                  initialValue: _cardId,
                  isExpanded: true,
                  decoration: _inputDecoration(''),
                  items: cards
                      .map((BankCard c) => DropdownMenuItem(
                            value: c.id,
                            child: Text('${c.bankShortName} ••${c.cardNumber}', style: const TextStyle(fontSize: 14)),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _cardId = v),
                ),
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
      ],
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Widget _typeBtn(String label, bool active, Color color, VoidCallback onTap) => Expanded(
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? Colors.white : Colors.transparent,
              borderRadius: BorderRadius.circular(10),
              boxShadow: active ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 6)] : null,
            ),
            child: Text(label, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: active ? color : AppColors.slate400)),
          ),
        ),
      );

  Widget _methodBtn(String label, IconData icon, bool active, VoidCallback onTap) => Expanded(
        child: GestureDetector(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: active ? AppColors.brandLight.withValues(alpha: 0.4) : Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: active ? AppColors.primary : AppColors.slate200),
            ),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 18, color: active ? AppColors.primary : AppColors.slate400),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: active ? AppColors.primary : AppColors.slate500)),
            ]),
          ),
        ),
      );

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
      );

  InputDecoration _inputDecoration(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.slate400),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.slate200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.slate200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
      );
}

/// Formats the amount field with thousands separators as the user types.
class _ThousandsFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return newValue.copyWith(text: '');
    final n = int.parse(digits);
    final s = n.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    final out = buf.toString();
    return TextEditingValue(text: out, selection: TextSelection.collapsed(offset: out.length));
  }
}
