import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/card_catalog.dart';
import '../../models/bank_card.dart';
import '../../state/auth_provider.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/card_thumb.dart';
import '../../widgets/common.dart';
import 'card_design_picker.dart';

/// Add / edit a card — port of the web CardFormModal: live card preview,
/// account-type tiles, bank grid with search (VietQR list), artwork picker,
/// name / holder / last-4 / balance, account number, savings fields,
/// network logos + expiry + limit, shared-limit & auto-debit toggles,
/// statement/due days, cashback policy, annual fee, colour swatches, note,
/// bill-split QR, default toggle, and a delete + "Hoàn tất" footer.
Future<bool?> showCardFormSheet(BuildContext context, {BankCard? initial, String? initialType}) {
  return showModalBottomSheet<bool>(
    useRootNavigator: true,
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _CardFormSheet(initial: initial, initialType: initialType),
  );
}

/// VietQR bank list (cached for the session).
final banksProvider = FutureProvider<List<Map<String, dynamic>>>((ref) => ref.read(financeServiceProvider).getBanks());

// Same glyphs as the web CustomIcon set (exported to assets/icons/acct_*.svg).
const _types = [
  (v: 'debit', label: 'Thẻ ghi nợ', svg: 'theGhiNo'),
  (v: 'credit', label: 'Thẻ tín dụng', svg: 'creditCard'),
  (v: 'eWallet', label: 'Ví điện tử', svg: 'eWallet'),
];
const _typeSvg = {'debit': 'theGhiNo', 'credit': 'creditCard', 'eWallet': 'eWallet', 'savings': 'soTietKiem', 'crypto': 'bitcoin'};
Widget _acctIcon(String name, double size) => SvgPicture.asset('assets/icons/acct_$name.svg', width: size, height: size);
const _typeLabels = {'credit': 'Thẻ tín dụng', 'debit': 'Thẻ ghi nợ', 'savings': 'Sổ tiết kiệm', 'eWallet': 'Ví điện tử', 'crypto': 'Crypto'};

const _eWallets = [
  (name: 'MoMo', short: 'MoMo', color: '#A21CAF', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-MoMo-Transparent.png'),
  (name: 'ZaloPay', short: 'ZLP', color: '#0284C7', logo: 'https://cdn.haitrieu.com/wp-content/uploads/2022/10/Logo-ZaloPay-Square.png'),
  (name: 'Khác', short: '???', color: '#6C63FF', logo: ''),
];
const _cryptos = [
  (name: 'Binance', short: 'BNB', color: '#F0B90B', logo: ''),
  (name: 'OKX', short: 'OKX', color: '#1C1C1E', logo: ''),
  (name: 'Bybit', short: 'BBT', color: '#F7A600', logo: ''),
];

const _colors = ['#6C63FF', '#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#84CC16', '#1E1B4B'];
const _networks = ['visa', 'mastercard', 'jcb', 'amex', 'napas'];
const _terms = [1, 3, 6, 12, 24];
const _gradEnd = Color(0xFF9B4DE8);

String _stripAccents(String s) {
  const from = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
  const to = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
  final b = StringBuffer();
  for (final ch in s.split('')) {
    final lower = ch.toLowerCase();
    final i = from.indexOf(lower);
    if (i < 0) {
      b.write(ch);
    } else {
      b.write(ch == lower ? to[i] : to[i].toUpperCase());
    }
  }
  return b.toString();
}

class _CardFormSheet extends ConsumerStatefulWidget {
  final BankCard? initial;
  final String? initialType;
  const _CardFormSheet({this.initial, this.initialType});
  @override
  ConsumerState<_CardFormSheet> createState() => _CardFormSheetState();
}

class _CardFormSheetState extends ConsumerState<_CardFormSheet> {
  final _label = TextEditingController(); // card name (saved as bankName)
  final _holder = TextEditingController();
  final _number = TextEditingController();
  final _balance = TextEditingController();
  final _account = TextEditingController();
  final _interest = TextEditingController();
  final _expiry = TextEditingController();
  final _limit = TextEditingController();
  final _statementDay = TextEditingController();
  final _dueDay = TextEditingController();
  final _cashback = TextEditingController();
  final _cashbackCap = TextEditingController();
  final _minSpend = TextEditingController();
  final _annualFee = TextEditingController();
  final _note = TextEditingController();
  final _search = TextEditingController();

  String _type = 'debit';
  String _short = '';
  String _bankFull = '';
  String _bankColor = '#1B4FD8';
  String _color = '#6C63FF';
  String _cardImage = '';
  String _network = '';
  String _qr = '';
  bool _sharedLimit = false;
  bool _autoDebit = true;
  bool _isDefault = false;
  int _term = 12;
  DateTime? _deposit;
  String _autoLabel = '';
  bool _saving = false, _uploadingQr = false;
  final Map<String, String> _errors = {};

  bool get _isEdit => widget.initial != null;
  bool get _isSavings => _type == 'savings';
  bool get _isCredit => _type == 'credit';
  bool get _isPayAcct => _type == 'debit' || _type == 'eWallet';
  bool get _hasArtPicker => _isCredit || _type == 'debit';

  @override
  void initState() {
    super.initState();
    final c = widget.initial;
    if (c == null) {
      _type = widget.initialType ?? 'debit';
      if (_isSavings) _deposit = DateTime.now();
      return;
    }
    _type = c.cardType;
    _short = c.bankShortName;
    _bankFull = c.bankName;
    _label.text = c.bankName;
    _holder.text = c.cardHolder;
    _number.text = c.cardNumber;
    _balance.text = c.balance == 0 ? '' : formatMoney(c.balance);
    _account.text = c.receiveAccountNumber;
    _interest.text = c.interestRate == 0 ? '' : c.interestRate.toString();
    _expiry.text = c.expirationDate;
    _limit.text = c.creditLimit == 0 ? '' : formatMoney(c.creditLimit);
    _statementDay.text = c.statementDay == 0 ? '' : '${c.statementDay}';
    _dueDay.text = c.paymentDueDay == 0 ? '' : '${c.paymentDueDay}';
    _cashback.text = c.cashbackRate == 0 ? '' : c.cashbackRate.toString();
    _cashbackCap.text = c.cashbackCap == 0 ? '' : formatMoney(c.cashbackCap);
    _minSpend.text = c.cashbackMinSpend == 0 ? '' : formatMoney(c.cashbackMinSpend);
    _annualFee.text = c.annualFee == 0 ? '' : formatMoney(c.annualFee);
    _note.text = c.note;
    _bankColor = c.bankColor.isNotEmpty ? c.bankColor : '#1B4FD8';
    _color = c.color;
    _cardImage = c.cardImage;
    _network = c.cardNetwork;
    _qr = c.receiveQrImage;
    _sharedLimit = c.sharedLimit;
    _autoDebit = c.autoDebit;
    _isDefault = c.isDefault;
    _term = c.term > 0 ? c.term : 12;
    _deposit = c.depositDate;
  }

  @override
  void dispose() {
    for (final c in [_label, _holder, _number, _balance, _account, _interest, _expiry, _limit, _statementDay, _dueDay, _cashback, _cashbackCap, _minSpend, _annualFee, _note, _search]) {
      c.dispose();
    }
    super.dispose();
  }

  num _money(TextEditingController c) => num.tryParse(c.text.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;
  num _num(TextEditingController c) => num.tryParse(c.text.trim().replaceAll(',', '.')) ?? 0;
  DateTime? get _maturity => _deposit == null ? null : DateTime(_deposit!.year, _deposit!.month + _term, _deposit!.day);
  String get _holderPlaceholder {
    final n = ref.read(authProvider).user?.name ?? '';
    return n.isEmpty ? 'NGUYEN VAN A' : _stripAccents(n).toUpperCase();
  }

  void _selectBank({required String name, required String short, String color = '#3B82F6'}) {
    setState(() {
      // Bundled designs belong to one bank — drop it when the bank changes.
      if (short != _short && _cardImage.startsWith('/cards/')) _cardImage = '';
      final label = _label.text.trim();
      if (label.isEmpty || label == _bankFull || label == _short) _label.text = short;
      _short = short;
      _bankFull = name;
      _bankColor = color;
      _errors.remove('bank');
    });
  }

  void _pickDesign(String src, CardDesign? d) {
    setState(() {
      _cardImage = src;
      if (d == null) return;
      final label = _label.text.trim();
      if (label.isEmpty || label == _short || label == _bankFull || label == _autoLabel) _label.text = d.name;
      if (d.network.isNotEmpty && (_network.isEmpty || _network == _autoNetwork)) _network = d.network;
      _autoLabel = d.name;
      _autoNetwork = d.network;
    });
  }

  String _autoNetwork = '';

  bool _validate() {
    _errors.clear();
    if (_short.isEmpty && _label.text.trim().isEmpty) _errors['bank'] = 'Vui lòng chọn ngân hàng';
    if (_isSavings) {
      if (_money(_balance) <= 0) _errors['balance'] = 'Số tiền gửi phải lớn hơn 0';
      if (_deposit == null) _errors['depositDate'] = 'Vui lòng nhập ngày gửi';
      if (_num(_interest) <= 0) _errors['interestRate'] = 'Lãi suất phải lớn hơn 0';
    } else {
      final limit = _money(_limit);
      if (_isCredit && !_sharedLimit && limit > 0 && _money(_balance) > limit) _errors['balance'] = 'Dư nợ không được lớn hơn hạn mức';
      final sd = _num(_statementDay), dd = _num(_dueDay);
      if (_isCredit && (sd < 0 || sd > 31)) _errors['statementDay'] = 'Ngày sao kê phải từ 1–31';
      if (_isCredit && (dd < 0 || dd > 31)) _errors['paymentDueDay'] = 'Hạn thanh toán phải từ 1–31';
      if (_expiry.text.isNotEmpty && !RegExp(r'^\d{2}/\d{2}$').hasMatch(_expiry.text)) _errors['expirationDate'] = 'Định dạng MM/YY';
    }
    setState(() {});
    return _errors.isEmpty;
  }

  Future<void> _save() async {
    if (!_validate()) return;
    final label = _label.text.trim().isNotEmpty ? _label.text.trim() : (_short.isNotEmpty ? _short : 'Thẻ');
    final data = <String, dynamic>{
      'bankName': _isSavings ? (_bankFull.isNotEmpty ? _bankFull : label) : label,
      'bankShortName': _short.isNotEmpty ? _short : label,
      'cardType': _type,
      'cardNumber': _number.text.trim().isNotEmpty ? _number.text.trim() : '${1000 + DateTime.now().millisecond * 9 % 9000}',
      'cardHolder': _holder.text.trim().isNotEmpty ? _holder.text.trim() : _holderPlaceholder,
      'cardNetwork': _network,
      'balance': _money(_balance),
      'creditLimit': _isCredit ? _money(_limit) : 0,
      'sharedLimit': _isCredit && _sharedLimit,
      'receiveAccountNumber': _account.text.trim(),
      'receiveQrImage': _qr,
      'color': _color,
      'bankColor': _bankColor,
      'cardImage': _cardImage,
      'isDefault': _isDefault,
      'interestRate': _isSavings ? _num(_interest) : 0,
      'term': _isSavings ? _term : 0,
      if (_isSavings && _deposit != null) 'depositDate': DateTime(_deposit!.year, _deposit!.month, _deposit!.day).toIso8601String(),
      if (_isSavings && _maturity != null) 'maturityDate': _maturity!.toIso8601String(),
      'paymentDueDay': _isCredit ? _num(_dueDay).toInt() : 0,
      'statementDay': _isCredit ? _num(_statementDay).toInt() : 0,
      'cashbackRate': _isCredit ? _num(_cashback) : 0,
      'cashbackCap': _isCredit ? _money(_cashbackCap) : 0,
      'cashbackMinSpend': _isCredit ? _money(_minSpend) : 0,
      'annualFee': _isCredit ? _money(_annualFee) : 0,
      'autoDebit': _autoDebit,
      'expirationDate': _isSavings ? '' : _expiry.text.trim(),
      'note': _note.text.trim(),
    };
    setState(() => _saving = true);
    try {
      final svc = ref.read(financeServiceProvider);
      if (_isEdit) {
        await svc.updateCard(widget.initial!.id, data);
      } else {
        await svc.createCard(data);
      }
      refreshFinance(ref);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Lưu thất bại, thử lại')));
    }
    if (mounted) setState(() => _saving = false);
  }

  Future<void> _delete() async {
    final c = widget.initial!;
    final what = switch (c.cardType) { 'credit' => 'thẻ', 'eWallet' => 'ví', 'crypto' => 'tài khoản crypto', 'savings' => 'sổ tiết kiệm', _ => 'tài khoản' };
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        content: Text('Bạn có chắc chắn muốn xoá $what này vĩnh viễn không?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(d, true), child: const Text('Xoá', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold))),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _saving = true);
    try {
      await ref.read(financeServiceProvider).deleteCard(c.id);
      refreshFinance(ref);
      if (!mounted) return;
      final m = ScaffoldMessenger.of(context);
      Navigator.of(context).pop(true);
      m.showSnackBar(SnackBar(content: Text('Đã xoá $what')));
    } catch (_) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không thể xoá. Vui lòng thử lại.')));
      }
    }
  }

  Future<void> _uploadQr() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1000, imageQuality: 90);
    if (picked == null) return;
    setState(() => _uploadingQr = true);
    try {
      final url = await ref.read(financeServiceProvider).uploadImage(picked.path, folder: 'chi_tieu/qr');
      setState(() => _qr = url);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tải ảnh thất bại')));
    }
    if (mounted) setState(() => _uploadingQr = false);
  }

  // ── UI ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        height: MediaQuery.sizeOf(context).height * 0.8,
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(children: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 8, bottom: 6),
              alignment: Alignment.center,
              child: Container(width: 48, height: 6, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3))),
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.slate100))),
            child: Text(_isEdit ? 'Chỉnh sửa' : _isSavings ? 'Thêm sổ tiết kiệm' : 'Thêm thẻ / tài khoản',
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.black)),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              children: [
                if (!_isSavings) ...[_preview(), const SizedBox(height: 12)],
                if (!_isEdit && !_isSavings) ...[_typeTiles(), const SizedBox(height: 12)],
                _bankGrid(),
                if (_hasArtPicker && (_short.isNotEmpty || _label.text.trim().isNotEmpty)) ...[
                  const SizedBox(height: 12),
                  CardDesignPicker(bankShortName: _short, bankName: _bankFull, cardType: _type, value: _cardImage, onChanged: _pickDesign),
                ],
                const SizedBox(height: 12),
                ..._fields(),
              ],
            ),
          ),
          _footer(),
        ]),
      ),
    );
  }

  // Card preview — artwork wins over the colour gradient.
  Widget _preview() {
    final art = cardArtDecoration(BankCard(
      id: '', bankName: '', bankShortName: _short, cardType: _type, cardNumber: '', cardHolder: '',
      balance: 0, creditLimit: 0, interestRate: 0, color: _color, isDefault: false, cardImage: _cardImage,
    ));
    final isBlack = art == null && _color == '#111111';
    final isWhite = art == null && _color == '#FFFFFF';
    final textCol = art != null ? Colors.white : isBlack ? const Color(0xFFFACC15) : isWhite ? AppColors.slate800 : Colors.white;
    final textOp = art != null ? Colors.white : isBlack ? const Color(0xCCFDE047) : isWhite ? AppColors.slate500 : Colors.white.withValues(alpha: 0.9);
    final shadow = art != null ? const [Shadow(color: Color(0x99000000), blurRadius: 2, offset: Offset(0, 1))] : null;
    final logo = _logoFor(_short);
    final decoration = BoxDecoration(
      borderRadius: BorderRadius.circular(art != null ? 12 : (_isPayAcct && _type != 'debit' ? 20 : 12)),
      image: art,
      color: art == null && (isBlack || isWhite) ? hexColor(_color) : null,
      gradient: art == null && !isBlack && !isWhite
          ? LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [hexColor(_bankColor, fallback: AppColors.brand), hexColor(_color, fallback: AppColors.brand)])
          : null,
      border: isWhite ? Border.all(color: const Color(0xFFE2E8F0)) : null,
      boxShadow: kCardShadow,
    );
    Widget logoBox() => logo != null
        ? Container(
            width: 40,
            height: 40,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), boxShadow: kCardShadow),
            child: Image.network(logo, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox()),
          )
        : Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: isWhite ? AppColors.slate100 : Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(12)),
            child: Text(_short.isEmpty ? '???' : _short.substring(0, _short.length.clamp(0, 4)),
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: isWhite ? AppColors.slate600 : Colors.white)),
          );
    final holder = _holder.text.isNotEmpty ? _holder.text : _holderPlaceholder;

    if (_hasArtPicker) {
      final body = Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            logoBox(),
            const SizedBox(height: 4),
            Text((_label.text.isNotEmpty ? _label.text : (_bankFull.isNotEmpty ? _bankFull : 'Tên thẻ')).toUpperCase(),
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1, color: textOp, shadows: shadow)),
          ]),
        ]),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 8),
        Text(holder.toUpperCase(), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: textCol, shadows: shadow)),
        const SizedBox(height: 6),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('**** ${_number.text.isNotEmpty ? _number.text : '1234'}',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: 3, fontFamily: 'Menlo', color: textCol, shadows: shadow)),
              if (_expiry.text.isNotEmpty)
                Text(_expiry.text, style: TextStyle(fontSize: 12, fontFamily: 'Menlo', color: textOp, shadows: shadow)),
            ]),
          ),
          if (_network.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(color: isBlack ? const Color(0x33FACC15) : Colors.white.withValues(alpha: 0.9), borderRadius: BorderRadius.circular(6)),
              child: _networkLogo(_network),
            ),
        ]),
        ]),
      ]);
      // Web: artwork → real card ratio; colour only → a compact 140px strip.
      final box = Container(padding: EdgeInsets.all(art != null ? 12 : 10), clipBehavior: Clip.antiAlias, decoration: decoration, child: body);
      return art != null ? AspectRatio(aspectRatio: 1.586, child: box) : ConstrainedBox(constraints: const BoxConstraints(minHeight: 140), child: box);
    }
    // e-wallet / crypto preview
    return Container(
      height: 160,
      padding: const EdgeInsets.all(20),
      decoration: decoration.copyWith(borderRadius: BorderRadius.circular(20)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          logoBox(),
          const Spacer(),
          SvgPicture.asset('assets/icons/acct_${_typeSvg[_type] ?? 'eWallet'}.svg', width: 16, height: 16, colorFilter: ColorFilter.mode(textOp, BlendMode.srcIn)),
          const SizedBox(width: 6),
          Text(_typeLabels[_type] ?? '', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: textOp)),
        ]),
        const Spacer(),
        Text('•••• •••• •••• ${_number.text.isNotEmpty ? _number.text : '????'}', style: TextStyle(fontSize: 14, letterSpacing: 2.5, fontFamily: 'Menlo', color: textOp)),
        const SizedBox(height: 4),
        Text(holder.toUpperCase(), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: textCol)),
      ]),
    );
  }

  Widget _networkLogo(String n, {double scale = 1}) => switch (n) {
        'visa' => Text('VISA', style: TextStyle(fontSize: 18 * scale, fontWeight: FontWeight.w900, fontStyle: FontStyle.italic, letterSpacing: -0.7, color: const Color(0xFF1A1F71), height: 1)),
        'mastercard' => SizedBox(
            width: 28 * scale,
            height: 18 * scale,
            child: Stack(children: [
              Positioned(left: 0, child: CircleAvatar(radius: 9 * scale, backgroundColor: const Color(0xFFEB001B))),
              Positioned(right: 0, child: CircleAvatar(radius: 9 * scale, backgroundColor: const Color(0xCCF79E1B))),
            ]),
          ),
        'jcb' => Text.rich(TextSpan(style: TextStyle(fontSize: 15 * scale, fontWeight: FontWeight.w900, height: 1), children: const [
            TextSpan(text: 'J', style: TextStyle(color: Color(0xFF0F4C9E))),
            TextSpan(text: 'C', style: TextStyle(color: Color(0xFFBE1833))),
            TextSpan(text: 'B', style: TextStyle(color: Color(0xFF118A38))),
          ])),
        'amex' => Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 3),
            decoration: BoxDecoration(color: const Color(0xFF006FCF), borderRadius: BorderRadius.circular(3)),
            child: Text('AMEX', style: TextStyle(fontSize: 8 * scale, fontWeight: FontWeight.w700, color: Colors.white, height: 1)),
          ),
        'napas' => Text('napas', style: TextStyle(fontSize: 14 * scale, fontWeight: FontWeight.w900, color: const Color(0xFFC8102E), height: 1)),
        _ => const SizedBox.shrink(),
      };

  String? _logoFor(String short) {
    if (short.isEmpty) return null;
    if (_type == 'eWallet') {
      final w = _eWallets.where((w) => w.short == short).firstOrNull;
      if (w != null && w.logo.isNotEmpty) return w.logo;
    }
    final banks = ref.watch(banksProvider).valueOrNull ?? const [];
    final b = banks.where((b) => (b['shortName'] ?? '').toString() == short).firstOrNull;
    final logo = (b?['logo'] ?? '').toString();
    return logo.isNotEmpty ? logo : null;
  }

  Widget _sectionLabel(String t, {Widget? trailing}) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Expanded(child: Text(t, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black))),
          ?trailing,
        ]),
      );

  Widget _typeTiles() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _sectionLabel('Loại tài khoản'),
        Row(children: [
          for (final t in _types) ...[
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() {
                  _type = t.v;
                  _search.clear();
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: _type == t.v ? AppColors.brandLight.withValues(alpha: 0.5) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _type == t.v ? AppColors.brand : AppColors.slate200),
                  ),
                  child: Column(children: [
                    _acctIcon(t.svg, 30),
                    const SizedBox(height: 4),
                    Text(t.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _type == t.v ? AppColors.brand : Colors.black)),
                  ]),
                ),
              ),
            ),
            if (t != _types.last) const SizedBox(width: 8),
          ],
        ]),
      ]);

  Widget _bankGrid() {
    final List<({String name, String short, String color, String logo})> items;
    if (_type == 'eWallet') {
      items = _eWallets;
    } else if (_type == 'crypto') {
      items = _cryptos;
    } else {
      final q = _search.text.trim().toLowerCase();
      items = [
        for (final b in ref.watch(banksProvider).valueOrNull ?? const <Map<String, dynamic>>[])
          if (q.isEmpty || '${b['name']}'.toLowerCase().contains(q) || '${b['shortName']}'.toLowerCase().contains(q))
            (name: '${b['name'] ?? b['shortName']}', short: '${b['shortName'] ?? ''}', color: '#3B82F6', logo: '${b['logo'] ?? ''}'),
      ];
    }
    final loading = _type != 'eWallet' && _type != 'crypto' && ref.watch(banksProvider).isLoading;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _sectionLabel('Ngân hàng / Nguồn gốc',
          trailing: _type == 'eWallet' || _type == 'crypto'
              ? null
              : SizedBox(
                  width: 140,
                  height: 36,
                  child: TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    style: const TextStyle(fontSize: 12),
                    decoration: InputDecoration(
                      hintText: 'Tìm kiếm...',
                      hintStyle: const TextStyle(fontSize: 12, color: AppColors.slate400),
                      prefixIcon: const Icon(Icons.search, size: 16, color: AppColors.slate400),
                      prefixIconConstraints: const BoxConstraints(minWidth: 32),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: EdgeInsets.zero,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.brand)),
                    ),
                  ),
                )),
      if (_errors['bank'] != null) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(_errors['bank']!, style: const TextStyle(fontSize: 12, color: AppColors.expense))),
      if (loading)
        const SizedBox(height: 120, child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
      else
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 200),
          child: GridView.builder(
            shrinkWrap: true,
            padding: EdgeInsets.zero,
            itemCount: items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, mainAxisSpacing: 8, crossAxisSpacing: 8, mainAxisExtent: 72),
            itemBuilder: (_, i) {
              final b = items[i];
              final sel = _short == b.short && _short.isNotEmpty;
              return GestureDetector(
                onTap: () => _selectBank(name: b.name, short: b.short, color: b.color),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: sel ? AppColors.brandLight.withValues(alpha: 0.5) : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: sel ? AppColors.brand : AppColors.slate200, width: sel ? 1.5 : 1),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (b.logo.isNotEmpty)
                      SizedBox(width: 40, height: 32, child: Image.network(b.logo, fit: BoxFit.contain, errorBuilder: (_, _, _) => const SizedBox()))
                    else if (_type == 'eWallet' || _type == 'crypto')
                      Container(
                        width: 32,
                        height: 32,
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(color: hexColor(b.color).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                        child: _acctIcon(_type == 'crypto' ? 'bitcoin' : 'eWallet', 22),
                      )
                    else
                      Container(
                        width: 32,
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: hexColor(b.color), borderRadius: BorderRadius.circular(8)),
                        child: Text(b.short.substring(0, b.short.length.clamp(0, 3)), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
                      ),
                    const SizedBox(height: 4),
                    Text(_type == 'eWallet' || _type == 'crypto' ? b.name : b.short,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: sel ? AppColors.brand : AppColors.slate700)),
                  ]),
                ),
              );
            },
          ),
        ),
    ]);
  }

  InputDecoration _dec(String hint, {String? error}) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.slate400, fontSize: 14, fontWeight: FontWeight.w400),
        errorText: error,
        isDense: true,
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.brand)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFF87171))),
      );

  Widget _field(String label, TextEditingController c, String hint,
      {String? error, Widget? labelExtra, TextInputType? kb, List<TextInputFormatter>? fmt, bool bold = false, bool money = false, ValueChanged<String>? onChanged}) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text.rich(TextSpan(style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black), children: [
          TextSpan(text: label),
          if (labelExtra != null) WidgetSpan(child: labelExtra),
        ])),
      ),
      TextField(
        controller: c,
        keyboardType: money ? TextInputType.number : kb,
        inputFormatters: money ? [FilteringTextInputFormatter.digitsOnly, _Thousands()] : fmt,
        onChanged: (v) {
          onChanged?.call(v);
          setState(() {});
        },
        style: TextStyle(fontSize: 15, fontWeight: bold || money ? FontWeight.w700 : FontWeight.w600, color: Colors.black),
        decoration: _dec(hint, error: error),
      ),
    ]);
  }

  Widget _toggle(String title, String desc, bool value, ValueChanged<bool> onChanged, {String? extra}) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate100)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          GestureDetector(
            onTap: () => onChanged(!value),
            behavior: HitTestBehavior.opaque,
            child: Row(children: [
              _switch(value),
              const SizedBox(width: 12),
              Expanded(child: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black))),
            ]),
          ),
          const SizedBox(height: 6),
          Text(desc, style: const TextStyle(fontSize: 11, color: AppColors.slate500, height: 1.4)),
          if (extra != null) ...[
            const SizedBox(height: 6),
            Text(extra, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.brand)),
          ],
        ]),
      );

  Widget _switch(bool on) => AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 48,
        height: 28,
        padding: const EdgeInsets.all(4),
        alignment: on ? Alignment.centerRight : Alignment.centerLeft,
        decoration: BoxDecoration(color: on ? AppColors.brand : AppColors.slate200, borderRadius: BorderRadius.circular(999)),
        child: Container(width: 20, height: 20, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Color(0x26000000), blurRadius: 2)])),
      );

  String _dmy(DateTime? d) => d == null ? 'dd/mm/yyyy' : '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  List<Widget> _fields() {
    const gap = SizedBox(height: 12);
    final siblings = _isCredit && _sharedLimit && _short.isNotEmpty
        ? (ref.watch(cardsProvider).valueOrNull ?? const <BankCard>[])
            .where((c) => c.id != widget.initial?.id && c.isCredit && c.sharedLimit && (c.bankShortName.isNotEmpty ? c.bankShortName : c.bankName) == _short)
            .toList()
        : const <BankCard>[];
    return [
      if (!_isSavings) ...[
        _field('Tên thẻ ', _label, _bankFull.isNotEmpty ? _bankFull : 'Nhập tên thẻ...',
            labelExtra: const Text('(vd: VCB Cashback, TCB Visa...)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400, color: AppColors.slate400))),
        gap,
        _field('Tên chủ thẻ', _holder, _holderPlaceholder, fmt: [_Upper()]),
        gap,
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            width: 100,
            child: _field('4 số cuối', _number, '1234', kb: TextInputType.number, fmt: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)]),
          ),
          const SizedBox(width: 10),
          Expanded(child: _field(_isCredit ? 'Dư nợ hiện tại (VND)' : 'Số dư hiện tại (VND)', _balance, '0', money: true, error: _errors['balance'])),
        ]),
        if (_isPayAcct) ...[
          gap,
          _field('Số tài khoản ngân hàng ', _account, 'VD: 41322102001',
              kb: TextInputType.number,
              fmt: [FilteringTextInputFormatter.deny(RegExp(r'\s'))],
              labelExtra: const Text('(tuỳ chọn)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400, color: AppColors.slate400))),
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Text('Điền STK đầy đủ để tự khớp giao dịch nhập từ email/ngân hàng vào đúng thẻ này.', style: TextStyle(fontSize: 11, color: AppColors.slate400)),
          ),
        ],
      ],
      if (_isSavings) ...[
        _field('Số tiền gửi (VND) *', _balance, '0', money: true, error: _errors['balance']),
        gap,
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: _field('Lãi suất (%/năm) *', _interest, '7.5',
                kb: const TextInputType.numberWithOptions(decimal: true), fmt: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))], error: _errors['interestRate']),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Kỳ hạn', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black))),
              DropdownButtonFormField<int>(
                initialValue: _terms.contains(_term) ? _term : 12,
                items: [for (final t in _terms) DropdownMenuItem(value: t, child: Text('$t tháng', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)))],
                onChanged: (v) => setState(() => _term = v ?? 12),
                decoration: _dec(''),
              ),
            ]),
          ),
        ]),
        gap,
        const Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Ngày gửi *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black))),
        GestureDetector(
          onTap: () async {
            final d = await showDatePicker(context: context, initialDate: _deposit ?? DateTime.now(), firstDate: DateTime(2015), lastDate: DateTime.now().add(const Duration(days: 365)));
            if (d != null) setState(() => _deposit = d);
          },
          child: InputDecorator(
            decoration: _dec('', error: _errors['depositDate']),
            child: Row(children: [
              Text(_dmy(_deposit), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _deposit == null ? AppColors.slate400 : Colors.black)),
            ]),
          ),
        ),
        gap,
        const Padding(padding: EdgeInsets.only(bottom: 6), child: Text('Ngày đáo hạn', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black))),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate200)),
          child: Text(_dmy(_maturity), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.slate500)),
        ),
      ],
      if (_hasArtPicker) ...[
        gap,
        const Text('Tổ chức thẻ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black)),
        const SizedBox(height: 6),
        Row(children: [
          for (final n in _networks) ...[
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _network = _network == n ? '' : n),
                child: AnimatedScale(
                  scale: _network == n ? 1.04 : 1,
                  duration: const Duration(milliseconds: 150),
                  child: Container(
                    height: 40,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _network == n ? AppColors.brand : AppColors.slate200, width: 2),
                      boxShadow: _network == n ? [BoxShadow(color: AppColors.brand.withValues(alpha: 0.25), blurRadius: 6)] : null,
                    ),
                    child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
                      _networkLogo(n, scale: 0.85),
                      if (_network == n)
                        Positioned(
                          top: -9,
                          right: -9,
                          child: Container(
                            width: 16,
                            height: 16,
                            decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle),
                            child: const Icon(Icons.check, size: 11, color: Colors.white),
                          ),
                        ),
                    ]),
                  ),
                ),
              ),
            ),
            if (n != _networks.last) const SizedBox(width: 6),
          ],
        ]),
        gap,
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 110, child: _field('Ngày hết hạn thẻ', _expiry, 'MM/YY', kb: TextInputType.number, fmt: [_Expiry()], error: _errors['expirationDate'])),
          if (_isCredit) ...[
            const SizedBox(width: 10),
            Expanded(child: _field('Hạn mức tín dụng (VND)', _limit, '50.000.000', money: true)),
          ],
        ]),
      ],
      if (_isCredit) ...[
        gap,
        _toggle(
          'Chung hạn mức cùng ngân hàng',
          'Bật nếu ngân hàng này cấp chung 1 hạn mức cho nhiều thẻ (vd: thẻ chính + thẻ phụ). Hạn mức hiển thị sẽ lấy giá trị cao nhất trong các thẻ cùng ngân hàng có bật tuỳ chọn này.',
          _sharedLimit,
          (v) => setState(() => _sharedLimit = v),
          extra: siblings.isEmpty ? null : 'Sẽ chung hạn mức với: ${siblings.map((c) => c.bankName).join(', ')}',
        ),
        gap,
        _toggle(
          'Tự động trừ tiền sau sao kê',
          'Sau ngày chốt sao kê, app tự trừ số tiền phải trả kỳ đó từ tài khoản thanh toán cùng ngân hàng${_short.isNotEmpty ? ' ($_short)' : ''}, nếu tài khoản đủ số dư.',
          _autoDebit,
          (v) => setState(() => _autoDebit = v),
        ),
        gap,
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: _field('Ngày sao kê', _statementDay, '25', kb: TextInputType.number, fmt: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(2)], error: _errors['statementDay'])),
          const SizedBox(width: 10),
          Expanded(child: _field('Hạn thanh toán', _dueDay, '10', kb: TextInputType.number, fmt: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(2)], error: _errors['paymentDueDay'])),
        ]),
        gap,
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: _field('Tỷ lệ hoàn tiền (%)', _cashback, 'vd: 1.5', kb: const TextInputType.numberWithOptions(decimal: true), fmt: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))]),
          ),
          const SizedBox(width: 10),
          Expanded(child: _field('Hoàn tiền tối đa/tháng', _cashbackCap, 'Không giới hạn', money: true)),
        ]),
        gap,
        _field('Chi tiêu tối thiểu/tháng để nhận hoàn (VND)', _minSpend, 'vd: 15.000.000 · để trống nếu không yêu cầu', money: true),
        const Padding(
          padding: EdgeInsets.only(top: 6),
          child: Text(
            'Theo chính sách hoàn tiền thật của thẻ này, dùng để tính "Hoàn tiền" trên trang Thẻ. Tháng nào chi chưa đủ mức tối thiểu sẽ không được tính hoàn. Để trống mục nào nếu thẻ không có giới hạn đó.',
            style: TextStyle(fontSize: 11, color: AppColors.slate400, height: 1.4),
          ),
        ),
        gap,
        _field('Phí thường niên (VND)', _annualFee, 'vd: 400.000 · để trống nếu miễn phí', money: true),
      ],
      if (!_isSavings) ...[
        gap,
        Text.rich(TextSpan(style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black), children: [
          const TextSpan(text: 'Màu hiển thị '),
          if (_cardImage.isNotEmpty) const TextSpan(text: '(dùng khi bỏ ảnh thẻ)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400, color: AppColors.slate400)),
        ])),
        const SizedBox(height: 10),
        Wrap(spacing: 10, runSpacing: 10, crossAxisAlignment: WrapCrossAlignment.center, children: [
          for (final c in _colors) _swatch(c),
          Container(width: 1, height: 24, color: AppColors.slate200),
          _swatch('#FFFFFF'),
          _swatch('#111111'),
        ]),
        if (_color == '#111111' || _color == '#FFFFFF')
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(_color == '#111111' ? 'Thẻ đen — chữ hiển thị màu vàng' : 'Thẻ trắng — chữ hiển thị màu tối',
                style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
          ),
        gap,
        const Text('Ghi chú', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black)),
        const SizedBox(height: 8),
        TextField(controller: _note, style: const TextStyle(fontSize: 15), decoration: _dec('Ghi chú tuỳ ý...')),
        gap,
        // Bill-split receive info
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate200)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_isPayAcct ? 'Mã QR nhận tiền (chia bill)' : 'Thông tin nhận tiền (chia bill)', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black)),
            const SizedBox(height: 4),
            const Text('Dùng khi bạn chia bill một giao dịch — lưu 1 lần, dùng lại cho các lần chia sau.', style: TextStyle(fontSize: 12, color: AppColors.slate400)),
            const SizedBox(height: 12),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              GestureDetector(
                onTap: _uploadingQr ? null : _uploadQr,
                onLongPress: _qr.isEmpty ? null : () => setState(() => _qr = ''),
                child: Container(
                  width: 72,
                  height: 72,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.slate200)),
                  child: _uploadingQr
                      ? const Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)))
                      : _qr.isNotEmpty
                          ? Image.network(_qr, fit: BoxFit.cover)
                          : const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Text('+ QR', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.slate400)),
                            ]),
                ),
              ),
              if (!_isPayAcct) ...[
                const SizedBox(width: 12),
                Expanded(child: _field('Số tài khoản đầy đủ', _account, 'VD: 0123456789', kb: TextInputType.number, fmt: [FilteringTextInputFormatter.deny(RegExp(r'\s'))])),
              ],
            ]),
          ]),
        ),
        gap,
        GestureDetector(
          onTap: () => setState(() => _isDefault = !_isDefault),
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(children: [
              _switch(_isDefault),
              const SizedBox(width: 12),
              const Expanded(child: Text('Đặt làm thẻ / tài khoản mặc định', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.black))),
            ]),
          ),
        ),
      ],
    ];
  }

  Widget _swatch(String c) {
    final sel = _color == c;
    final special = c == '#FFFFFF' || c == '#111111';
    return GestureDetector(
      onTap: () => setState(() {
        _color = c;
        if (special) _bankColor = c;
      }),
      child: AnimatedScale(
        scale: sel ? 1.25 : 1,
        duration: const Duration(milliseconds: 150),
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: hexColor(c),
            shape: BoxShape.circle,
            border: special ? Border.all(color: c == '#FFFFFF' ? AppColors.slate300 : const Color(0xFF334155)) : null,
            boxShadow: sel
                ? [
                    const BoxShadow(color: Colors.white, spreadRadius: 2),
                    BoxShadow(color: c == '#111111' ? const Color(0xFFFACC15) : c == '#FFFFFF' ? AppColors.slate400 : AppColors.slate400, spreadRadius: 4),
                  ]
                : null,
          ),
        ),
      ),
    );
  }

  Widget _footer() => Container(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.slate100))),
        child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          if (_isEdit) ...[
            GestureDetector(
              onTap: _saving ? null : _delete,
              child: Container(
                width: 56,
                height: 48,
                decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFECACA))),
                child: const Icon(Icons.delete_outline_rounded, size: 20, color: Color(0xFFEF4444)),
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (_errors.isNotEmpty)
                const Padding(padding: EdgeInsets.only(bottom: 4), child: Text('Vui lòng kiểm tra lại thông tin', style: TextStyle(fontSize: 10, color: AppColors.expense))),
              GestureDetector(
                onTap: _saving ? null : _save,
                child: Container(
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppColors.brand, _gradEnd]),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [BoxShadow(color: AppColors.brand.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4))],
                  ),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(_saving ? 'Đang lưu...' : (_isEdit ? 'Lưu thay đổi' : 'Hoàn tất'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
                  ]),
                ),
              ),
            ]),
          ),
        ]),
      );
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

class _Upper extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) => newValue.copyWith(text: newValue.text.toUpperCase());
}

/// "0928" → "09/28"
class _Expiry extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    var d = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (d.length > 4) d = d.substring(0, 4);
    final out = d.length >= 2 ? '${d.substring(0, 2)}/${d.substring(2)}' : d;
    final fixed = out.endsWith('/') && oldValue.text.length > out.length ? out.substring(0, out.length - 1) : out;
    return TextEditingValue(text: fixed, selection: TextSelection.collapsed(offset: fixed.length));
  }
}
