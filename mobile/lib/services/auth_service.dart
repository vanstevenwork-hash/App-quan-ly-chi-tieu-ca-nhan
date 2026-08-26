import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../models/user.dart';

/// Auth API. IMPORTANT (same gotcha as the web client): the backend
/// /auth/login and /auth/register return ONLY { token } — no user — so we must
/// fetch the profile from /auth/me afterwards.
class AuthService {
  final _dio = ApiClient.dio;

  Future<User> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    final token = res.data['token'] as String;
    await TokenStore.write(token);
    return _me(fallbackEmail: email);
  }

  Future<User> register(String name, String email, String password) async {
    final res = await _dio.post('/auth/register',
        data: {'name': name, 'email': email, 'password': password});
    final token = res.data['token'] as String;
    await TokenStore.write(token);
    return _me(fallbackEmail: email, fallbackName: name);
  }

  /// Fetches the current user; falls back to a minimal user so a hiccup on
  /// /auth/me never blocks navigation (mirrors the web fix).
  Future<User> _me({String? fallbackEmail, String? fallbackName}) async {
    try {
      final res = await _dio.get('/auth/me');
      return User.fromJson(Map<String, dynamic>.from(res.data));
    } catch (_) {
      return User(
        id: '',
        name: fallbackName ?? (fallbackEmail?.split('@').first ?? ''),
        email: fallbackEmail ?? '',
      );
    }
  }

  /// Restore a session on app launch if a token is already stored.
  Future<User?> restore() async {
    final token = await TokenStore.read();
    if (token == null || token.isEmpty) return null;
    try {
      final res = await _dio.get('/auth/me');
      return User.fromJson(Map<String, dynamic>.from(res.data));
    } catch (_) {
      return null;
    }
  }

  Future<void> logout() => TokenStore.clear();
}
