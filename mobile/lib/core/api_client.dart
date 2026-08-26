import 'package:dio/dio.dart';
import 'secure_storage.dart';

/// dio wrapper mirroring the web client's axios setup: attaches the JWT to every
/// request and, on a 401 from a non-auth endpoint, clears the session and pings
/// [onUnauthorized] so the app can bounce back to the login screen.
class ApiClient {
  // iOS Simulator shares the Mac's network, so localhost works there. For a
  // real iPhone, point this at your Mac's LAN IP (e.g. http://192.168.1.10:8000/api).
  static const baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:8000/api',
  );

  /// Set by the auth layer; called when the token is rejected.
  static void Function()? onUnauthorized;

  static final Dio dio = _build();

  static Dio _build() {
    final d = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
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
