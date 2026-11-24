import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kReleaseMode;
import 'secure_storage.dart';

/// dio wrapper mirroring the web client's axios setup: attaches the JWT to every
/// request and, on a 401 from a non-auth endpoint, clears the session and pings
/// [onUnauthorized] so the app can bounce back to the login screen.
class ApiClient {
  // --dart-define=API_URL=… wins. Otherwise release builds (TestFlight /
  // App Store) talk to production on Render, debug builds to the local server
  // (the iOS Simulator shares the Mac's network, so localhost works there).
  static const _override = String.fromEnvironment('API_URL');
  static const _production = 'https://app-quan-ly-chi-tieu-ca-nhan.onrender.com/api';
  static String get baseUrl => _override.isNotEmpty ? _override : (kReleaseMode ? _production : 'http://localhost:8000/api');

  /// Set by the auth layer; called when the token is rejected.
  static void Function()? onUnauthorized;

  static final Dio dio = _build();

  static Dio _build() {
    final d = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 20),
      // Render's free tier sleeps; the first request after a nap can take
      // 30-50s while it boots — don't fail it as a timeout.
      receiveTimeout: const Duration(seconds: 60),
      headers: {'Content-Type': 'application/json'},
    ));

    d.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await TokenStore.read();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        final path = e.requestOptions.path;
        final isAuthReq = path.contains('/auth/login') || path.contains('/auth/register');
        if (e.response?.statusCode == 401 && !isAuthReq) {
          await TokenStore.clear();
          onUnauthorized?.call();
        }
        handler.next(e);
      },
    ));
    return d;
  }
}
