import 'package:flutter/material.dart';

/// Ported from client/lib/mockData.ts CATEGORIES. Uses the same emoji + colour
/// so transactions look identical to the web app.
class ExpenseCategory {
  final String id;
  final String label;
  final String emoji;
  final Color color;
  final String iconType; // matches the web's catIconType SVG asset name
  final bool isIncome;
  const ExpenseCategory(this.id, this.label, this.emoji, this.color, this.iconType, {this.isIncome = false});

  String get iconAsset => 'assets/icons/$iconType.svg';
}

const List<ExpenseCategory> kCategories = [
  ExpenseCategory('food', 'Ăn uống', '🍜', Color(0xFFF59E0B), 'anUong'),
  ExpenseCategory('shopping', 'Mua sắm', '🛍️', Color(0xFF8B5CF6), 'muaSam'),
  ExpenseCategory('transport', 'Di chuyển', '🚗', Color(0xFF3B82F6), 'diChuyen'),
  ExpenseCategory('entertainment', 'Giải trí', '🎮', Color(0xFFEC4899), 'giaiTri'),
  ExpenseCategory('health', 'Sức khỏe', '💊', Color(0xFF10B981), 'sucKhoe'),
  ExpenseCategory('education', 'Học tập', '📚', Color(0xFFF97316), 'hocTap'),
  ExpenseCategory('bills', 'Hóa đơn', '💡', Color(0xFFEF4444), 'hoaDon'),
  ExpenseCategory('credit-pay', 'Trả thẻ tín dụng', '💳', Color(0xFFDC2626), 'traTheTinDung'),
  ExpenseCategory('crypto', 'Crypto', '₿', Color(0xFFF7931A), 'crypto'),
  ExpenseCategory('salary', 'Lương', '💰', Color(0xFF22C55E), 'luong', isIncome: true),
  ExpenseCategory('freelance', 'Freelance', '💻', Color(0xFF06B6D4), 'freelance', isIncome: true),
  ExpenseCategory('investment', 'Đầu tư', '📈', Color(0xFF6C63FF), 'dauTu', isIncome: true),
  ExpenseCategory('bonus', 'Thưởng', '🎁', Color(0xFFA855F7), 'thuong', isIncome: true),
  ExpenseCategory('interest', 'Tiền lãi', '🏦', Color(0xFF14B8A6), 'tienLai', isIncome: true),
  ExpenseCategory('other', 'Khác', '📦', Color(0xFF6B7280), 'khac'),
];

final ExpenseCategory _fallback = kCategories.last;

ExpenseCategory categoryByLabel(String label) {
  for (final c in kCategories) {
    if (c.label == label) return c;
  }
  return _fallback;
}

List<ExpenseCategory> categoriesFor(bool income) =>
    kCategories.where((c) => income ? c.isIncome : !c.isIncome).toList();
