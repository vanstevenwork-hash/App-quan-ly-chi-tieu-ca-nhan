import 'package:shared_preferences/shared_preferences.dart';

/// Small per-device preferences (recent searches, copied voucher codes…) —
/// the web keeps these in localStorage. Never used for anything that must
/// sync across devices.
class Prefs {
  static Future<List<String>> list(String key) async {
    try {
      return (await SharedPreferences.getInstance()).getStringList(key) ?? const [];
    } catch (_) {
      return const [];
    }
  }

  static Future<void> setList(String key, List<String> value) async {
    try {
      await (await SharedPreferences.getInstance()).setStringList(key, value);
    } catch (_) {/* best effort */}
  }
}

/// Boolean preferences (e.g. hide balances on open).
class PrefFlags {
  static const hideBalance = 'hideBalanceOnOpen';

  static Future<bool> get(String key, {bool fallback = false}) async {
    try {
      return (await SharedPreferences.getInstance()).getBool(key) ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  static Future<void> set(String key, bool value) async {
    try {
      await (await SharedPreferences.getInstance()).setBool(key, value);
    } catch (_) {}
  }
}
