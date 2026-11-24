import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/prefs.dart';
import '../../state/auth_provider.dart';
import '../../state/finance_providers.dart';
import '../../theme/app_theme.dart';
import 'settings_actions.dart';

/// Whether this account may open the app's Gmail mailbox (server decides).
final mailboxAccessProvider = FutureProvider.autoDispose((ref) => ref.read(financeServiceProvider).mailboxAccess());

// Layered "elevated glass" shadows — same recipe as the web CARD_SHADOW /
// TILE_SHADOW (soft ambient spread + tight contact shadow, purple-tinted).
const _cardShadow = [
  BoxShadow(color: Color(0x0A110C2E), blurRadius: 2, offset: Offset(0, 2)),
  BoxShadow(color: Color(0x386D28D9), blurRadius: 24, offset: Offset(0, 12), spreadRadius: -8),
  BoxShadow(color: Color(0x29110C2E), blurRadius: 48, offset: Offset(0, 28), spreadRadius: -16),
];
const _tileShadow = [
  BoxShadow(color: Color(0x0A110C2E), blurRadius: 2, offset: Offset(0, 1)),
  BoxShadow(color: Color(0x246D28D9), blurRadius: 16, offset: Offset(0, 8), spreadRadius: -6),
];

/// Pages not on the bottom nav — settings is their hub (web SHORTCUTS).
const _shortcuts = [
  (route: '/accounts', label: 'Quản lý thẻ', icon: Icons.credit_card_rounded, bg: Color(0xFFEEF2FF), color: Color(0xFF6366F1)),
  (route: '/cards/expiry', label: 'Hạn thẻ', icon: Icons.event_busy_rounded, bg: Color(0xFFFFF1F2), color: Color(0xFFF43F5E)),
  (route: '/statements', label: 'Lịch sao kê', icon: Icons.receipt_long_rounded, bg: Color(0xFFF5F3FF), color: Color(0xFF8B5CF6)),
  (route: '/installments', label: 'Tổng trả góp', icon: Icons.calendar_month_rounded, bg: Color(0xFFEEF2FF), color: Color(0xFF6366F1)),
  (route: '/cashback', label: 'Hoàn tiền', icon: Icons.paid_rounded, bg: Color(0xFFECFDF5), color: Color(0xFF10B981)),
  (route: '/savings', label: 'Tiết kiệm', icon: Icons.savings_rounded, bg: Color(0xFFFFFBEB), color: Color(0xFFF0A319)),
  (route: '/games', label: 'Chơi bài với vợ/chồng', icon: Icons.style_rounded, bg: Color(0xFFFAF5FF), color: Color(0xFF8B5CF6)),
  (route: '/wealth', label: 'Tổng tài sản', icon: Icons.pie_chart_rounded, bg: Color(0xFFF5F3FF), color: Color(0xFF7C3AED)),
  (route: '/cards/designs', label: 'Gắn ảnh thẻ', icon: Icons.image_rounded, bg: Color(0xFFEEF2FF), color: Color(0xFF4F46E5)),
  (route: '/auto-actions', label: 'Giao dịch tự động', icon: Icons.autorenew_rounded, bg: Color(0xFFF0F9FF), color: Color(0xFF0EA5E9)),
];

/// "Cài đặt" — redesigned to match client/app/(app)/settings/page.tsx.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});
  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _hideBalance = true;
  bool _uploadingAvatar = false;
  DateTime? _lastSync;

  @override
  void initState() {
    super.initState();
    PrefFlags.get(PrefFlags.hideBalance, fallback: true).then((v) => mounted ? setState(() => _hideBalance = v) : null);
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m), duration: const Duration(seconds: 2)));

  Future<void> _changeAvatar() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 600, imageQuality: 85);
    if (picked == null) return;
    setState(() => _uploadingAvatar = true);
    try {
      final svc = ref.read(financeServiceProvider);
      final url = await svc.uploadImage(picked.path, folder: 'chi_tieu/avatars');
      await svc.updateProfile({'avatar': url});
      await ref.read(authProvider.notifier).reloadUser();
      _toast('Đã cập nhật ảnh đại diện');
    } catch (_) {
      _toast('Tải ảnh thất bại');
    } finally {
      if (mounted) setState(() => _uploadingAvatar = false);
    }
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Đăng xuất?'),
        content: const Text('Bạn sẽ cần đăng nhập lại để dùng app.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Huỷ')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Đăng xuất', style: TextStyle(color: AppColors.expense, fontWeight: FontWeight.bold))),
        ],
      ),
    );
    if (ok == true) ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final mailbox = ref.watch(mailboxAccessProvider).valueOrNull;
    final tg = ref.watch(telegramStatusProvider);
    final tgConnected = tg.value == true;

    return Scaffold(
      backgroundColor: AppColors.pageLight,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 120),
          children: [
            // Header — flat title like the rest of the app
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 14, 20, 16),
              child: Text('Cài đặt', style: AppText.pageTitle),
            ),

            // Profile card with PRO badge
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 24),
              child: Stack(clipBehavior: Clip.none, children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.white, Color(0xFFF8FAFC)]),
                    border: Border.all(color: Colors.white),
                    boxShadow: _cardShadow,
                  ),
                  child: Row(children: [
                    _avatar(user?.avatar ?? '', user?.initials ?? 'NN'),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(user?.name.isNotEmpty == true ? user!.name : 'Người dùng',
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                        const SizedBox(height: 2),
                        Text(user?.email ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, color: AppColors.slate400)),
                      ]),
                    ),
                    GestureDetector(
                      onTap: () => editName(context, ref),
                      child: Container(
                        width: 40, height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.slate100,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.slate200.withValues(alpha: 0.7)),
                        ),
                        child: const Icon(Icons.edit_rounded, size: 17, color: AppColors.slate500),
                      ),
                    ),
                  ]),
                ),
                Positioned(
                  top: -12, right: 20,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFBBF24),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: const [BoxShadow(color: Color(0x4DF59E0B), blurRadius: 8, offset: Offset(0, 3))],
                    ),
                    child: const Text('PRO', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1, color: Color(0xFF451A03))),
                  ),
                ),
              ]),
            ),

            // Quick management — one horizontal row (~4.5 tiles visible)
            _sectionLabel('QUẢN LÝ NHANH'),
            LayoutBuilder(builder: (context, c) {
              final tileW = (c.maxWidth - 40 - 32) / 4.5;
              return SizedBox(
                height: 104,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(20, 2, 20, 10),
                  clipBehavior: Clip.none,
                  itemCount: _shortcuts.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final s = _shortcuts[i];
                    return GestureDetector(
                      onTap: () => context.push(s.route),
                      child: Container(
                        width: tileW,
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: _tileShadow),
                        child: Column(children: [
                          Container(
                            width: 40, height: 40,
                            decoration: BoxDecoration(color: s.bg, borderRadius: BorderRadius.circular(12)),
                            child: Icon(s.icon, size: 20, color: s.color),
                          ),
                          const SizedBox(height: 8),
                          Text(s.label, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center,
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.slate800, height: 1.1)),
                        ]),
                      ),
                    );
                  },
                ),
              );
            }),
            const SizedBox(height: 14),

            _sectionLabel('TÙY CHỈNH'),
            _group([
              _item(Icons.language_rounded, 'Ngôn ngữ', value: 'Tiếng Việt'),
              _item(Icons.category_rounded, 'Danh mục', sub: 'Thêm danh mục chi tiêu riêng (Shopee, Lazada…)',
                  onTap: () => context.push('/settings/categories')),
              _item(Icons.send_rounded, 'Kết nối Telegram',
                  sub: tg.isLoading ? 'Đang kiểm tra…' : tgConnected ? 'Đã kết nối · nhắn bot để ghi nhanh' : 'Ghi chi tiêu nhanh qua chat',
                  value: tgConnected ? 'Ngắt' : null,
                  onTap: () => toggleTelegram(context, ref, tgConnected)),
              _item(Icons.notifications_rounded, 'Thông báo', sub: 'Thông báo & nhắc quan trọng', onTap: () => context.push('/notifications')),
            ]),
            const SizedBox(height: 24),

            _sectionLabel('BẢO MẬT'),
            _group([
              _item(Icons.visibility_off_rounded, 'Ẩn số dư khi mở app', sub: 'Chạm vào mắt để hiện',
                  onTap: () => _setHide(!_hideBalance),
                  right: Switch.adaptive(value: _hideBalance, activeTrackColor: AppColors.brand, onChanged: _setHide)),
              _item(Icons.alternate_email_rounded, 'Đổi email', sub: user?.email, onTap: () => changeEmail(context, ref)),
            ]),
            const SizedBox(height: 24),

            _sectionLabel('DỮ LIỆU'),
            _group([
              _item(Icons.refresh_rounded, 'Làm mới dữ liệu',
                  sub: _lastSync == null
                      ? 'Tải lại giao dịch, thẻ, tài sản'
                      : 'Đồng bộ lần cuối ${_lastSync!.hour.toString().padLeft(2, '0')}:${_lastSync!.minute.toString().padLeft(2, '0')}',
                  onTap: () {
                    refreshFinance(ref);
                    ref.invalidate(notificationsProvider);
                    setState(() => _lastSync = DateTime.now());
                    _toast('Đã làm mới dữ liệu');
                  }),
              _item(Icons.mark_email_unread_rounded, 'Đồng bộ email', sub: 'Quét email, xem trước rồi mới thêm', onTap: () => syncBankEmails(context, ref)),
              if (mailbox?.allowed == true)
                _item(Icons.mail_rounded, 'Hộp thư', sub: 'Quản lý mail ${mailbox!.account}', onTap: () => context.push('/mailbox')),
              _item(Icons.download_rounded, 'Xuất dữ liệu', sub: 'Tải file CSV giao dịch', onTap: () => exportCsv(context, ref)),
            ]),
            const SizedBox(height: 24),

            // Logout — outlined red card, centered
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: GestureDetector(
                onTap: _logout,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  decoration: BoxDecoration(
                    color: const Color(0x80FEF2F2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.logout_rounded, size: 18, color: Color(0xFFEF4444)),
                    SizedBox(width: 10),
                    Text('Đăng xuất', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFFEF4444))),
                  ]),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Center(child: Text('Phiên bản 1.0.0 • Chi Tiêu Cá Nhân', style: TextStyle(fontSize: 12, color: AppColors.slate400))),
          ],
        ),
      ),
    );
  }

  void _setHide(bool v) {
    setState(() => _hideBalance = v);
    PrefFlags.set(PrefFlags.hideBalance, v);
  }

  /// Glossy radial-gradient avatar (initials) or the uploaded photo; tap to change.
  Widget _avatar(String url, String initials) => GestureDetector(
        onTap: _uploadingAvatar ? null : _changeAvatar,
        child: Stack(children: [
          Container(
            width: 64, height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: url.startsWith('http') ? Border.all(color: Colors.white, width: 3) : null,
              gradient: const RadialGradient(
                center: Alignment(-0.36, -0.44),
                colors: [Color(0xFFB8A6FF), Color(0xFF8B7CF6), Color(0xFF6C63FF), Color(0xFF5B21B6)],
                stops: [0, 0.35, 0.65, 1],
              ),
              boxShadow: const [BoxShadow(color: Color(0x8C6D28D9), blurRadius: 18, offset: Offset(0, 10), spreadRadius: -6)],
              image: url.startsWith('http') ? DecorationImage(image: NetworkImage(url), fit: BoxFit.cover) : null,
            ),
            alignment: Alignment.center,
            child: url.startsWith('http')
                ? null
                : Stack(alignment: Alignment.center, children: [
                    // glossy highlight
                    Positioned(
                      top: 8, left: 12,
                      child: Container(width: 20, height: 12, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(10))),
                    ),
                    Text(initials, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  ]),
          ),
          Positioned(
            right: 0, bottom: 0,
            child: Container(
              width: 22, height: 22,
              decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 3)]),
              child: _uploadingAvatar
                  ? const Padding(padding: EdgeInsets.all(4), child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.photo_camera_rounded, size: 13, color: AppColors.brand),
            ),
          ),
        ]),
      );

  Widget _sectionLabel(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 10),
        child: Text(t, style: AppText.groupLabel),
      );

  Widget _group(List<Widget> rows) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Container(
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), boxShadow: _cardShadow),
          clipBehavior: Clip.antiAlias,
          child: Column(children: [
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0) Divider(height: 1, thickness: 1, color: AppColors.slate100.withValues(alpha: 0.8)),
              rows[i],
            ],
          ]),
        ),
      );

  /// Web SettingItem: brand-tinted icon tile · bold label + sublabel · value / right / chevron.
  Widget _item(IconData icon, String label, {String? sub, String? value, Widget? right, VoidCallback? onTap}) => InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, size: 20, color: AppColors.brand),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                if (sub != null && sub.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, color: AppColors.slate400)),
                ],
              ]),
            ),
            if (value != null) ...[
              const SizedBox(width: 8),
              Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.slate400)),
            ],
            if (right != null) right else if (onTap != null) ...[
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.slate400),
            ],
          ]),
        ),
      );
}
