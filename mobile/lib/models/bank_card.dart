/// Mirrors the web client's Card (hooks/useCards.ts). Named BankCard to avoid
/// clashing with Flutter's Card widget.
class BankCard {
  final String id;
  final String bankName;
  final String bankShortName;
  final String cardType; // credit | debit | savings | eWallet | crypto
  final String cardNumber;
  final String cardHolder;
  final num balance;
  final num creditLimit;
  final num interestRate;
  final String color;
  final bool isDefault;
  final num cashbackRate;
  final int paymentDueDay;
  final int statementDay;
  final String cardNetwork; // visa | mastercard | jcb | amex | napas | ''
  final String bankColor;
  final String cardImage; // '/cards/<bank>/<slug>.webp' | Cloudinary URL | ''
  final bool autoDebit; // trích nợ tự động sau sao kê (credit)
  final num cashbackCap; // hoàn tối đa/tháng, 0 = không giới hạn
  final num cashbackMinSpend; // chi tối thiểu/tháng để được hoàn
  final DateTime? maturityDate; // savings: ngày đáo hạn
  final DateTime? depositDate; // savings: ngày gửi
  final int term; // savings: kỳ hạn (tháng)
  final String expirationDate; // 'MM/YY' or 'YYYY-MM'
  final num annualFee; // phí thường niên
  final String receiveQrImage; // QR nhận tiền (chia bill)
  final String receiveAccountNumber;
  final String note;
  final bool sharedLimit; // credit cards of one bank sharing a pooled limit
  final num? effectiveCreditLimit; // server-derived pooled limit (max in group)

  const BankCard({
    required this.id,
    required this.bankName,
    required this.bankShortName,
    required this.cardType,
    required this.cardNumber,
    required this.cardHolder,
    required this.balance,
    required this.creditLimit,
    required this.interestRate,
    required this.color,
    required this.isDefault,
    this.cashbackRate = 0,
    this.paymentDueDay = 0,
    this.statementDay = 0,
    this.cardNetwork = '',
    this.bankColor = '',
    this.cardImage = '',
    this.autoDebit = true,
    this.cashbackCap = 0,
    this.cashbackMinSpend = 0,
    this.maturityDate,
    this.depositDate,
    this.term = 0,
    this.expirationDate = '',
    this.annualFee = 0,
    this.receiveQrImage = '',
    this.receiveAccountNumber = '',
    this.note = '',
    this.sharedLimit = false,
    this.effectiveCreditLimit,
  });

  bool get isCredit => cardType == 'credit';
  bool get isSavings => cardType == 'savings';
  bool get isWallet => cardType == 'eWallet';

  factory BankCard.fromJson(Map<String, dynamic> j) => BankCard(
        id: (j['_id'] ?? j['id'] ?? '').toString(),
        bankName: (j['bankName'] ?? '').toString(),
        bankShortName: (j['bankShortName'] ?? '').toString(),
        cardType: (j['cardType'] ?? 'debit').toString(),
        cardNumber: (j['cardNumber'] ?? '').toString(),
        cardHolder: (j['cardHolder'] ?? '').toString(),
        balance: (j['balance'] ?? 0) as num,
        creditLimit: (j['creditLimit'] ?? 0) as num,
        interestRate: (j['interestRate'] ?? 0) as num,
        color: (j['color'] ?? '#36255C').toString(),
        isDefault: j['isDefault'] == true,
        cashbackRate: (j['cashbackRate'] ?? 0) as num,
        paymentDueDay: (j['paymentDueDay'] ?? 0) is int ? (j['paymentDueDay'] ?? 0) as int : 0,
        statementDay: (j['statementDay'] ?? 0) is int ? (j['statementDay'] ?? 0) as int : 0,
        cardNetwork: (j['cardNetwork'] ?? '').toString(),
        bankColor: (j['bankColor'] ?? '').toString(),
        cardImage: (j['cardImage'] ?? '').toString(),
        autoDebit: j['autoDebit'] != false,
        cashbackCap: (j['cashbackCap'] ?? 0) is num ? (j['cashbackCap'] ?? 0) as num : 0,
        depositDate: j['depositDate'] == null ? null : DateTime.tryParse(j['depositDate'].toString())?.toLocal(),
        expirationDate: (j['expirationDate'] ?? '').toString(),
        annualFee: (j['annualFee'] is num) ? j['annualFee'] as num : 0,
        receiveQrImage: (j['receiveQrImage'] ?? '').toString(),
        receiveAccountNumber: (j['receiveAccountNumber'] ?? '').toString(),
        note: (j['note'] ?? '').toString(),
        sharedLimit: j['sharedLimit'] == true,
        effectiveCreditLimit: j['effectiveCreditLimit'] is num ? j['effectiveCreditLimit'] as num : null,
        term: (j['term'] is num) ? (j['term'] as num).toInt() : 0,
        maturityDate: j['maturityDate'] == null ? null : DateTime.tryParse(j['maturityDate'].toString())?.toLocal(),
        cashbackMinSpend: (j['cashbackMinSpend'] ?? 0) is num ? (j['cashbackMinSpend'] ?? 0) as num : 0,
      );
}
