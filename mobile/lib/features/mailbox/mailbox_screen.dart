import 'package:flutter/material.dart';
import '../../widgets/page_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/back_button.dart';

/// Chưa đọc / Đã đọc / Tất cả — shared by mailbox + Traveloka (web ReadStatusFilter).
class ReadFilter extends StatelessWidget {
  final String value; // unread | read | all
  final ValueChanged<String> onChanged;
  const ReadFilter({super.key, required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: AppColors.slate100, borderRadius: BorderRadius.circular(12)),
        child: Row(children: [
          for (final (k, l) in const [('unread', 'Chưa đọc'), ('read', 'Đã đọc'), ('all', 'Tất cả')])
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(k),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: value == k ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(9)),
                  child: Text(l, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: value == k ? AppColors.slate800 : AppColors.slate400)),
                ),
              ),
            ),
        ]),
      );
}

/// "Hộp thư" — port of client/app/(app)/mailbox (owner only): folders,
/// read filter, Gmail search, read (plain text), star / read flags, delete,
/// compose / reply. Entry to the Traveloka voucher screen.
class MailboxScreen extends ConsumerStatefulWidget {
  const MailboxScreen({super.key});
  @override
  ConsumerState<MailboxScreen> createState() => _MailboxScreenState();
}

class _MailboxScreenState extends ConsumerState<MailboxScreen> {
  String _account = '';
  List<Map<String, dynamic>> _folders = const [];
  String _folder = 'inbox';
  String _status = 'all';
  String _q = '';
  final _search = TextEditingController();
  List<Map<String, dynamic>> _messages = const [];
  int _total = 0, _page = 1;
  bool _loading = true, _more = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadFolders();
    _load(1);
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _loadFolders() async {
    try {
      final d = await ref.read(financeServiceProvider).mailboxFolders();
      if (!mounted) return;
      setState(() {
        _account = (d['account'] ?? '').toString();
        _folders = (d['folders'] as List? ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      });
    } catch (_) {}
  }

  Future<void> _load(int page) async {
    setState(() {
      page == 1 ? _loading = true : _more = true;
      _error = null;
    });
    try {
      final d = await ref.read(financeServiceProvider).mailboxList(folder: _folder, page: page, q: _q.isEmpty ? null : _q, status: _status);
      final list = (d['messages'] as List? ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      if (!mounted) return;
      setState(() {
        _total = (d['total'] as num?)?.toInt() ?? 0;
        _page = page;
        _messages = page == 1 ? list : [..._messages, ...list];
      });
    } catch (e) {
      if (mounted) setState(() => _error = 'Không tải được hộp thư');
    } finally {
      if (mounted) setState(() => _loading = _more = false);
    }
  }

  String _who(Map? a) => a == null ? '(không rõ)' : ((a['name'] ?? '').toString().isNotEmpty ? a['name'].toString() : (a['address'] ?? '').toString());

  String _fmt(String? s) {
    final d = DateTime.tryParse(s ?? '')?.toLocal();
    if (d == null) return '';
    final now = DateTime.now();
    if (d.year == now.year && d.month == now.month && d.day == now.day) {
      return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    }
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}${d.year == now.year ? '' : '/${d.year % 100}'}';
  }

  Future<void> _flag(Map<String, dynamic> m, {bool? seen, bool? flagged}) async {
    await ref.read(financeServiceProvider).mailboxFlags(_folder, [m['uid'] as int], seen: seen, flagged: flagged).catchError((_) {});
    setState(() => _messages = [
          for (final x in _messages)
            x['uid'] == m['uid'] ? {...x, 'seen': ?seen, 'flagged': ?flagged} : x
        ]);
  }

  Future<void> _delete(Map<String, dynamic> m) async {
    try {
      final permanent = await ref.read(financeServiceProvider).mailboxDelete(_folder, [m['uid'] as int]);
      setState(() {
        _messages = _messages.where((x) => x['uid'] != m['uid']).toList();
        _total = _total > 0 ? _total - 1 : 0;
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(permanent ? 'Đã xoá vĩnh viễn' : 'Đã chuyển vào thùng rác')));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Xoá thất bại')));
    }
  }

  Future<void> _open(Map<String, dynamic> m) async {
    if (m['seen'] != true) setState(() => _messages = [for (final x in _messages) x['uid'] == m['uid'] ? {...x, 'seen': true} : x]);
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => _MessageView(folder: _folder, uid: m['uid'] as int, account: _account)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        leading: const AppBackButton(fallback: '/settings'),
        title: PageTitle('Hộp thư', subtitle: _account.isEmpty ? 'Đang kết nối…' : _account),
        actions: [
          IconButton(icon: const Icon(Icons.refresh, color: AppColors.slate700), onPressed: () { _load(1); _loadFolders(); }),
          IconButton(icon: const Icon(Icons.edit_outlined, color: AppColors.brand), onPressed: () => showComposeSheet(context, account: _account)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(1),
        child: ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
          SizedBox(
            height: 36,
            child: ListView(scrollDirection: Axis.horizontal, children: [
              for (final f in (_folders.isEmpty ? [{'key': 'inbox', 'label': 'Hộp thư đến', 'unseen': 0}] : _folders))
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () { setState(() => _folder = f['key'].toString()); _load(1); },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _folder == f['key'] ? AppColors.brand : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: _folder == f['key'] ? AppColors.brand : AppColors.slate200),
                      ),
                      child: Text('${f['label']}${(f['unseen'] as num? ?? 0) > 0 ? '  ${f['unseen']}' : ''}',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _folder == f['key'] ? Colors.white : AppColors.slate700)),
                    ),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => context.push('/mailbox/traveloka'),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
              child: const Row(children: [
                Text('🎁', style: TextStyle(fontSize: 20)),
                SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Voucher Traveloka', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                    Text('Mệnh giá & mã từ thư chưa đọc — chạm để copy', style: TextStyle(fontSize: 11, color: AppColors.slate400)),
                  ]),
                ),
                Icon(Icons.chevron_right, color: AppColors.slate400),
              ]),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (v) { setState(() => _q = v.trim()); _load(1); },
            decoration: InputDecoration(
              hintText: 'Tìm thư (vd: from:vpbank, has:attachment)',
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _q.isEmpty ? null : IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () { _search.clear(); setState(() => _q = ''); _load(1); }),
              filled: true, fillColor: Colors.white, isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.slate200)),
            ),
          ),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: ReadFilter(value: _status, onChanged: (v) { setState(() => _status = v); _load(1); })),
            const SizedBox(width: 10),
            if (!_loading) Text('$_total thư', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.slate400)),
          ]),
          const SizedBox(height: 10),
          if (_loading) const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: Text('Đang tải thư…', style: TextStyle(color: AppColors.slate400)))),
          if (!_loading && _error != null) Padding(padding: const EdgeInsets.symmetric(vertical: 40), child: Center(child: Text(_error!, style: const TextStyle(color: AppColors.expense)))),
          if (!_loading && _error == null && _messages.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 40), child: Center(child: Text('Không có thư nào', style: TextStyle(color: AppColors.slate400)))),
          if (!_loading && _messages.isNotEmpty)
            Container(
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: kCardShadow),
              child: Column(children: [
                for (final (i, m) in _messages.indexed)
                  Dismissible(
                    key: ValueKey('${_folder}_${m['uid']}'),
                    direction: DismissDirection.endToStart,
                    background: Container(alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 20), color: const Color(0xFFFEE2E2), child: const Icon(Icons.delete_outline, color: AppColors.expense)),
                    onDismissed: (_) => _delete(m),
                    child: InkWell(
                      onTap: () => _open(m),
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
                        decoration: i > 0 ? const BoxDecoration(border: Border(top: BorderSide(color: AppColors.slate100))) : null,
                        child: Row(children: [
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                if (m['seen'] != true) Container(width: 7, height: 7, margin: const EdgeInsets.only(right: 6), decoration: const BoxDecoration(color: AppColors.brand, shape: BoxShape.circle)),
                                Expanded(
                                  child: Text(_folder == 'sent' || _folder == 'drafts' ? 'Tới: ${(m['to'] as List? ?? const []).map((a) => _who(a as Map)).join(', ')}' : _who(m['from'] as Map?),
                                      maxLines: 1, overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 14, fontWeight: m['seen'] == true ? FontWeight.w500 : FontWeight.bold, color: AppColors.slate800)),
                                ),
                                Text(_fmt(m['date']?.toString()), style: const TextStyle(fontSize: 11, color: AppColors.slate400)),
                              ]),
                              const SizedBox(height: 2),
                              Text('${m['hasAttachment'] == true ? '📎 ' : ''}${m['subject']}', maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: m['seen'] == true ? AppColors.slate400 : AppColors.slate700, fontWeight: m['seen'] == true ? FontWeight.normal : FontWeight.w600)),
                            ]),
                          ),
                          IconButton(
                            onPressed: () => _flag(m, flagged: m['flagged'] != true),
                            icon: Icon(m['flagged'] == true ? Icons.star_rounded : Icons.star_border_rounded, color: m['flagged'] == true ? const Color(0xFFFBBF24) : AppColors.slate200),
                          ),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ),
          if (!_loading && _messages.length < _total)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: OutlinedButton(
                onPressed: _more ? null : () => _load(_page + 1),
                child: Text(_more ? 'Đang tải…' : 'Tải thêm (${_total - _messages.length} thư)'),
              ),
            ),
        ]),
      ),
    );
  }
}

class _MessageView extends ConsumerStatefulWidget {
  final String folder;
  final int uid;
  final String account;
  const _MessageView({required this.folder, required this.uid, required this.account});
  @override
  ConsumerState<_MessageView> createState() => _MessageViewState();
}

class _MessageViewState extends ConsumerState<_MessageView> {
  Map<String, dynamic>? _m;
  String? _error;

  @override
  void initState() {
    super.initState();
    ref.read(financeServiceProvider).mailboxGet(widget.folder, widget.uid).then((d) {
      if (mounted) setState(() => _m = d);
    }).catchError((_) {
      if (mounted) setState(() => _error = 'Không mở được thư');
    });
  }

  String _who(Map? a) => a == null ? '' : ((a['name'] ?? '').toString().isNotEmpty ? '${a['name']} <${a['address']}>' : (a['address'] ?? '').toString());

  /// Plain-text body; when a mail is HTML-only, strip the markup.
  String _body(Map<String, dynamic> m) {
    final text = (m['text'] ?? '').toString().trim();
    if (text.isNotEmpty) return text;
    return (m['html'] ?? '')
        .toString()
        .replaceAll(RegExp(r'<(style|script|head)[\s\S]*?</\1>', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'<br\s*/?>|</(p|div|tr|li|h\d)>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll(RegExp(r'[ \t]+'), ' ')
        .replaceAll(RegExp(r'\n\s*\n+'), '\n\n')
        .trim();
  }

  @override
  Widget build(BuildContext context) {
    final m = _m;
    return Scaffold(
      backgroundColor: AppColors.pageLight,
      appBar: AppBar(
        backgroundColor: AppColors.pageLight,
        elevation: 0,
        actions: [
          if (m != null)
            IconButton(
              tooltip: 'Trả lời',
              icon: const Icon(Icons.reply, color: AppColors.slate700),
              onPressed: () => showComposeSheet(context,
                  account: widget.account,
                  to: (m['from'] as Map?)?['address']?.toString() ?? '',
                  subject: RegExp(r'^re:', caseSensitive: false).hasMatch(m['subject'].toString()) ? m['subject'].toString() : 'Re: ${m['subject']}',
                  inReplyTo: m['messageId']?.toString(),
                  references: [...(m['references'] as List? ?? const []).map((e) => e.toString()), if (m['messageId'] != null) m['messageId'].toString()],
                  quote: _body(m)),
            ),
        ],
      ),
      body: m == null
          ? Center(child: _error != null ? Text(_error!, style: const TextStyle(color: AppColors.expense)) : const CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.fromLTRB(20, 4, 20, 40), children: [
              Text(m['subject'].toString(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.slate800)),
              const SizedBox(height: 8),
              Text(_who(m['from'] as Map?), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.slate700)),
              Text('Tới: ${(m['to'] as List? ?? const []).map((a) => (a as Map)['address']).join(', ')}', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
              Text(DateTime.tryParse(m['date']?.toString() ?? '')?.toLocal().toString().substring(0, 16) ?? '', style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
              if ((m['attachments'] as List? ?? const []).isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final a in (m['attachments'] as List)) Chip(label: Text('📎 ${(a as Map)['filename']}', style: const TextStyle(fontSize: 11))),
                ]),
              ],
              const Divider(height: 24),
              SelectableText(_body(m), style: const TextStyle(fontSize: 14, height: 1.5, color: AppColors.slate800)),
            ]),
    );
  }
}

/// Compose / reply sheet (sent from the app's Gmail account).
Future<void> showComposeSheet(BuildContext context,
        {required String account, String to = '', String subject = '', String? inReplyTo, List<String>? references, String? quote}) =>
    showModalBottomSheet<void>(useRootNavigator: true, 
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => _Compose(account: account, to: to, subject: subject, inReplyTo: inReplyTo, references: references, quote: quote),
    );

class _Compose extends ConsumerStatefulWidget {
  final String account, to, subject;
  final String? inReplyTo, quote;
  final List<String>? references;
  const _Compose({required this.account, required this.to, required this.subject, this.inReplyTo, this.references, this.quote});
  @override
  ConsumerState<_Compose> createState() => _ComposeState();
}

class _ComposeState extends ConsumerState<_Compose> {
  late final _to = TextEditingController(text: widget.to);
  final _cc = TextEditingController();
  late final _subject = TextEditingController(text: widget.subject);
  late final _body = TextEditingController(text: widget.quote == null ? '' : '\n\n${widget.quote!.split('\n').map((l) => '> $l').join('\n')}');
  bool _sending = false;

  @override
  void dispose() {
    for (final c in [_to, _cc, _subject, _body]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _send() async {
    if (_to.text.trim().isEmpty) return;
    setState(() => _sending = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(financeServiceProvider).mailboxSend(
          to: _to.text.trim(), cc: _cc.text.trim().isEmpty ? null : _cc.text.trim(), subject: _subject.text, text: _body.text,
          inReplyTo: widget.inReplyTo, references: widget.references);
      if (mounted) Navigator.of(context).pop();
      messenger.showSnackBar(const SnackBar(content: Text('Đã gửi thư')));
    } catch (_) {
      if (mounted) setState(() => _sending = false);
      messenger.showSnackBar(const SnackBar(content: Text('Gửi thất bại')));
    }
  }

  @override
  Widget build(BuildContext context) {
    InputDecoration dec(String h) => InputDecoration(hintText: h, isDense: true, border: const UnderlineInputBorder());
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 14, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Text(widget.inReplyTo != null ? 'Trả lời' : 'Thư mới', style: AppText.sheetTitle),
          const Spacer(),
          Flexible(child: Text('Từ: ${widget.account}', overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppColors.slate400))),
        ]),
        TextField(controller: _to, keyboardType: TextInputType.emailAddress, decoration: dec('Tới')),
        TextField(controller: _cc, keyboardType: TextInputType.emailAddress, decoration: dec('Cc')),
        TextField(controller: _subject, decoration: dec('Tiêu đề')),
        TextField(controller: _body, minLines: 6, maxLines: 10, decoration: dec('Nội dung')),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton(
            onPressed: _sending ? null : _send,
            style: FilledButton.styleFrom(backgroundColor: AppColors.brand),
            child: Text(_sending ? 'Đang gửi…' : 'Gửi', style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
        ),
      ]),
    );
  }
}
