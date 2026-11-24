import 'bank_card.dart';

/// A card someone shared with me (or an invite to one) — mirrors the web
/// SharedCardItem { share, card, owner } from /card-shares/my-shares|incoming.
class SharedCard {
  final String shareId;
  final String status; // pending | accepted | declined | revoked
  final String permission; // collaborative | view-only
  final BankCard card;
  final String ownerName;
  final String ownerEmail;
  const SharedCard({required this.shareId, required this.status, required this.permission, required this.card, required this.ownerName, required this.ownerEmail});

  static SharedCard? fromJson(Map<String, dynamic> j) {
    final card = j['cardId'];
    if (card is! Map) return null; // card was deleted
    final owner = j['ownerId'];
    return SharedCard(
      shareId: (j['_id'] ?? '').toString(),
      status: (j['status'] ?? '').toString(),
      permission: (j['permission'] ?? 'collaborative').toString(),
      card: BankCard.fromJson(Map<String, dynamic>.from(card)),
      ownerName: owner is Map ? (owner['name'] ?? '').toString() : '',
      ownerEmail: owner is Map ? (owner['email'] ?? '').toString() : '',
    );
  }
}

/// One person a card of mine is shared with (/card-shares/card/:cardId).
class CardShareEntry {
  final String id, email, name, status;
  const CardShareEntry(this.id, this.email, this.name, this.status);
  factory CardShareEntry.fromJson(Map<String, dynamic> j) {
    final u = j['sharedWithUserId'];
    return CardShareEntry(
      (j['_id'] ?? '').toString(),
      (j['sharedWithEmail'] ?? (u is Map ? u['email'] : '') ?? '').toString(),
      u is Map ? (u['name'] ?? '').toString() : '',
      (j['status'] ?? '').toString(),
    );
  }
}
