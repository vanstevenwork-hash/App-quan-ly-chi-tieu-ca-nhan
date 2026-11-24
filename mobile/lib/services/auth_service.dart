import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../models/user.dart';

/// Auth API. The backend /auth/login and /auth/register return ONLY { token },
/// so the profile is fetched from /auth/me (flat, safe fields) afterwards.
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
  /// Re-read the profile after it changed (name / email).
  Future<User> reload() => _me();

  /// GET /auth/me, or /auth/profile on a backend that predates /auth/me.
  Future<User> _fetchMe() async {
    try {
      return _parse((await _dio.get('/auth/me')).data);
    } on DioException catch (e) {
      if (e.response?.statusCode != 404) rethrow;
      return _parse((await _dio.get('/auth/profile')).data);
    }
  }

  Future<User> _me({String? fallbackEmail, String? fallbackName}) async {
    try {
      return await _fetchMe();
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
      return await _fetchMe();
    } on DioException catch (e) {
      // Only a rejected token ends the session. A network blip or a sleeping
      // server (Render free tier) must not log the user out on every launch —
      // keep the session and let the app reload the profile later.
      if (e.response?.statusCode == 401) return null;
      return const User(id: '', name: '', email: '');
    } catch (_) {
      return const User(id: '', name: '', email: '');
    }
  }

  /// /auth/me is flat; /auth/profile wraps it in { user } — accept both.
  User _parse(dynamic data) {
    final m = Map<String, dynamic>.from(data as Map);
    return User.fromJson(m['user'] is Map ? Map<String, dynamic>.from(m['user'] as Map) : m);
  }

  Future<void> logout() => TokenStore.clear();
}
