/// Mirrors a notification item from /notifications (server models/Notification.js).
class AppNotification {
  final String id;
  final String title;
  final String message;
  final String type; // transaction | payment | saving | system | general | promo | …
  final bool read;
  final bool isImportant;
  final String icon; // emoji stored by the server ('' = derive from type)
  final String iconBg; // '#RRGGBB'
  final String? actionUrl; // e.g. '/auto-actions'
  final String? relatedModel; // 'Card' | 'AutoAction' | 'Transaction' | …
  final String? relatedId;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.read,
    required this.createdAt,
    this.isImportant = false,
    this.icon = '',
    this.iconBg = '',
    this.actionUrl,
    this.relatedModel,
    this.relatedId,
  });

  AppNotification markedRead() => AppNotification(
      id: id, title: title, message: message, type: type, read: true, createdAt: createdAt, isImportant: isImportant,
      icon: icon, iconBg: iconBg, actionUrl: actionUrl, relatedModel: relatedModel, relatedId: relatedId);

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: (j['_id'] ?? j['id'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        message: (j['message'] ?? j['body'] ?? '').toString(),
        type: (j['type'] ?? 'general').toString(),
        read: j['read'] == true || j['isRead'] == true,
        isImportant: j['isImportant'] == true,
        icon: (j['icon'] ?? '').toString(),
        iconBg: (j['iconBg'] ?? '').toString(),
        actionUrl: j['actionUrl']?.toString(),
        relatedModel: j['relatedModel']?.toString(),
        relatedId: j['relatedId'] is Map ? (j['relatedId']['_id'])?.toString() : j['relatedId']?.toString(),
        createdAt: DateTime.tryParse((j['createdAt'] ?? '').toString())?.toLocal() ?? DateTime.now(),
      );
}
