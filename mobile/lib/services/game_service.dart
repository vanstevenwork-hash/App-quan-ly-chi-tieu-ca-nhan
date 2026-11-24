import '../core/api_client.dart';

/// REST side of the card games (client/lib/api.ts gameMatchesApi). Matches are
/// passed around as raw maps — the server is authoritative for all rules.
class GameService {
  final _dio = ApiClient.dio;

  Map<String, dynamic> _obj(dynamic d) {
    final p = (d is Map && d['data'] != null) ? d['data'] : d;
    return p is Map ? Map<String, dynamic>.from(p) : <String, dynamic>{};
  }

  List<Map<String, dynamic>> _list(dynamic d) {
    final p = (d is Map && d['data'] != null) ? d['data'] : d;
    return p is List ? p.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : const [];
  }

  Future<Map<String, dynamic>> createRoom(String gameType, {int turnSeconds = 30, int maxPlayers = 2}) async =>
      _obj((await _dio.post('/game-matches/room', data: {'gameType': gameType, 'turnSeconds': turnSeconds, 'maxPlayers': maxPlayers})).data);
  Future<Map<String, dynamic>> invite(List<String> emails, String gameType, {int turnSeconds = 30}) async =>
      _obj((await _dio.post('/game-matches/invite', data: {'emails': emails, 'gameType': gameType, 'turnSeconds': turnSeconds})).data);
  Future<Map<String, dynamic>> joinByCode(String code) async => _obj((await _dio.post('/game-matches/join/$code')).data);
  Future<void> startNow(String id) => _dio.post('/game-matches/$id/start');
  Future<Map<String, dynamic>> respond(String id, bool accept) async => _obj((await _dio.patch('/game-matches/$id/respond', data: {'accept': accept})).data);
  Future<List<Map<String, dynamic>>> incoming() async => _list((await _dio.get('/game-matches/incoming')).data);
  Future<List<Map<String, dynamic>>> sent() async => _list((await _dio.get('/game-matches/sent')).data);
  Future<List<Map<String, dynamic>>> active() async => _list((await _dio.get('/game-matches/active')).data);
  Future<Map<String, dynamic>> stats() async => _obj((await _dio.get('/game-matches/stats')).data);
  Future<Map<String, dynamic>> getById(String id) async => _obj((await _dio.get('/game-matches/$id')).data);
  Future<void> cancel(String id) => _dio.delete('/game-matches/$id');
  Future<void> leave(String id) => _dio.post('/game-matches/$id/leave');
  Future<Map<String, dynamic>> rematch(String id) async => _obj((await _dio.post('/game-matches/$id/rematch')).data);
}

const kGameLabels = {'tien_len': 'Tiến lên miền Nam', 'phom': 'Phỏm'};
