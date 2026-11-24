import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/services.dart' show rootBundle;

/// Bundled card designs + name matcher — Dart port of client/lib/cardCatalog.ts
/// and client/lib/cardMatch.ts (same scoring, so web and app agree).
/// Data: assets/card_catalog.json (synced by tool/sync_card_assets.py).

class CardDesign {
  final String id, bank, name, network, type, src;
  const CardDesign({required this.id, required this.bank, required this.name, required this.network, required this.type, required this.src});

  factory CardDesign.fromJson(Map<String, dynamic> j) => CardDesign(
        id: j['id'] as String,
        bank: j['bank'] as String,
        name: j['name'] as String,
        network: (j['network'] ?? '') as String,
        type: (j['type'] ?? 'credit') as String,
        src: j['src'] as String,
      );
}

class DesignMatch {
  final CardDesign design;
  final double score;
  final int nameHits;
  const DesignMatch(this.design, this.score, this.nameHits);
}

enum MatchConfidence { high, low, none }

class MatchResult {
  final DesignMatch? best;
  final MatchConfidence confidence;
  final bool noNameMatch; // label names a product no design carries
  final List<DesignMatch> candidates;
  const MatchResult(this.best, this.confidence, this.noNameMatch, this.candidates);
  static const empty = MatchResult(null, MatchConfidence.none, false, []);
}

String _fold(String s) {
  const from = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
  const to = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
  final lower = s.toLowerCase();
  final b = StringBuffer();
  for (final ch in lower.split('')) {
    final i = from.indexOf(ch);
    b.write(i >= 0 ? to[i] : ch);
  }
  return b.toString();
}

String _normKey(String? s) => _fold(s ?? '').toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

const _generic = {
  'the', 'card', 'tin', 'dung', 'ghi', 'no', 'quoc', 'te', 'ngan', 'hang', 'bank', 'tmcp', 'viet', 'nam',
  'cong', 'thuong', 'credit', 'debit', 'cua', 'toi', 'chinh', 'phu', 'moi', 'cu', 'my',
};
const _networkWords = {'visa': 'visa', 'mastercard': 'mastercard', 'master': 'mastercard', 'mc': 'mastercard', 'jcb': 'jcb', 'amex': 'amex', 'napas': 'napas'};

class CardCatalog {
  final Map<String, ({String name, List<String> aliases})> banks;
  final List<CardDesign> cards;
  late final Map<String, String> _lookup;
  late final Set<String> _bankWords;

  CardCatalog(this.banks, this.cards) {
    _lookup = {};
    _bankWords = {};
    banks.forEach((id, b) {
      _lookup[_normKey(id)] = id;
      _lookup[_normKey(b.name)] = id;
      for (final a in b.aliases) {
        _lookup[_normKey(a)] = id;
      }
      for (final x in [id, b.name, ...b.aliases]) {
        _bankWords.addAll(_fold(x).split(RegExp(r'[^a-z0-9]+')).where((w) => w.isNotEmpty));
      }
      _bankWords.add(_fold(id).replaceAll(RegExp(r'[^a-z0-9]'), ''));
    });
  }

  factory CardCatalog.fromJson(Map<String, dynamic> j) {
    final banks = <String, ({String name, List<String> aliases})>{};
    (j['banks'] as Map).forEach((k, v) {
      banks[k as String] = (name: v['name'] as String, aliases: List<String>.from(v['aliases'] as List));
    });
    final cards = (j['cards'] as List).map((e) => CardDesign.fromJson(Map<String, dynamic>.from(e as Map))).toList();
    return CardCatalog(banks, cards);
  }

  static CardCatalog? _cache;
  static Future<CardCatalog> load() async =>
      _cache ??= CardCatalog.fromJson(jsonDecode(await rootBundle.loadString('assets/card_catalog.json')) as Map<String, dynamic>);

  String? bankIdOf(String? bankShortName, [String? bankName]) {
    final hit = _lookup[_normKey(bankShortName)] ?? _lookup[_normKey(bankName)];
    if (hit != null) return hit;
    for (final w in (bankName ?? '').split(RegExp(r'\s+'))) {
      final id = _lookup[_normKey(w)];
      if (id != null) return id;
    }
    return null;
  }

  /// Designs for a bank — the requested type first.
  List<CardDesign> designsFor(String? bankShortName, String? bankName, [String? type]) {
    final id = bankIdOf(bankShortName, bankName);
    if (id == null) return const [];
    final list = cards.where((c) => c.bank == id).toList();
    if (type != 'credit' && type != 'debit') return list;
    return [...list.where((c) => c.type == type), ...list.where((c) => c.type != type)];
  }

  CardDesign? designBySrc(String? src) {
    for (final c in cards) {
      if (c.src == src) return c;
    }
    return null;
  }

  List<String> productWords(String label) => _fold(label)
      .split(RegExp(r'[^a-z0-9]+'))
      .where((w) => w.isNotEmpty && !_generic.contains(w) && !_bankWords.contains(w) && !_networkWords.containsKey(w))
      .toList();

  String _networkInLabel(String label) {
    for (final w in _fold(label).split(RegExp(r'[^a-z0-9]+'))) {
      final n = _networkWords[w];
      if (n != null) return n;
    }
    return '';
  }

  MatchResult match({String? bankShortName, String? bankName, String? cardNetwork, String? cardType}) {
    if (bankIdOf(bankShortName, bankName) == null) return MatchResult.empty;
    final designs = designsFor(bankShortName, bankName, cardType);
    if (designs.isEmpty) return MatchResult.empty;

    final label = bankName ?? '';
    final words = productWords(label);
    final network = (cardNetwork ?? '').isNotEmpty ? cardNetwork! : _networkInLabel(label);
    final type = cardType == 'debit' ? 'debit' : cardType == 'credit' ? 'credit' : '';

    final scored = designs.map((d) {
      final dList = productWords(d.name);
      final hits = countHits(words, dList);
      double score = hits * 10.0;
      if (network.isNotEmpty && d.network.isNotEmpty) score += d.network == network ? 4 : -6;
      if (type.isNotEmpty) score += d.type == type ? 2 : -4;
      if (words.isEmpty) score -= dList.length * 0.1;
      return DesignMatch(d, score, hits);
    }).toList()
      ..sort((a, b) {
        final s = b.score.compareTo(a.score);
        return s != 0 ? s : a.design.name.length.compareTo(b.design.name.length);
      });

    final best = scored.first;
    final runnerUp = scored.length > 1 ? scored[1] : null;
    final high = best.nameHits > 0 && best.nameHits == words.length && (runnerUp == null || best.score > runnerUp.score);
    return MatchResult(best, high ? MatchConfidence.high : MatchConfidence.low, words.isNotEmpty && best.nameHits == 0,
        scored.take(12).toList());
  }
}

/// Damerau–Levenshtein (optimal string alignment) distance.
int editDistance(String a, String b) {
  if ((a.length - b.length).abs() > 2) return 3;
  final d = List.generate(a.length + 1, (i) => List<int>.filled(b.length + 1, 0)..[0] = i);
  for (var j = 1; j <= b.length; j++) {
    d[0][j] = j;
  }
  for (var i = 1; i <= a.length; i++) {
    for (var j = 1; j <= b.length; j++) {
      final cost = a[i - 1] == b[j - 1] ? 0 : 1;
      d[i][j] = math.min(math.min(d[i - 1][j] + 1, d[i][j - 1] + 1), d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) d[i][j] = math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

bool _wordHits(String w, List<String> dList, String joined) {
  if (dList.contains(w)) return true;
  if (w.length >= 3 && dList.any((d) => d.startsWith(w))) return true;
  if (w.length >= 5 && dList.any((d) => editDistance(w, d) <= (w.length >= 7 ? 2 : 1))) return true;
  return w.length >= 5 && joined.contains(w);
}

int countHits(List<String> words, List<String> dList) {
  final joined = dList.join();
  var hits = 0;
  for (var i = 0; i < words.length; i++) {
    if (i + 1 < words.length && dList.contains(words[i] + words[i + 1])) {
      hits += 2;
      i++;
      continue;
    }
    if (_wordHits(words[i], dList, joined)) hits++;
  }
  return hits;
}
