/// Mirrors a notification item from /notifications.
class AppNotification {
  final String id;
  final String title;
  final String message;
  final String type;
  final bool read;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.read,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: (j['_id'] ?? j['id'] ?? '').toString(),
        title: (j['title'] ?? '').toString(),
        message: (j['message'] ?? j['body'] ?? '').toString(),
        type: (j['type'] ?? 'info').toString(),
        read: j['read'] == true || j['isRead'] == true,
        createdAt: DateTime.tryParse((j['createdAt'] ?? '').toString())?.toLocal() ?? DateTime.now(),
      );
}
