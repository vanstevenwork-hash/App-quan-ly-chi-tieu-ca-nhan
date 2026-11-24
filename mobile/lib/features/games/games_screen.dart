import 'package:dio/dio.dart';
import '../../widgets/page_title.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../services/game_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';

final gameServiceProvider = Provider((_) => GameService());
final gameLobbyProvider = FutureProvider.autoDispose((ref) async {
  final svc = ref.read(gameServiceProvider);
  final r = await Future.wait([svc.incoming(), svc.active(), svc.sent(), svc.stats().catchError((_) => <String, dynamic>{})]);
  return (
    incoming: r[0] as List<Map<String, dynamic>>,
    active: r[1] as List<Map<String, dynamic>>,
    sent: r[2] as List<Map<String, dynamic>>,
    stats: r[3] as Map<String, dynamic>,
  );
});

String _err(Object e, String fb) {
  if (e is DioException && e.response?.data is Map) {
    final m = (e.response!.data['message'] ?? '').toString();
    if (m.isNotEmpty) return m;
  }
  return fb;
}

/// "Chơi bài" lobby — port of client/app/(app)/games/page.tsx.
class GamesScreen extends ConsumerWidget {
  const GamesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(gameLobbyProvider);
    final svc = ref.read(gameServiceProvider);
    void toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

    Future<void> createRoom() async {
      final opts = await showModalBottomSheet<({String type, int players, int secs})>(
        context: context,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        builder: (_) => const _RoomOptions(),
      );
      if (opts == null) return;
      try {
        final m = await svc.createRoom(opts.type, turnSeconds: opts.secs, maxPlayers: opts.players);
        if (context.mounted) context.push('/games/${m['_id']}');
      } catch (e) {
        toast(_err(e, 'Không tạo được phòng'));
      }
    }

    Future<void> joinCode() async {
      final ctrl = TextEditingController();
      final code = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Vào phòng bằng mã'),
          content: TextField(controller: ctrl, autofocus: true, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(hintText: 'Mã phòng')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Huỷ')),
            TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim().toUpperCase()), child: const Text('Vào')),
          ],
        ),
      );
      ctrl.dispose();
      if (code == null || code.isEmpty) return;
      try {
        final m = await svc.joinByCode(code);
        if (context.mounted) context.push('/games/${m['_id']}');
      } catch (e) {
        toast(_err(e, 'Không vào được phòng'));
      }
    }

    Future<void> inviteEmail() async {
      final r = await showModalBottomSheet<({String email, String type})>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        builder: (_) => const _InviteSheet(),
      );
      if (r == null) return;
      try {
        await svc.invite([r.email], r.type);
        toast('Đã gửi lời mời — chờ đối thủ chấp nhận');
        ref.invalidate(gameLobbyProvider);
      } catch (e) {
        toast(_err(e, 'Không gửi được lời mời'));
      }
    }

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(fallback: '/settings'),
        title: const PageTitle('Chơi bài', subtitle: 'Với vợ/chồng'),
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(gameLobbyProvider),
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), gradient: const LinearGradient(colors: [Color(0xFF065F46), Color(0xFF047857), Color(0xFF10B981)])),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Chơi bài cùng nhau', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
              const Text('Tiến lên miền Nam · Phỏm', style: TextStyle(fontSize: 12, color: Colors.white70)),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(child: _heroBtn('Tạo phòng', Icons.add, createRoom)),
                const SizedBox(width: 8),
                Expanded(child: _heroBtn('Nhập mã', Icons.vpn_key_outlined, joinCode)),
                const SizedBox(width: 8),
                Expanded(child: _heroBtn('Mời email', Icons.mail_outline, inviteEmail)),
              ]),
            ]),
          ),
          const SizedBox(height: 16),
          ...async.when(
            loading: () => [const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator()))],
            error: (_, _) => [Center(child: TextButton(onPressed: () => ref.invalidate(gameLobbyProvider), child: const Text('Thử lại')))],
            data: (d) => [
              if (d.stats.isNotEmpty) _stats(d.stats),
              if (d.incoming.isNotEmpty) ...[
                _title('Lời mời chơi'),
                for (final m in d.incoming)
                  _tile(
                    '${(m['hostId'] is Map ? m['hostId']['name'] : null) ?? 'Ai đó'} mời chơi',
                    kGameLabels[m['gameType']] ?? '',
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      TextButton(
                        onPressed: () async {
                          await svc.respond(m['_id'].toString(), false).catchError((_) => <String, dynamic>{});
                          ref.invalidate(gameLobbyProvider);
                        },
                        child: const Text('Từ chối', style: TextStyle(color: AppColors.slate400)),
                      ),
                      FilledButton(
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFF047857)),
                        onPressed: () async {
                          try {
                            final r = await svc.respond(m['_id'].toString(), true);
                            if (context.mounted) context.push('/games/${r['_id'] ?? m['_id']}');
                          } catch (e) {
                            toast(_err(e, 'Không tham gia được'));
                          }
                        },
                        child: const Text('Chơi'),
                      ),
                    ]),
                  ),
              ],
              if (d.active.isNotEmpty) ...[
                _title('Đang chơi'),
                for (final m in d.active)
                  _tile(
                    kGameLabels[m['gameType']] ?? 'Ván bài',
                    'với ${((m['players'] as List?) ?? const []).whereType<Map>().map((p) => p['name']).join(', ')}',
                    onTap: () => context.push('/games/${m['_id']}'),
                    trailing: const Icon(Icons.chevron_right, color: AppColors.slate400),
                  ),
              ],
              if (d.sent.isNotEmpty) ...[
                _title('Đã gửi lời mời'),
                for (final m in d.sent)
                  _tile(
                    kGameLabels[m['gameType']] ?? 'Ván bài',
                    (m['joinCode'] ?? '').toString().isNotEmpty ? 'Phòng ${m['joinCode']} · đang chờ người vào' : 'Đang chờ chấp nhận',
                    onTap: (m['joinCode'] ?? '').toString().isNotEmpty ? () => context.push('/games/${m['_id']}') : null,
                    trailing: TextButton(
                      onPressed: () async {
                        await svc.cancel(m['_id'].toString()).catchError((_) {});
                        ref.invalidate(gameLobbyProvider);
                      },
                      child: const Text('Huỷ', style: TextStyle(color: AppColors.expense)),
                    ),
                  ),
              ],
              if (d.incoming.isEmpty && d.active.isEmpty && d.sent.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 30),
                  child: Center(child: Text('Tạo phòng rồi gửi mã cho vợ/chồng để cùng chơi', style: TextStyle(color: AppColors.slate400))),
                ),
            ],
          ),
        ]),
      ),
    );
  }

  Widget _heroBtn(String t, IconData i, VoidCallback onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(12)),
          child: Column(children: [
            Icon(i, color: Colors.white, size: 20),
            const SizedBox(height: 4),
            Text(t, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
          ]),
        ),
      );

  Widget _title(String t) => Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 8),
        child: Text(t, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800)),
      );

  Widget _tile(String title, String sub, {Widget? trailing, VoidCallback? onTap}) => GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), boxShadow: kCardShadow),
          child: Row(children: [
            const Text('🃏', style: TextStyle(fontSize: 22)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
              ]),
            ),
            ?trailing,
          ]),
        ),
      );

  Widget _stats(Map<String, dynamic> s) {
    final by = (s['byGameType'] as Map?) ?? const {};
    String g(String k) {
      final x = by[k] as Map?;
      return x == null ? '—' : '${x['won'] ?? 0}/${x['played'] ?? 0}';
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
      child: Row(children: [
        _stat('Thắng', '${s['wins'] ?? 0}', AppColors.income),
        _stat('Thua', '${s['losses'] ?? 0}', AppColors.expense),
        _stat('Tiến lên', g('tien_len'), AppColors.primary),
        _stat('Phỏm', g('phom'), const Color(0xFFF59E0B)),
      ]),
    );
  }

  Widget _stat(String l, String v, Color c) => Expanded(
        child: Column(children: [
          Text(v, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900, color: c)),
          Text(l, style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
        ]),
      );
}

class _RoomOptions extends StatefulWidget {
  const _RoomOptions();
  @override
  State<_RoomOptions> createState() => _RoomOptionsState();
}

class _RoomOptionsState extends State<_RoomOptions> {
  String _type = 'tien_len';
  int _players = 2, _secs = 30;

  Widget _chips<T>(List<(T, String)> opts, T value, ValueChanged<T> on) => Wrap(spacing: 8, children: [
        for (final (v, l) in opts)
          ChoiceChip(
            label: Text(l),
            selected: value == v,
            onSelected: (_) => on(v),
            selectedColor: const Color(0xFF047857),
            labelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: value == v ? Colors.white : AppColors.slate700),
          ),
      ]);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Tạo phòng', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          const SizedBox(height: 14),
          const Text('Trò chơi', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.slate700)),
          _chips([('tien_len', 'Tiến lên'), ('phom', 'Phỏm')], _type, (v) => setState(() => _type = v)),
          const SizedBox(height: 10),
          const Text('Số người', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.slate700)),
          _chips([(2, '2'), (3, '3'), (4, '4')], _players, (v) => setState(() => _players = v)),
          const SizedBox(height: 10),
          const Text('Thời gian mỗi lượt', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.slate700)),
          _chips([(20, '20s'), (30, '30s'), (60, '60s')], _secs, (v) => setState(() => _secs = v)),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF047857)),
              onPressed: () => Navigator.pop(context, (type: _type, players: _players, secs: _secs)),
              child: const Text('Tạo phòng', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ]),
      );
}

class _InviteSheet extends StatefulWidget {
  const _InviteSheet();
  @override
  State<_InviteSheet> createState() => _InviteSheetState();
}

class _InviteSheetState extends State<_InviteSheet> {
  final _email = TextEditingController();
  String _type = 'tien_len';

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, MediaQuery.viewInsetsOf(context).bottom + 28),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Mời chơi qua email', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          const SizedBox(height: 10),
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, autocorrect: false, decoration: const InputDecoration(hintText: 'Email đối thủ')),
          const SizedBox(height: 10),
          Wrap(spacing: 8, children: [
            for (final (v, l) in const [('tien_len', 'Tiến lên'), ('phom', 'Phỏm')])
              ChoiceChip(label: Text(l), selected: _type == v, onSelected: (_) => setState(() => _type = v)),
          ]),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF047857)),
              onPressed: () {
                final e = _email.text.trim().toLowerCase();
                if (e.isEmpty) return;
                Navigator.pop(context, (email: e, type: _type));
              },
              child: const Text('Gửi lời mời', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ]),
      );
}
