import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Token storage — the RN/web app kept the JWT in localStorage; on iOS we use
/// the Keychain via flutter_secure_storage so it survives restarts securely.
class TokenStore {
  static const _storage = FlutterSecureStorage(
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
  static const _key = 'token';

  static Future<String?> read() => _storage.read(key: _key);
  static Future<void> write(String token) => _storage.write(key: _key, value: token);
  static Future<void> clear() => _storage.delete(key: _key);
}
