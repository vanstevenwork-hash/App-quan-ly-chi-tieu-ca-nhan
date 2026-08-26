import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:chitieu_mobile/theme/app_theme.dart';
import 'package:chitieu_mobile/constants/categories.dart';
import 'package:chitieu_mobile/models/user.dart';
import 'package:chitieu_mobile/models/transaction.dart';
import 'package:chitieu_mobile/models/summary.dart';
import 'package:chitieu_mobile/models/bank_card.dart';
import 'package:chitieu_mobile/models/goal.dart';
import 'package:chitieu_mobile/widgets/common.dart';

void main() {
  group('money formatting', () {
    test('formatMoney adds thousands separators', () {
      expect(formatMoney(0), '0');
      expect(formatMoney(1000), '1,000');
      expect(formatMoney(1234567), '1,234,567');
      expect(formatMoney(-2500), '-2,500');
    });

    test('formatCompact abbreviates VND amounts', () {
      expect(formatCompact(500), '500');
      expect(formatCompact(12000), '12k');
      expect(formatCompact(2500000), '2.5tr');
      expect(formatCompact(3000000000), '3.0 tỷ');
      expect(formatCompact(-45000), '-45k');
    });
  });

  group('categories', () {
    test('categoryByLabel finds a known category', () {
      final c = categoryByLabel('Ăn uống');
      expect(c.id, 'food');
      expect(c.emoji, '🍜');
    });

    test('categoryByLabel falls back to Khác', () {
      expect(categoryByLabel('không tồn tại').id, 'other');
    });

    test('categoriesFor splits income vs expense', () {
      expect(categoriesFor(true).every((c) => c.isIncome), isTrue);
      expect(categoriesFor(false).any((c) => c.isIncome), isFalse);
      expect(categoriesFor(true).map((c) => c.label), contains('Lương'));
    });
  });

  group('models', () {
    test('User.fromJson maps id and derives initials', () {
      final u = User.fromJson({'id': 'abc', 'name': 'Nguyễn Văn A', 'email': 'a@b.com'});
      expect(u.id, 'abc');
      expect(u.email, 'a@b.com');
      expect(u.initials, 'VA');
    });

    test('User.initials handles single word / empty', () {
      expect(User.fromJson({'name': 'Sivan'}).initials, 'S');
      expect(User.fromJson({}).initials, 'NN');
    });

    test('TransactionModel.fromJson parses type & amount', () {
      final t = TransactionModel.fromJson({
        '_id': 't1', 'type': 'income', 'amount': 50000,
        'category': 'Lương', 'note': 'tháng 8', 'date': '2026-08-01T00:00:00Z',
      });
      expect(t.id, 't1');
      expect(t.isIncome, isTrue);
      expect(t.amount, 50000);
      expect(t.category, 'Lương');
    });

    test('Summary.fromJson', () {
      final s = Summary.fromJson({'income': 100, 'expense': 40, 'balance': 60});
      expect(s.income, 100);
      expect(s.balance, 60);
    });

    test('BankCard.fromJson + type flags', () {
      final c = BankCard.fromJson({'_id': 'c1', 'bankShortName': 'VCB', 'cardType': 'credit', 'balance': 2000000});
      expect(c.isCredit, isTrue);
      expect(c.isSavings, isFalse);
      expect(c.balance, 2000000);
    });

    test('Goal.pct clamps to 0..100', () {
      expect(Goal.fromJson({'targetAmount': 1000, 'currentAmount': 250}).pct, 25);
      expect(Goal.fromJson({'targetAmount': 1000, 'currentAmount': 5000}).pct, 100);
      expect(Goal.fromJson({'targetAmount': 0, 'currentAmount': 100}).pct, 0);
    });
  });

  group('hexColor', () {
    test('parses #RRGGBB', () {
      expect(hexColor('#8B5CF6'), const Color(0xFF8B5CF6));
      expect(hexColor('10B981'), const Color(0xFF10B981));
    });
    test('bad input falls back', () {
      expect(hexColor('nope', fallback: AppColors.brand), AppColors.brand);
    });
  });
}
