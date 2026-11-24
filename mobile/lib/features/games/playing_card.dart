import 'package:flutter/material.dart';

/// One card {rank, suit, id} drawn in code (port of components/games/PlayingCard).
class PlayingCardView extends StatelessWidget {
  final Map<String, dynamic>? card; // null → face down
  final double width;
  final bool selected;
  final VoidCallback? onTap;
  const PlayingCardView({super.key, this.card, this.width = 52, this.selected = false, this.onTap});

  static const _suit = {'spades': '♠', 'clubs': '♣', 'diamonds': '♦', 'hearts': '♥'};

  @override
  Widget build(BuildContext context) {
    final h = width * 1.42;
    final c = card;
    final red = c != null && (c['suit'] == 'diamonds' || c['suit'] == 'hearts');
    final color = red ? const Color(0xFFDC2626) : const Color(0xFF0F172A);
    final body = AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      width: width,
      height: h,
      transform: Matrix4.translationValues(0, selected ? -14 : 0, 0),
      decoration: BoxDecoration(
        color: c == null ? null : Colors.white,
        gradient: c == null ? const LinearGradient(colors: [Color(0xFF6D28D9), Color(0xFF4338CA)]) : null,
        borderRadius: BorderRadius.circular(width * 0.14),
        border: Border.all(color: selected ? const Color(0xFFF59E0B) : const Color(0x22000000), width: selected ? 2.5 : 1),
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: c == null
          ? Center(child: Icon(Icons.style, color: Colors.white.withValues(alpha: 0.5), size: width * 0.4))
          : Stack(children: [
              Positioned(
                left: width * 0.1, top: width * 0.06,
                child: Column(children: [
                  Text(c['rank'].toString(), style: TextStyle(fontSize: width * 0.3, fontWeight: FontWeight.w900, color: color, height: 1)),
                  Text(_suit[c['suit']] ?? '', style: TextStyle(fontSize: width * 0.26, color: color, height: 1.1)),
                ]),
              ),
              Center(child: Padding(
                padding: EdgeInsets.only(top: h * 0.18),
                child: Text(_suit[c['suit']] ?? '', style: TextStyle(fontSize: width * 0.55, color: color)),
              )),
            ]),
    );
    return onTap == null ? body : GestureDetector(onTap: onTap, child: body);
  }
}
