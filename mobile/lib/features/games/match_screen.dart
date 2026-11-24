import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../core/api_client.dart';
import '../../core/secure_storage.dart';
import '../../services/game_service.dart';
import '../../state/auth_provider.dart';
import 'games_screen.dart';
import 'playing_card.dart';

/// Live card table — port of client/app/(app)/games/[matchId]/page.tsx +
/// useGameMatchStore. The server is authoritative: this screen only renders
/// the per-player view it pushes (`match:state`) and sends moves.
class MatchScreen extends ConsumerStatefulWidget {
  final String matchId;
  const MatchScreen({super.key, required this.matchId});
  @override
  ConsumerState<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends ConsumerState<MatchScreen> {
  static const _quick = ['Hay lắm', 'Đợi chút', 'Tới đi', 'Mạnh tay quá'];
  static const _emojis = ['😀', '😂', '😎', '😮', '😢', '😡', '👍', '👏', '🔥', '🎉'];

  io.Socket? _socket;
  Map<String, dynamic>? _state; // match:state
  Map<String, dynamic>? _ended; // match:ended
  Map<String, String> _names = {};
  final List<Map<String, dynamic>> _chat = [];
  final Set<String> _selected = {};
  String? _error;
  String _conn = 'connecting';
  // Waiting room (open room with a join code)
  String? _joinCode;
  String? _hostId;
  int _joined = 1, _max = 2;
  Timer? _poll, _tick;
  bool _starting = false, _rematching = false;

  GameService get _svc => ref.read(gameServiceProvider);
  String get _me => ref.read(authProvider).user?.id ?? '';

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(milliseconds: 500), (_) {
      if (mounted && _state?['turnExpiresAt'] != null) setState(() {});
    });
    _load();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _tick?.cancel();
    _disconnect();
    super.dispose();
  }

  void _readPlayers(Map<String, dynamic> m) {
    final players = (m['players'] as List? ?? const []).whereType<Map>();
    _names = {for (final p in players) p['_id'].toString(): (p['name'] ?? 'Người chơi').toString()};
    _joined = players.length;
    _max = ((m['settings'] as Map?)?['maxPlayers'] as num?)?.toInt() ?? 2;
  }

  Future<void> _load() async {
    try {
      final m = await _svc.getById(widget.matchId);
      if (!mounted) return;
      final status = m['status'];
      setState(() => _readPlayers(m));
      if (status == 'pending_invite') {
        if ((m['joinCode'] ?? '').toString().isEmpty) {
          return setState(() => _error = 'Ván đấu chưa bắt đầu — chờ đối thủ chấp nhận lời mời');
        }
        setState(() {
          _joinCode = m['joinCode'].toString();
          _hostId = (m['hostId'] is Map ? m['hostId']['_id'] : m['hostId'])?.toString();
        });
        // Live headcount while the room fills (socket only pushes once it starts).
        _poll = Timer.periodic(const Duration(milliseconds: 2500), (_) async {
          if (_state != null) return _poll?.cancel();
          try {
            final x = await _svc.getById(widget.matchId);
            if (mounted) setState(() => _readPlayers(x));
          } catch (_) {}
        });
      } else if (status == 'abandoned') {
        return setState(() => _error = 'Ván đấu đã kết thúc — một người chơi đã rời khỏi ván');
      } else if (status == 'declined') {
        return setState(() => _error = 'Lời mời chơi đã bị từ chối');
      }
      await _connect();
    } catch (e) {
      if (mounted) setState(() => _error = _msg(e, 'Không thể tải ván đấu'));
    }
  }

  String _msg(Object e, String fb) {
    if (e is DioException && e.response?.data is Map) {
      final m = (e.response!.data['message'] ?? '').toString();
      if (m.isNotEmpty) return m;
    }
    return fb;
  }

  Future<void> _connect() async {
    final token = await TokenStore.read();
    final origin = ApiClient.baseUrl.replaceFirst(RegExp(r'/api/?$'), '');
    final s = io.io('$origin/games', io.OptionBuilder().setTransports(['websocket']).setAuth({'token': token}).disableAutoConnect().build());
    _socket = s;
    s.onConnect((_) {
      if (mounted) setState(() => _conn = 'connected');
      s.emit('match:join', {'matchId': widget.matchId});
    });
    s.onConnectError((_) => mounted ? setState(() => _conn = 'error') : null);
    s.onDisconnect((_) => mounted ? setState(() => _conn = 'connecting') : null);
    // An open room filled up while we sat in it → ask for our per-player view.
    s.on('match:refresh', (_) => s.emit('match:join', {'matchId': widget.matchId}));
    s.on('match:state', (data) {
      if (!mounted || data is! Map) return;
      setState(() {
        _state = Map<String, dynamic>.from(data);
        _joinCode = null;
        _selected.clear();
      });
      if (_names.length < 2) {
        _svc.getById(widget.matchId).then((m) => mounted ? setState(() => _readPlayers(m)) : null).catchError((_) {});
      }
    });
    s.on('match:error', (data) {
      final m = data is Map ? (data['message'] ?? '').toString() : '';
      if (!mounted || m.isEmpty) return;
      if (_state == null) setState(() => _error = m);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m), duration: const Duration(seconds: 2)));
    });
    s.on('match:ended', (data) => mounted && data is Map ? setState(() => _ended = Map<String, dynamic>.from(data)) : null);
    s.on('game:chat', (data) {
      if (!mounted || data is! Map) return;
      setState(() {
        _chat.add(Map<String, dynamic>.from(data));
        if (_chat.length > 40) _chat.removeAt(0);
      });
      final id = data['id'];
      Future.delayed(const Duration(milliseconds: 4500), () {
        if (mounted) setState(() => _chat.removeWhere((c) => c['id'] == id));
      });
    });
    s.connect();
  }

  void _disconnect() {
    final s = _socket;
    if (s == null) return;
    s.emit('match:leave', {'matchId': widget.matchId});
    s.clearListeners();
    s.dispose();
    _socket = null;
  }

  void _move(Map<String, dynamic> move) {
    HapticFeedback.selectionClick();
    _socket?.emit('game:move', {'matchId': widget.matchId, 'move': move});
  }

  void _sendChat(String text, {bool emoji = false}) =>
      _socket?.emit('game:chat', {'matchId': widget.matchId, 'text': text, 'kind': emoji ? 'emoji' : 'text'});

  Future<void> _startNow() async {
    setState(() => _starting = true);
    try {
      await _svc.startNow(widget.matchId);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_msg(e, 'Không thể bắt đầu ngay'))));
        setState(() => _starting = false);
      }
    }
  }

  Future<void> _rematch() async {
    if (_rematching) return;
    setState(() => _rematching = true);
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      final m = await _svc.rematch(widget.matchId);
      final host = (m['hostId'] is Map ? m['hostId']['_id'] : m['hostId'])?.toString();
      _disconnect();
      if (host != _me) {
        // The other player already asked — my tap accepts it.
        await _svc.respond(m['_id'].toString(), true);
        router.pushReplacement('/games/${m['_id']}');
      } else {
        messenger.showSnackBar(const SnackBar(content: Text('Đã gửi yêu cầu chơi tiếp — đang chờ đối thủ chấp nhận')));
        router.pushReplacement('/games');
      }
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(_msg(e, 'Không thể tạo ván mới'))));
      if (mounted) setState(() => _rematching = false);
    }
  }

  Future<void> _leave() async {
    final active = _state != null && _ended == null && _state!['winnerId'] == null;
    if (active) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          content: const Text('Rời ván? Bạn sẽ bị xử thua ván này.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Ở lại')),
            TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Rời ván', style: TextStyle(color: Colors.red))),
          ],
        ),
      );
      if (ok != true) return;
      await _svc.leave(widget.matchId).catchError((_) {});
    }
    _disconnect();
    if (mounted) context.canPop() ? context.pop() : context.go('/games');
  }

  String _name(String? id) => id == null ? '' : id == _me ? 'Bạn' : (_names[id] ?? 'Đối thủ');

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF064E3B),
        body: SafeArea(
          child: _error != null
              ? _message(_error!)
              : _joinCode != null && _state == null
                  ? _waitingRoom()
                  : _state == null
                      ? _message(_conn == 'error' ? 'Không kết nối được máy chủ trò chơi' : 'Đang vào bàn…', loading: _conn != 'error')
                      : _table(_state!),
        ),
      ),
    );
  }

  Widget _message(String t, {bool loading = false}) => Column(children: [
        _topBar(),
        Expanded(
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (loading) const CircularProgressIndicator(color: Colors.white),
              const SizedBox(height: 14),
              Padding(padding: const EdgeInsets.all(24), child: Text(t, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 15))),
            ]),
          ),
        ),
      ]);

  Widget _topBar({String? title}) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
        child: Row(children: [
          IconButton(onPressed: _leave, icon: const Icon(Icons.arrow_back, color: Colors.white)),
          Expanded(child: Text(title ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16))),
          if (_conn != 'connected' && _state != null) const Text('Đang kết nối lại…', style: TextStyle(color: Colors.amberAccent, fontSize: 11)),
        ]),
      );

  Widget _waitingRoom() {
    final isHost = _hostId == _me;
    return Column(children: [
      _topBar(title: 'Phòng chờ'),
      Expanded(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('🃏', style: TextStyle(fontSize: 48)),
              const SizedBox(height: 12),
              const Text('Mã phòng', style: TextStyle(color: Colors.white70)),
              GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: _joinCode!));
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã copy mã phòng')));
                },
                child: Text(_joinCode!, style: const TextStyle(color: Color(0xFFFDE68A), fontSize: 38, fontWeight: FontWeight.w900, letterSpacing: 6)),
              ),
              const Text('Chạm để copy · gửi mã cho người chơi cùng', style: TextStyle(color: Colors.white60, fontSize: 12)),
              const SizedBox(height: 20),
              Text('$_joined/$_max người', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, children: [for (final n in _names.values) Chip(label: Text(n))]),
              const SizedBox(height: 20),
              if (isHost && _joined >= 2)
                FilledButton(
                  onPressed: _starting ? null : _startNow,
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFFF59E0B), minimumSize: const Size(200, 48)),
                  child: Text(_starting ? 'Đang bắt đầu…' : 'Bắt đầu ngay ($_joined người)', style: const TextStyle(fontWeight: FontWeight.bold)),
                )
              else
                Text(isHost ? 'Đang chờ người chơi vào phòng…' : 'Đang chờ chủ phòng bắt đầu…', style: const TextStyle(color: Colors.white70)),
            ]),
          ),
        ),
      ),
    ]);
  }

  Widget _table(Map<String, dynamic> st) {
    final isPhom = st['gameType'] == 'phom';
    final hand = (st['yourHand'] as List? ?? const []).whereType<Map>().map((c) => Map<String, dynamic>.from(c)).toList();
    final opponents = (st['opponents'] as List? ?? const []).whereType<Map>().toList();
    final last = st['lastPlay'] as Map?;
    final lastCards = (last?['cards'] as List? ?? const []).whereType<Map>().map((c) => Map<String, dynamic>.from(c)).toList();
    final myTurn = st['turnUserId']?.toString() == _me && st['winnerId'] == null;
    final expires = DateTime.tryParse((st['turnExpiresAt'] ?? '').toString());
    final secsLeft = expires?.difference(DateTime.now()).inSeconds.clamp(0, 999);
    final phase = st['phase']?.toString();
    final finished = st['winnerId'] != null || _ended != null;

    return Stack(children: [
      Column(children: [
        _topBar(title: kGameLabels[st['gameType']] ?? 'Ván bài'),
        // Opponents
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
            for (final o in opponents)
              Column(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: o['userId'].toString() == st['turnUserId']?.toString() ? const Color(0xFFF59E0B) : Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text('${_name(o['userId'].toString())} · ${o['handCount']} lá', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 50,
                  width: 30 + 8.0 * ((o['handCount'] as num?)?.toInt().clamp(0, 10) ?? 0),
                  child: Stack(children: [
                    for (var i = 0; i < ((o['handCount'] as num?)?.toInt().clamp(0, 10) ?? 0); i++)
                      Positioned(left: i * 8.0, child: const PlayingCardView(width: 34)),
                  ]),
                ),
              ]),
          ]),
        ),
        // Centre: last play / pile
        Expanded(
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (isPhom)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Column(children: [
                    const PlayingCardView(width: 50),
                    const SizedBox(height: 4),
                    Text('Nọc ${st['stockCount'] ?? 0}', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                  ]),
                  const SizedBox(width: 18),
                  Column(children: [
                    st['lastDiscard'] is Map
                        ? PlayingCardView(card: Map<String, dynamic>.from(st['lastDiscard'] as Map), width: 50)
                        : Container(width: 50, height: 71, decoration: BoxDecoration(border: Border.all(color: Colors.white30), borderRadius: BorderRadius.circular(7))),
                    const SizedBox(height: 4),
                    const Text('Bài đánh', style: TextStyle(color: Colors.white70, fontSize: 11)),
                  ]),
                ])
              else if (lastCards.isNotEmpty)
                Wrap(spacing: -14, children: [for (final c in lastCards) PlayingCardView(card: c, width: 54)])
              else
                Text(st['isFirstMove'] == true ? 'Ván mới — người có 3♠ đi trước' : 'Vòng mới', style: const TextStyle(color: Colors.white60)),
              const SizedBox(height: 8),
              if (st['lastPlayBy'] != null && !isPhom)
                Text('${_name(st['lastPlayBy'].toString())} vừa đánh', style: const TextStyle(color: Colors.white70, fontSize: 12)),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(color: myTurn ? const Color(0xFFF59E0B) : Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                child: Text(
                  finished
                      ? 'Ván đã kết thúc'
                      : '${myTurn ? 'Lượt của bạn' : 'Lượt ${_name(st['turnUserId']?.toString())}'}${secsLeft != null ? ' · ${secsLeft}s' : ''}'
                          '${isPhom && myTurn ? (phase == 'draw_or_eat' ? ' · bốc hoặc ăn' : ' · đánh 1 lá') : ''}',
                  style: TextStyle(color: myTurn ? Colors.black : Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              if (isPhom) ...[
                const SizedBox(height: 6),
                Text('Điểm rác: ${st['deadwoodScore'] ?? 0} · Đã đánh ${st['yourDiscardsDone'] ?? 0}/${st['maxDiscards'] ?? 4}',
                    style: const TextStyle(color: Colors.white70, fontSize: 11)),
              ],
            ]),
          ),
        ),
        // Chat bubbles
        if (_chat.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(children: [
              for (final c in _chat.reversed.take(3))
                Align(
                  alignment: c['byUserId'].toString() == _me ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14)),
                    child: Text('${c['byUserId'].toString() == _me ? '' : '${c['byName']}: '}${c['text']}',
                        style: TextStyle(fontSize: c['kind'] == 'emoji' ? 20 : 13)),
                  ),
                ),
            ]),
          ),
        // My hand
        SizedBox(
          height: 112,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 20, 12, 4),
            children: [
              for (final c in hand)
                Align(
                  widthFactor: hand.length > 9 ? 0.72 : 0.95,
                  child: PlayingCardView(
                    card: c,
                    width: 56,
                    selected: _selected.contains(c['id']),
                    onTap: () => setState(() {
                      final id = c['id'].toString();
                      if (isPhom) {
                        final had = _selected.contains(id);
                        _selected.clear();
                        if (!had) _selected.add(id);
                      } else {
                        _selected.contains(id) ? _selected.remove(id) : _selected.add(id);
                      }
                    }),
                  ),
                ),
            ],
          ),
        ),
        // Actions
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
          child: Row(children: [
            if (!isPhom) ...[
              Expanded(child: _action('Bỏ lượt', myTurn && last != null, () => _move({'type': 'pass'}), outline: true)),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: _action('Đánh ${_selected.isEmpty ? '' : '(${_selected.length})'}', myTurn && _selected.isNotEmpty,
                    () => _move({'type': 'play', 'cards': [for (final c in hand) if (_selected.contains(c['id'])) c]})),
              ),
            ] else if (phase == 'draw_or_eat') ...[
              Expanded(child: _action('Bốc', myTurn, () => _move({'type': 'draw'}))),
              const SizedBox(width: 10),
              Expanded(child: _action('Ăn', myTurn && st['canEatLastDiscard'] == true, () => _move({'type': 'eat'}), outline: true)),
            ] else
              Expanded(
                child: _action('Đánh lá đã chọn', myTurn && _selected.length == 1,
                    () => _move({'type': 'play', 'cards': [for (final c in hand) if (_selected.contains(c['id'])) c]})),
              ),
            const SizedBox(width: 10),
            IconButton(onPressed: _chatSheet, icon: const Icon(Icons.chat_bubble_outline, color: Colors.white)),
          ]),
        ),
      ]),
      if (finished) _endOverlay(st),
    ]);
  }

  Widget _action(String t, bool enabled, VoidCallback onTap, {bool outline = false}) => Opacity(
        opacity: enabled ? 1 : 0.4,
        child: GestureDetector(
          onTap: enabled ? onTap : null,
          child: Container(
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: outline ? Colors.transparent : const Color(0xFFF59E0B),
              border: Border.all(color: outline ? Colors.white70 : const Color(0xFFF59E0B), width: 1.5),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(t, style: TextStyle(color: outline ? Colors.white : Colors.black, fontWeight: FontWeight.bold, fontSize: 15)),
          ),
        ),
      );

  void _chatSheet() {
    final ctrl = TextEditingController();
    showModalBottomSheet<void>(useRootNavigator: true, 
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(ctx).bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final e in _emojis)
              GestureDetector(
                onTap: () {
                  _sendChat(e, emoji: true);
                  Navigator.pop(ctx);
                },
                child: Text(e, style: const TextStyle(fontSize: 28)),
              ),
          ]),
          const SizedBox(height: 10),
          Wrap(spacing: 8, children: [
            for (final q in _quick)
              ActionChip(
                label: Text(q),
                onPressed: () {
                  _sendChat(q);
                  Navigator.pop(ctx);
                },
              ),
          ]),
          TextField(
            controller: ctrl,
            maxLength: 160,
            textInputAction: TextInputAction.send,
            decoration: const InputDecoration(hintText: 'Nhắn gì đó…'),
            onSubmitted: (v) {
              if (v.trim().isNotEmpty) _sendChat(v.trim());
              Navigator.pop(ctx);
            },
          ),
        ]),
      ),
    ).whenComplete(ctrl.dispose);
  }

  Widget _endOverlay(Map<String, dynamic> st) {
    final winner = (_ended?['winnerId'] ?? st['winnerId'])?.toString();
    final abandoned = _ended?['reason'] == 'abandoned';
    final won = winner == _me;
    final score = _ended?['seriesScore'];
    return Container(
      color: Colors.black54,
      alignment: Alignment.center,
      child: Container(
        margin: const EdgeInsets.all(28),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(won ? '🏆' : '🙂', style: const TextStyle(fontSize: 48)),
          const SizedBox(height: 8),
          Text(won ? 'Bạn thắng!' : '${_name(winner)} thắng', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
          if (abandoned) const Text('Một người chơi đã rời ván', style: TextStyle(color: Colors.black54)),
          if (score is Map && score.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(score.entries.map((e) => '${_name(e.key.toString())}: ${e.value}').join('  ·  '), style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 18),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: _leave, child: const Text('Về sảnh'))),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(backgroundColor: const Color(0xFF047857)),
                onPressed: _rematching || abandoned ? null : _rematch,
                child: Text(_rematching ? '…' : 'Chơi tiếp'),
              ),
            ),
          ]),
        ]),
      ),
    );
  }
}
