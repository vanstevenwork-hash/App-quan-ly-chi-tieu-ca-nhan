import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../../state/auth_provider.dart';
import '../../theme/app_theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final pass = _password.text;
    if (email.isEmpty || !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(() => _error = 'Email không hợp lệ');
      return;
    }
    if (pass.length < 6) {
      setState(() => _error = 'Mật khẩu ít nhất 6 ký tự');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).login(email, pass);
    } catch (e) {
      setState(() => _error = 'Email hoặc mật khẩu không đúng');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Gradient base
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [AppColors.loginTop, Color(0xFF17104A), AppColors.loginMid, AppColors.loginBottom],
                stops: [0.0, 0.34, 0.62, 1.0],
              ),
            ),
          ),
          // Artwork (lightweight webp) over the gradient
          Positioned.fill(
            child: Image.asset('assets/images/login_bg.webp', fit: BoxFit.cover, alignment: Alignment.topCenter),
          ),
          // Ambient glows
          _glow(top: 80, right: -100, size: 280, color: const Color(0x738B5CF6)),
          _glow(top: 420, left: -180, size: 320, color: const Color(0x476366F1)),
          _glow(bottom: -180, right: -100, size: 380, color: const Color(0x337C3AED)),
          // Content
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SvgPicture.asset('assets/images/w_logo.svg', width: 64),
                  const SizedBox(height: 16),
                  const Text('Chào mừng bạn!',
                      style: TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w800, height: 1.15)),
                  const SizedBox(height: 8),
                  Text('Đăng nhập để tiếp tục quản lý\ntài chính thông minh',
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13, height: 1.5)),
                  const SizedBox(height: 26),
                  _card(context),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _glow({double? top, double? bottom, double? left, double? right, required double size, required Color color}) {
    return Positioned(
      top: top, bottom: bottom, left: left, right: right,
      child: ImageFiltered(
        imageFilter: ImageFilter.blur(sigmaX: 60, sigmaY: 60),
        child: Container(
          width: size, height: size,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
      ),
    );
  }

  Widget _card(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
          decoration: BoxDecoration(
            color: const Color(0xFFFAF9FF).withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.6)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _field(label: 'Email', controller: _email, hint: 'you@email.com', icon: Icons.mail_outline, keyboardType: TextInputType.emailAddress),
              const SizedBox(height: 12),
              _field(
                label: 'Mật khẩu', controller: _password, hint: '••••••••', icon: Icons.lock_outline, obscure: _obscure,
                trailing: IconButton(
                  icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20, color: AppColors.slate400),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.expense, fontSize: 13, fontWeight: FontWeight.w600)),
              ],
              const SizedBox(height: 18),
              _submitButton(),
              const SizedBox(height: 18),
              _divider(),
              const SizedBox(height: 16),
              _socialRow(),
              const SizedBox(height: 12),
              _biometricRow(),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Chưa có tài khoản? ', style: TextStyle(color: AppColors.slate500, fontSize: 13)),
                  GestureDetector(
                    onTap: () => context.push('/auth/register'),
                    child: const Text('Đăng ký ngay', style: TextStyle(color: AppColors.brand, fontSize: 13, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field({
    required String label,
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscure = false,
    Widget? trailing,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.slate900),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: AppColors.slate400, fontWeight: FontWeight.w400),
            // Lavender rounded icon tile, like the web's brand-light tile.
            prefixIcon: Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
              child: Container(
                width: 28, height: 28,
                decoration: BoxDecoration(color: AppColors.brandLight.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(9)),
                child: Icon(icon, size: 15, color: const Color(0xFF6C4DE6)),
              ),
            ),
            prefixIconConstraints: const BoxConstraints(minWidth: 44, minHeight: 44),
            suffixIcon: trailing,
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.slate200)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.slate200)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
          ),
        ),
      ],
    );
  }

  Widget _submitButton() {
    return GestureDetector(
      onTap: _loading ? null : _submit,
      child: Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: const LinearGradient(
            begin: Alignment.topLeft, end: Alignment.bottomRight,
            colors: [Color(0xFF6757FF), Color(0xFF8B5CF6), Color(0xFFC084FC)],
          ),
          boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.45), blurRadius: 24, offset: const Offset(0, 12))],
        ),
        child: _loading
            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
            : const Text('Đăng nhập', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _divider() => Row(children: [
        const Expanded(child: Divider(color: AppColors.slate200)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text('hoặc đăng nhập bằng', style: TextStyle(color: AppColors.slate400, fontSize: 11, fontWeight: FontWeight.w500)),
        ),
        const Expanded(child: Divider(color: AppColors.slate200)),
      ]);

  Widget _socialRow() => Row(
        children: [
          _socialBtn('Google', _googleMark()),
          const SizedBox(width: 10),
          _socialBtn('Apple', const Icon(Icons.apple, size: 22, color: Colors.black)),
          const SizedBox(width: 10),
          _socialBtn('Facebook', _fbMark()),
        ],
      );

  Widget _socialBtn(String label, Widget mark) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.slate200),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2))],
          ),
          child: Column(children: [
            SizedBox(height: 24, child: Center(child: mark)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.slate700)),
          ]),
        ),
      );

  Widget _googleMark() => const Text('G',
      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF4285F4)));

  Widget _fbMark() => Container(
        width: 22, height: 22,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: const Color(0xFF1877F2), borderRadius: BorderRadius.circular(5)),
        child: const Text('f', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white)),
      );

  Widget _biometricRow() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.slate200),
        ),
        child: Row(children: [
          Container(
            width: 36, height: 36,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [Color(0xFF8B7CF6), Color(0xFF6C4DE6)]),
            ),
            child: const Icon(Icons.fingerprint, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Đăng nhập nhanh với sinh trắc học', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate800)),
                Text('An toàn & bảo mật tuyệt đối', style: TextStyle(fontSize: 10, color: AppColors.slate400)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, size: 18, color: AppColors.slate400),
        ]),
      );
}
