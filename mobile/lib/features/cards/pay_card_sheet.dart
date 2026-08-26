import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/bank_card.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';

Future<bool?> showPayCardSheet(BuildContext context, BankCard card) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _PayCardSheet(card: card),
  );
}

class _PayCardSheet extends ConsumerStatefulWidget {
  final BankCard card;
  const _PayCardSheet({required this.card});
  @override
  ConsumerState<_PayCardSheet> createState() => _PayCardSheetState();
}

class _PayCardSheetState extends ConsumerState<_PayCardSheet> {
  final _amount = TextEditingController();
  String? _sourceId; // null = pay without deducting a source
  bool _paying = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _pay() async {
    final amount = num.tryParse(_amount.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
    if (amount <= 0) return setState(() => _error = 'Nhập số tiền hợp lệ');
    if (amount > widget.card.balance) return setState(() => _error = 'Vượt quá dư nợ (${widget.card.balance.round()}đ)');
    setState(() {
      _paying = true;
      _error = null;
    });
    try {
      await ref.read(financeServiceProvider).payCard(widget.card.id, amount: amount, sourceId: _sourceId);
      ref.invalidate(cardsProvider);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = 'Thanh toán thất bại, thử lại');
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final sources = (ref.watch(cardsProvider).valueOrNull ?? [])
        .where((c) => !c.isCredit)
        .toList();
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        decoration: const BoxDecoration(color: AppColors.pageLight, borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3)))),
            const SizedBox(height: 16),
            Text('Trả thẻ ${widget.card.bankShortName}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.slate800)),
            const SizedBox(height: 4),
            Text('Dư nợ hiện tại: ${widget.card.balance.round()}đ', style: const TextStyle(fontSize: 13, color: AppColors.slate400)),
            const SizedBox(height: 18),
            const Text('Số tiền trả', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
            const SizedBox(height: 8),
            TextField(
              controller: _amount,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, _Thousands()],
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.brand),
              decoration: InputDecoration(
                hintText: '0',
                suffixText: 'đ',
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.slate200)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.slate200)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.brand, width: 2)),
              ),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () {
                _amount.text = _Thousands.format(widget.card.balance.round().toString());
              },
              child: const Text('Trả toàn bộ dư nợ', style: TextStyle(fontSize: 12, color: AppColors.brand, fontWeight: FontWeight.w600)),
            ),
            const SizedBox(height: 16),
            const Text('Trừ từ nguồn (tuỳ chọn)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate200)),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String?>(
                  isExpanded: true,
                  value: _sourceId,
                  hint: const Text('Không trừ nguồn', style: TextStyle(fontSize: 14, color: AppColors.slate400)),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('Không trừ nguồn', style: TextStyle(fontSize: 14))),
                    ...sources.map((c) => DropdownMenuItem(
                          value: c.id,
                          child: Text('${c.bankShortName} · ${c.balance.round()}đ', style: const TextStyle(fontSize: 14)),
                        )),
                  ],
                  onChanged: (v) => setState(() => _sourceId = v),
                ),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.expense, fontSize: 13, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 20),
            GestureDetector(
              onTap: _paying ? null : _pay,
              child: Container(
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), color: AppColors.income),
                child: _paying
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                    : const Text('Xác nhận trả', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Thousands extends TextInputFormatter {
  static String format(String digits) {
    if (digits.isEmpty) return '';
    final n = int.parse(digits);
    final s = n.toString();
    final buf = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return buf.toString();
  }

  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    final out = format(digits);
    return TextEditingValue(text: out, selection: TextSelection.collapsed(offset: out.length));
  }
}
