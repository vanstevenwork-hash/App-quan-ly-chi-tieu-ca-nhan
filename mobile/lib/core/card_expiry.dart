import '../models/bank_card.dart';

/// Card expiry + annual-fee reminders — port of client/app/(app)/cards/expiry.

/// "MM/YY" or "YYYY-MM" → last moment of that month.
DateTime? parseExpiry(String s) {
  final a = RegExp(r'^(\d{2})/(\d{2})$').firstMatch(s.trim());
  final b = RegExp(r'^(\d{4})-(\d{1,2})$').firstMatch(s.trim());
  int mm, yyyy;
  if (a != null) {
    mm = int.parse(a[1]!);
    yyyy = 2000 + int.parse(a[2]!);
  } else if (b != null) {
    yyyy = int.parse(b[1]!);
    mm = int.parse(b[2]!);
  } else {
    return null;
  }
  if (mm < 1 || mm > 12) return null;
  return DateTime(yyyy, mm + 1, 0, 23, 59, 59, 999);
}

enum ExpiryStatus { expired, soon, ok }

class ExpiryRow {
  final BankCard card;
  final DateTime expiry;
  final String label; // "07/2027"
  final int days, months;
  final ExpiryStatus status;
  final num annualFee;
  final int feeMonth; // 1-12
  final int feeDays; // days until the next fee charge (large when none)
  final bool feeDueSoon;
  const ExpiryRow(this.card, this.expiry, this.label, this.days, this.months, this.status, this.annualFee, this.feeMonth, this.feeDays, this.feeDueSoon);

  String get remaining {
    if (status == ExpiryStatus.expired) return months.abs() >= 1 ? 'Quá hạn ${months.abs()} tháng' : 'Vừa quá hạn';
    if (months <= 0) return 'Còn ${days < 0 ? 0 : days} ngày';
    return 'Còn $months tháng';
  }
}

const _feeWarnDays = 60;

List<ExpiryRow> expiryRows(List<BankCard> cards, DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  final rows = <ExpiryRow>[];
  for (final c in cards) {
    final exp = parseExpiry(c.expirationDate);
    if (exp == null) continue;
    final days = (exp.difference(today).inHours / 24).ceil();
    final months = (exp.year - now.year) * 12 + (exp.month - now.month);
    final status = days < 0 ? ExpiryStatus.expired : days <= 90 ? ExpiryStatus.soon : ExpiryStatus.ok;
    var feeDays = 1 << 30;
    if (c.annualFee > 0 && status != ExpiryStatus.expired) {
      final feeYear = now.month > exp.month ? now.year + 1 : now.year;
      feeDays = DateTime(feeYear, exp.month, 1).difference(today).inDays;
    }
    rows.add(ExpiryRow(c, exp, '${exp.month.toString().padLeft(2, '0')}/${exp.year}', days, months, status, c.annualFee, exp.month,
        feeDays, c.annualFee > 0 && feeDays <= _feeWarnDays));
  }
  int urgency(ExpiryRow r) => r.feeDueSoon && r.feeDays < r.days ? r.feeDays : r.days;
  rows.sort((a, b) => urgency(a).compareTo(urgency(b)));
  return rows;
}
