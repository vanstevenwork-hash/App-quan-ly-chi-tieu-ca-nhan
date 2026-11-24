import 'dart:convert';
import 'dart:io';

import 'package:chitieu_mobile/core/card_art.dart';
import 'package:chitieu_mobile/core/card_catalog.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final catalog = CardCatalog.fromJson(jsonDecode(File('assets/card_catalog.json').readAsStringSync()) as Map<String, dynamic>);

  group('card art', () {
    test('only bundled designs or Cloudinary uploads are accepted', () {
      expect(safeCardImage('/cards/VPBank/commcredit.webp'), '/cards/VPBank/commcredit.webp');
      expect(safeCardImage('https://evil.com/a.png'), isNull);
      expect(safeCardImage('/cards/../x.webp'), isNull);
      expect(thumbSrc('/cards/VPBank/commcredit.webp'), '/cards/VPBank/commcredit.sm.webp');
      expect(thumbSrc('https://res.cloudinary.com/d/image/upload/v1/a.jpg'), 'https://res.cloudinary.com/d/image/upload/w_240,c_limit,f_auto,q_auto/v1/a.jpg');
    });
    test('every catalog design has its asset + thumbnail on disk', () {
      for (final c in catalog.cards) {
        expect(File('assets${c.src}').existsSync(), isTrue, reason: c.src);
        expect(File('assets${thumbSrc(c.src)}').existsSync(), isTrue, reason: '${c.src} thumb');
      }
    });
  });

  group('bank lookup', () {
    test('codes and names resolve to the same bank', () {
      expect(catalog.bankIdOf('VPB'), 'VPBank');
      expect(catalog.bankIdOf('VietinBank'), 'VietinBank');
      expect(catalog.bankIdOf('CTG'), 'VietinBank');
      expect(catalog.bankIdOf('SHBVN'), 'ShinhanBank');
      expect(catalog.bankIdOf('', 'VIB Super Card'), 'VIB');
      expect(catalog.bankIdOf('MoMo'), isNull);
    });
  });

  // Same real card names as client/lib/cardMatch.test.ts — web and app must agree.
  group('matcher (parity with web)', () {
    const cases = [
      ['SHB', 'SHB World Mastercard', 'mastercard', 'SHB/mastercard-world'],
      ['MBBank', 'MBBank mastercard plantium Mastercard', 'mastercard', 'MBBank/mastercard-platinum'],
      ['Techcombank', 'Techcombank Everyday', '', 'Techcombank/visa-platinum-everyday'],
      ['MBBank', 'MBBank jcb ultimate', '', 'MBBank/jcb-ultimate-kim-loai'],
      ['VIB', 'VIB Max Visa', 'visa', 'VIB/maxcard-visa-platinum'],
      ['VPBank', 'VPBank Stepup', '', 'VPBank/step-up-mastercard'],
      ['BIDV', 'BIDV JCB Ulti', '', 'BIDV/jcb-ultimate'],
      ['HSBC', 'HSBC Travel One', '', 'HSBC/travelone'],
      ['VietCapitalBank', 'Bvb jcb sense', '', 'VietCapitalBank/jcb-platinum-sense'],
      ['VIB', 'Vib super card Amex', 'amex', 'VIB/super-card-american-express-platinum'],
      ['VIB', 'VIB 2in1 Mastercard', 'mastercard', 'VIB/mastercard-online-plus-2in1'],
    ];
    for (final c in cases) {
      test(c[1], () {
        final r = catalog.match(bankShortName: c[0], bankName: c[1], cardNetwork: c[2], cardType: 'credit');
        expect(r.confidence, MatchConfidence.high);
        expect(r.best!.design.id, c[3]);
      });
    }
    test('no design with that product name is flagged', () {
      final r = catalog.match(bankShortName: 'ShinhanBank', bankName: 'ShinhanBank mylife', cardType: 'credit');
      expect(r.confidence, MatchConfidence.low);
      expect(r.noNameMatch, isTrue);
    });
    test('bank without designs → none', () {
      expect(catalog.match(bankShortName: 'Citibank', bankName: 'Citibank', cardType: 'credit').confidence, MatchConfidence.none);
    });
    test('bank name only → low-confidence guess on the right network', () {
      final r = catalog.match(bankShortName: 'TCB', bankName: 'Techcombank', cardNetwork: 'visa', cardType: 'credit');
      expect(r.confidence, MatchConfidence.low);
      expect(r.best!.design.network, 'visa');
    });
  });
}
