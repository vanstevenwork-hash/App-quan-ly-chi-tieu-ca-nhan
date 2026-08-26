import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/bank_card.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common.dart';

Future<bool?> showCardFormSheet(BuildContext context, {BankCard? initial}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _CardFormSheet(initial: initial),
  );
}

const _palette = [
  '#6C63FF', '#1B4FD8', '#EC1C24', '#0055A4', '#A50064',
  '#10B981', '#F59E0B', '#8B5CF6', '#0F172A', '#EA580C',
];

const _types = [
  (v: 'credit', label: 'Tín dụng'),
  (v: 'debit', label: 'Ghi nợ'),
  (v: 'savings', label: 'Tiết kiệm'),
  (v: 'eWallet', label: 'Ví'),
];

class _CardFormSheet extends ConsumerStatefulWidget {
  final BankCard? initial;
  const _CardFormSheet({this.initial});
  @override
  ConsumerState<_CardFormSheet> createState() => _CardFormSheetState();
}

class _CardFormSheetState extends ConsumerState<_CardFormSheet> {
  final _short = TextEditingController();
  final _bank = TextEditingController();
  final _number = TextEditingController();
  final _holder = TextEditingController();
  final _balance = TextEditingController();
  final _limit = TextEditingController();
  final _interest = TextEditingController();
  final _cashback = TextEditingController();
  final _statementDay = TextEditingController();
  final _dueDay = TextEditingController();
  String _type = 'credit';
  String _color = '#6C63FF';
  bool _saving = false;
  String? _error;

  bool get _isEdit => widget.initial != null;
  bool get _isCredit => _type == 'credit';

  @override
  void initState() {
    super.initState();
    final c = widget.initial;
    if (c != null) {
      _type = c.cardType;
      _short.text = c.bankShortName;
      _bank.text = c.bankName;
      _number.text = c.cardNumber;
      _holder.text = c.cardHolder;
      _balance.text = c.balance == 0 ? '' : c.balance.round().toString();
      _limit.text = c.creditLimit == 0 ? '' : c.creditLimit.round().toString();
      _interest.text = c.interestRate == 0 ? '' : c.interestRate.toString();
      _cashback.text = c.cashbackRate == 0 ? '' : c.cashbackRate.toString();
      _statementDay.text = c.statementDay == 0 ? '' : c.statementDay.toString();
      _dueDay.text = c.paymentDueDay == 0 ? '' : c.paymentDueDay.toString();
      _color = c.color;
    }
  }

  @override
  void dispose() {
    for (final c in [_short, _bank, _number, _holder, _balance, _limit, _interest, _cashback, _statementDay, _dueDay]) {
      c.dispose();
    }
    super.dispose();
  }

  num _n(TextEditingController c) => num.tryParse(c.text.trim()) ?? 0;

  Future<void> _save() async {
    if (_short.text.trim().isEmpty) return setState(() => _error = 'Nhập tên ngân hàng');
    if (_holder.text.trim().isEmpty) return setState(() => _error = 'Nhập tên chủ thẻ');
    setState(() {
      _saving = true;
      _error = null;
    });
    final data = <String, dynamic>{
      'bankShortName': _short.text.trim(),
      'bankName': _bank.text.trim().isEmpty ? _short.text.trim() : _bank.text.trim(),
      'cardType': _type,
      'cardNumber': _number.text.trim().isEmpty ? '0000' : _number.text.trim(),
      'cardHolder': _holder.text.trim(),
      'balance': _n(_balance),
      'color': _color,
      if (_isCredit) ...{
        'creditLimit': _n(_limit),
        'interestRate': _n(_interest),
        'cashbackRate': _n(_cashback),
        'statementDay': _n(_statementDay).toInt(),
        'paymentDueDay': _n(_dueDay).toInt(),
      },
    };
    try {
      final svc = ref.read(financeServiceProvider);
      if (_isEdit) {
        await svc.updateCard(widget.initial!.id, data);
      } else {
        await svc.createCard(data);
      }
      ref.invalidate(cardsProvider);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = 'Lưu thất bại, thử lại');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.92),
        decoration: const BoxDecoration(color: AppColors.pageLight, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3))),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 4),
              child: Row(children: [
                Text(_isEdit ? 'Sửa thẻ' : 'Thêm thẻ', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                const Spacer(),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: AppColors.slate400)),
              ]),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _label('Loại thẻ'),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(12)),
                    child: Row(children: [
                      for (final t in _types)
                        Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _type = t.v),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 9),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: _type == t.v ? Colors.white : Colors.transparent,
                                borderRadius: BorderRadius.circular(9),
                                boxShadow: _type == t.v ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 5)] : null,
                              ),
                              child: Text(t.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _type == t.v ? AppColors.brand : AppColors.slate400)),
                            ),
                          ),
                        ),
                    ]),
                  ),
                  const SizedBox(height: 14),
                  Row(children: [
                    Expanded(child: _field(_short, 'Viết tắt', hint: 'VCB')),
                    const SizedBox(width: 12),
                    Expanded(child: _field(_number, '4 số cuối', hint: '4021', number: true, maxLen: 4)),
                  ]),
                  const SizedBox(height: 12),
                  _field(_bank, 'Ngân hàng', hint: 'Vietcombank'),
                  const SizedBox(height: 12),
                  _field(_holder, 'Chủ thẻ', hint: 'NGUYEN VAN A'),
                  const SizedBox(height: 12),
                  _field(_balance, _isCredit ? 'Dư nợ hiện tại' : 'Số dư', hint: '0', number: true),
                  if (_isCredit) ...[
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _field(_limit, 'Hạn mức', hint: '30000000', number: true)),
                      const SizedBox(width: 12),
                      Expanded(child: _field(_interest, 'Lãi suất %', hint: '24', number: true)),
                    ]),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _field(_cashback, 'Hoàn tiền %', hint: '1.5', number: true)),
                      const SizedBox(width: 12),
                      Expanded(child: _field(_statementDay, 'Ngày sao kê', hint: '15', number: true, maxLen: 2)),
                    ]),
                    const SizedBox(height: 12),
                    _field(_dueDay, 'Hạn thanh toán (ngày)', hint: '25', number: true, maxLen: 2),
                  ],
                  const SizedBox(height: 16),
                  _label('Màu thẻ'),
                  Wrap(spacing: 10, runSpacing: 10, children: [
                    for (final c in _palette)
                      GestureDetector(
                        onTap: () => setState(() => _color = c),
                        child: Container(
                          width: 34, height: 34,
                          decoration: BoxDecoration(
                            color: hexColor(c),
                            shape: BoxShape.circle,
                            border: _color == c ? Border.all(color: AppColors.slate800, width: 2.5) : null,
                          ),
                        ),
                      ),
                  ]),
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
                          : Text(_isEdit ? 'Cập nhật' : 'Thêm thẻ', style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(t, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
      );

  Widget _field(TextEditingController c, String label, {String? hint, bool number = false, int? maxLen}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _label(label),
        TextField(
          controller: c,
          keyboardType: number ? TextInputType.number : TextInputType.text,
          inputFormatters: number ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))] : null,
          maxLength: maxLen,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.slate900),
          decoration: InputDecoration(
            hintText: hint,
            counterText: '',
            hintStyle: const TextStyle(color: AppColors.slate400, fontWeight: FontWeight.w400),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
          ),
        ),
      ],
    );
  }
}
