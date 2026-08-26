import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:chitieu_mobile/main.dart';

void main() {
  testWidgets('App boots to a MaterialApp', (WidgetTester tester) async {
    await tester.pumpWidget(const ProviderScope(child: ChiTieuApp()));
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
