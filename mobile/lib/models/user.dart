/// Mirrors the web client's `User` shape. The backend `/auth/me` returns
/// { id, email, name, role, avatar, provider } — note `id`, not `_id`.
class User {
  final String id;
  final String name;
  final String email;
  final String avatar;
  final String currency;
  final String role;

  const User({
    required this.id,
    required this.name,
    required this.email,
    this.avatar = '',
    this.currency = 'VND',
    this.role = 'user',
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: (j['id'] ?? j['_id'] ?? '').toString(),
        name: (j['name'] ?? '').toString(),
        email: (j['email'] ?? '').toString(),
        avatar: (j['avatar'] ?? '').toString(),
        currency: (j['currency'] ?? 'VND').toString(),
        role: (j['role'] ?? 'user').toString(),
      );

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'NN';
    final take = parts.length >= 2 ? parts.sublist(parts.length - 2) : parts;
    return take.map((p) => p[0].toUpperCase()).join();
  }
}
