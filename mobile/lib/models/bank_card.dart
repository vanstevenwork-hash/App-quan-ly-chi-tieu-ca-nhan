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
      );
}
