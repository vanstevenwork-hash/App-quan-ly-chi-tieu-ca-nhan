import 'package:chitieu_mobile/features/goals/goals_screen.dart';
import 'package:chitieu_mobile/features/savings/savings_screen.dart';
import 'package:chitieu_mobile/models/bank_card.dart';
import 'package:chitieu_mobile/models/goal.dart';
import 'package:chitieu_mobile/state/finance_providers.dart';
import 'package:chitieu_mobile/widgets/common.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

// A failed request (sleeping Render, no network) must show the retry state —
// never crash the build. Riverpod 2's AsyncValue.value rethrows on error, so
// screens read `valueOrNull`.
void main() {
  Widget host(Widget child, List<Override> overrides) =>
      ProviderScope(overrides: overrides, child: MaterialApp(home: child));

  testWidgets('Tiết kiệm shows retry when cards fail to load', (t) async {
    await t.pumpWidget(host(const SavingsScreen(), [
      cardsProvider.overrideWith((ref) => Future<List<BankCard>>.error(Exception('timeout'))),
    ]));
    await t.pump();
    await t.pump();
    expect(t.takeException(), isNull);
    expect(find.byType(ErrorRetry), findsOneWidget);
  });

  testWidgets('Mục tiêu shows retry when goals fail to load', (t) async {
    await t.pumpWidget(host(const GoalsScreen(), [
      goalsProvider.overrideWith((ref) => Future<List<Goal>>.error(Exception('timeout'))),
    ]));
    await t.pump();
    await t.pump();
    expect(t.takeException(), isNull);
    expect(find.byType(ErrorRetry), findsOneWidget);
  });
}
