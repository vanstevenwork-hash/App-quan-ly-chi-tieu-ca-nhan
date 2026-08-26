import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final User? user;
  const AuthState({this.status = AuthStatus.unknown, this.user});

  AuthState copyWith({AuthStatus? status, User? user}) =>
      AuthState(status: status ?? this.status, user: user ?? this.user);

  bool get isAuthenticated => status == AuthStatus.authenticated;
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._service) : super(const AuthState()) {
    // Any 401 on a protected call drops us back to logged-out.
    ApiClient.onUnauthorized = () {
      state = const AuthState(status: AuthStatus.unauthenticated);
    };
    _restore();
  }

  final AuthService _service;

  // Dev-only auto-login (passed via --dart-define); empty in real builds.
  static const _autoEmail = String.fromEnvironment('AUTO_LOGIN_EMAIL');
  static const _autoPass = String.fromEnvironment('AUTO_LOGIN_PASSWORD');

  Future<void> _restore() async {
    final user = await _service.restore();
    if (user != null) {
      state = AuthState(status: AuthStatus.authenticated, user: user);
      return;
    }
    if (_autoEmail.isNotEmpty && _autoPass.isNotEmpty) {
      try {
        await login(_autoEmail, _autoPass);
        return;
      } catch (_) {/* fall through to unauthenticated */}
    }
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  Future<void> login(String email, String password) async {
    final user = await _service.login(email, password);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> register(String name, String email, String password) async {
    final user = await _service.register(name, email, password);
    state = AuthState(status: AuthStatus.authenticated, user: user);
  }

  Future<void> logout() async {
    await _service.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final authServiceProvider = Provider<AuthService>((_) => AuthService());

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(ref.read(authServiceProvider)),
);
