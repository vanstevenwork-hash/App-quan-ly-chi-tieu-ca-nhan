import 'package:flutter/material.dart';

import '../core/bank_logos.dart';
import '../core/card_art.dart';
import '../models/bank_card.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// The single "small card" used across the app — port of the web CardThumb.
///  · card has artwork → the artwork (240 px copy)
///  · otherwise → white card with the bank logo, or the bank's initials.
enum CardThumbSize { xs, sm, md, lg }

class CardThumb extends StatelessWidget {
  final BankCard card;
  final CardThumbSize size;
  final bool showLast4;

  const CardThumb({super.key, required this.card, this.size = CardThumbSize.md, this.showLast4 = false});

  static const _dims = {
    CardThumbSize.xs: (w: 30.0, h: 19.0, r: 4.0, logo: 13.0, text: 7.0),
    CardThumbSize.sm: (w: 44.0, h: 28.0, r: 6.0, logo: 18.0, text: 8.0),
    CardThumbSize.md: (w: 54.0, h: 34.0, r: 7.0, logo: 22.0, text: 9.0),
    CardThumbSize.lg: (w: 68.0, h: 43.0, r: 9.0, logo: 28.0, text: 10.0),
  };

  @override
  Widget build(BuildContext context) {
    final s = _dims[size]!;
    final art = cardImageProvider(card.cardImage, small: true);
    final last4 = showLast4 && card.cardNumber.isNotEmpty && size.index >= CardThumbSize.md.index
        ? card.cardNumber.substring(card.cardNumber.length > 4 ? card.cardNumber.length - 4 : 0)
        : '';
    final label = card.bankShortName.isNotEmpty ? card.bankShortName : (card.bankName.isNotEmpty ? card.bankName : 'Thẻ');
    final logo = bankLogo(card.bankShortName, card.bankName);

    Widget body;
    if (art != null) {
      body = Image(image: art, fit: BoxFit.cover, width: s.w, height: s.h, gaplessPlayback: true,
          errorBuilder: (_, _, _) => _fallback(s, label, logo));
    } else {
      body = _fallback(s, label, logo);
    }

    return Semantics(
      label: last4.isEmpty ? label : '$label •••• $last4',
      image: true,
      child: Container(
        width: s.w,
        height: s.h,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(s.r),
          border: Border.all(color: Colors.black.withValues(alpha: 0.07)),
          boxShadow: const [BoxShadow(color: Color(0x1F0F172A), blurRadius: 2, offset: Offset(0, 1))],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(s.r),
          child: Stack(fit: StackFit.expand, children: [
            body,
            if (last4.isNotEmpty)
              Positioned(
                right: 3, bottom: 2,
                child: Text(last4, style: TextStyle(
                  fontSize: s.text, fontWeight: FontWeight.bold, letterSpacing: 0.5, height: 1,
                  color: art != null ? Colors.white : AppColors.slate400,
                  shadows: art != null ? const [Shadow(color: Color(0xCC000000), blurRadius: 2)] : null,
                )),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _fallback(({double w, double h, double r, double logo, double text}) s, String label, String? logo) {
    if (logo != null) {
      return Container(
        color: Colors.white,
        alignment: Alignment.center,
        child: Image.network(logo, height: s.logo, width: s.logo * 1.6, fit: BoxFit.contain,
            errorBuilder: (_, _, _) => _initials(s, label)),
      );
    }
    return _initials(s, label);
  }

  Widget _initials(({double w, double h, double r, double logo, double text}) s, String label) {
    final base = hexColor(card.bankColor.isNotEmpty ? card.bankColor : card.color, fallback: AppColors.primary);
    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: LinearGradient(colors: [base, base.withValues(alpha: 0.8)])),
      child: Text(label.substring(0, label.length < 3 ? label.length : 3).toUpperCase(),
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: s.text + 2, height: 1)),
    );
  }
}

/// Full card artwork as a decoration (with a darkening scrim so white text
/// stays readable) — for the big card faces. Null when the card has no art.
DecorationImage? cardArtDecoration(BankCard card) {
  final img = cardImageProvider(card.cardImage);
  if (img == null) return null;
  return DecorationImage(image: img, fit: BoxFit.cover);
}

/// Gradient scrim layered over artwork on big card faces.
const kArtScrim = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Color(0x61000000), Color(0x1F000000), Color(0x2E000000), Color(0x9E000000)],
  stops: [0, 0.38, 0.62, 1],
);
const kArtTextShadow = [Shadow(color: Color(0x8C000000), blurRadius: 2, offset: Offset(0, 1))];
