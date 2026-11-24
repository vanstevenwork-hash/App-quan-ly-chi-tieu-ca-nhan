import 'package:chitieu_mobile/models/bank_card.dart';
import 'package:chitieu_mobile/widgets/card_thumb.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

BankCard card({String image = '', String short = 'VPB', String name = 'VPBank'}) => BankCard(
    id: '1', bankName: name, bankShortName: short, cardType: 'credit', cardNumber: '8888', cardHolder: '',
    balance: 0, creditLimit: 0, interestRate: 0, color: '#6C63FF', isDefault: false, cardImage: image);

Widget host(Widget w) => MaterialApp(home: Scaffold(body: Center(child: w)));

void main() {
  testWidgets('card with artwork shows the 240px bundled copy + last 4', (t) async {
    await t.pumpWidget(host(CardThumb(card: card(image: '/cards/VPBank/commcredit.webp'), showLast4: true)));
    final img = t.widget<Image>(find.byType(Image).first);
    expect((img.image as AssetImage).assetName, 'assets/cards/VPBank/commcredit.sm.webp');
    expect(find.text('8888'), findsOneWidget);
    expect(t.getSize(find.byType(CardThumb)), const Size(54, 34));
  });

  testWidgets('unsafe image is ignored → logo/initials fallback', (t) async {
    await t.pumpWidget(host(CardThumb(card: card(image: 'https://evil.com/x.png', short: 'ZZZ', name: 'Unknown'))));
    expect(find.byType(Image), findsNothing); // no logo for an unknown bank either
    expect(find.text('ZZZ'), findsOneWidget);
  });

  testWidgets('known bank without artwork uses the VietQR logo', (t) async {
    await t.pumpWidget(host(CardThumb(card: card(short: 'SHBVN', name: 'Shinhan'))));
    final img = t.widget<Image>(find.byType(Image).first);
    expect((img.image as NetworkImage).url, 'https://cdn.vietqr.io/img/SHBVN.png');
  });
}
