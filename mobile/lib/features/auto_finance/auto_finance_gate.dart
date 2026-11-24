import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/auto_action.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';

/// Port of the web AutoFinanceRunner: when the app opens (and when it comes
/// back from the background after a while) run the server's automatic jobs,
/// then show every automatic change since the last review with an inline
/// "Hoàn tác". Events stay pending until "Đã kiểm tra", so closing the sheet
/// or killing the app never lets a change slip by unreviewed.
class AutoFinanceGate extends ConsumerStatefulWidget {
  final Widget child;
  const AutoFinanceGate({super.key, required this.child});

  @override
  ConsumerState<AutoFinanceGate> createState() => _AutoFinanceGateState();
}

class _AutoFinanceGateState extends ConsumerState<AutoFinanceGate> with WidgetsBindingObserver {
  static const _resumeGap = Duration(minutes: 30);
  DateTime? _lastRun;
  bool _running = false;
  bool _sheetOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _run());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && (_lastRun == null || DateTime.now().difference(_lastRun!) > _resumeGap)) {
      _run();
    }
  }

  Future<void> _run() async {
    if (_running || _sheetOpen) return;
    _running = true;
    _lastRun = DateTime.now();
    try {
      final events = await ref.read(financeServiceProvider).autoProcess();
      if (!mounted || events.isEmpty) return;
      refreshFinance(ref);
      _sheetOpen = true;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        builder: (_) => _ReviewSheet(events: events),
      );
    } catch (_) {
      // silent — retried next time the app opens
    } finally {
      _sheetOpen = false;
      _running = false;
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _ReviewSheet extends ConsumerStatefulWidget {
  final List<AutoEvent> events;
  const _ReviewSheet({required this.events});

  @override
  ConsumerState<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends ConsumerState<_ReviewSheet> {
  late List<AutoEvent> _events = widget.events;
  String? _busy;
  bool _closing = false;

  Future<void> _revert(AutoEvent e) async {
    final a = e.action!;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Hoàn tác?'),
        content: Text(a.isPay
            ? 'Trả lại ${formatMoney(a.amount)}đ vào ${a.accountLabel} và khôi phục dư nợ ${a.cardLabel}?'
            : 'Mở lại ${a.cardLabel} và trừ ${formatMoney(a.amount)}đ khỏi ${a.accountLabel.isEmpty ? 'tài khoản nhận' : a.accountLabel}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Hoàn tác', style: TextStyle(color: AppColors.expense))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = e.id);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(financeServiceProvider).revertAutoAction(a.id);
      setState(() => _events = [for (final x in _events) x.id == e.id ? x.withAction(a.copyWith(status: 'reverted')) : x]);
      refreshFinance(ref);
      messenger.showSnackBar(const SnackBar(content: Text('Đã hoàn tác')));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Hoàn tác thất bại')));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _ack() async {
    setState(() => _closing = true);
    try {
      await ref.read(financeServiceProvider).ackAutoEvents([for (final e in _events) e.id]);
    } catch (_) {/* shows again next open */}
    if (mounted) Navigator.of(context).pop();
  }

  void _goTo(String path) {
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push(path);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 10),
          Container(width: 44, height: 5, decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(3))),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Thay đổi tự động', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              const SizedBox(height: 4),
              Text('App đã tự xử lý ${_events.length} việc từ lần trước. Kiểm tra lại — nếu ngoài thực tế chưa đúng, bấm Hoàn tác.',
                  style: const TextStyle(fontSize: 12, color: AppColors.slate400, height: 1.4)),
            ]),
          ),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              itemCount: _events.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _item(_events[i]),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Row(children: [
              Expanded(child: _btn('Xem lịch sử', AppColors.slate100, AppColors.slate800, () => _goTo('/auto-actions'))),
              const SizedBox(width: 10),
              Expanded(child: _btn(_closing ? '...' : 'Đã kiểm tra', AppColors.brand, Colors.white, _closing ? null : _ack)),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _item(AutoEvent e) {
    final a = e.action;
    final warn = a == null;
    return Opacity(
      opacity: a?.reverted == true ? 0.6 : 1,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: warn ? const Color(0xFFFFFBEB) : const Color(0xFFF8FAFC),
          border: Border.all(color: warn ? const Color(0xFFFDE68A) : AppColors.slate100),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(e.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
          const SizedBox(height: 4),
          Text(e.message, style: const TextStyle(fontSize: 12, color: AppColors.slate500, height: 1.4)),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            if (warn && e.cardId != null)
              _small('Thanh toán thủ công', AppColors.primary, Colors.white, () => _goTo('/cards/${e.cardId}'), outlined: true),
            if (a != null)
              a.reverted
                  ? const Text('Đã hoàn tác', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate400))
                  : _small(_busy == e.id ? '...' : 'Hoàn tác', AppColors.expense, const Color(0xFFFEF2F2), _busy == e.id ? null : () => _revert(e)),
          ]),
        ]),
      ),
    );
  }

  Widget _small(String t, Color fg, Color bg, VoidCallback? onTap, {bool outlined = false}) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: outlined ? Colors.white : bg,
            border: outlined ? Border.all(color: AppColors.slate200) : null,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(t, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: fg)),
        ),
      );

  Widget _btn(String t, Color bg, Color fg, VoidCallback? onTap) => GestureDetector(
        onTap: onTap,
        child: Container(
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
          child: Text(t, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: fg)),
        ),
      );
}
