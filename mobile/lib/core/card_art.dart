import 'package:flutter/widgets.dart';

/// Card artwork helpers — Dart port of client/lib/cardArt.ts.
///
/// Stored `cardImage` values are either a bundled design
/// (`/cards/<bank>/<slug>.webp`, shipped in assets/cards/) or the user's own
/// Cloudinary upload. Anything else is ignored.
final _safe = RegExp(r'^(/cards/[\w./-]+\.webp|https://res\.cloudinary\.com/[\w.\-/%]+)$');

String? safeCardImage(String? url) {
  if (url == null) return null;
  final u = url.trim();
  return u.isNotEmpty && _safe.hasMatch(u) && !u.contains('..') ? u : null;
}

/// Small (240 px) variant for thumbnails / pickers, like the web `thumbSrc`.
String? thumbSrc(String? url) {
  final safe = safeCardImage(url);
  if (safe == null) return null;
  if (safe.startsWith('/cards/')) return safe.endsWith('.sm.webp') ? safe : safe.replaceFirst(RegExp(r'\.webp$'), '.sm.webp');
  return safe.replaceFirst('/image/upload/', '/image/upload/w_240,c_limit,f_auto,q_auto/');
}

/// ImageProvider for a card image: bundled designs come from assets, uploads
/// from the network. [small] picks the 240 px copy.
ImageProvider? cardImageProvider(String? url, {bool small = false}) {
  final src = small ? thumbSrc(url) : safeCardImage(url);
  if (src == null) return null;
  if (src.startsWith('/cards/')) return AssetImage('assets$src');
  return NetworkImage(src);
}
