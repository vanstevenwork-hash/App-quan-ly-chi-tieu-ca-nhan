import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../state/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/brand_logo.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    final pass = _password.text;
    if (name.isEmpty) return setState(() => _error = 'Vui lòng nhập họ tên');
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return setState(() => _error = 'Email không hợp lệ');
    }
    if (pass.length < 6) return setState(() => _error = 'Mật khẩu ít nhất 6 ký tự');
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).register(name, email, pass);
    } catch (e) {
      setState(() => _error = 'Đăng ký thất bại, thử lại sau');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.loginTop, AppColors.loginMid, AppColors.loginBottom],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  IconButton(
                    onPressed: () => context.pop(),
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                  ),
                ]),
                const BrandLogo(size: 56),
                const SizedBox(height: 16),
                const Text('Tạo tài khoản',
                    style: TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text('Bắt đầu hành trình quản lý\ntài chính thông minh',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13, height: 1.5)),
                const SizedBox(height: 24),
                _card(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _card(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
      decoration: BoxDecoration(
        color: const Color(0xFFFAF9FF),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _input(_name, 'Họ và tên', Icons.person_outline),
          const SizedBox(height: 12),
          _input(_email, 'Email', Icons.mail_outline, keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          _input(_password, 'Mật khẩu', Icons.lock_outline, obscure: _obscure,
              trailing: IconButton(
                icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    size: 20, color: AppColors.slate400),
                onPressed: () => setState(() => _obscure = !_obscure),
              )),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.expense, fontSize: 13, fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 18),
          GestureDetector(
            onTap: _loading ? null : _submit,
            child: Container(
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                gradient: const LinearGradient(
                  colors: [Color(0xFF6757FF), Color(0xFF8B5CF6), Color(0xFFC084FC)],
                ),
              ),
              child: _loading
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : const Text('Đăng ký', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Đã có tài khoản? ', style: TextStyle(color: AppColors.slate500, fontSize: 13)),
              GestureDetector(
                onTap: () => context.pop(),
                child: const Text('Đăng nhập', style: TextStyle(color: AppColors.brand, fontSize: 13, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _input(TextEditingController c, String label, IconData icon,
      {bool obscure = false, Widget? trailing, TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.slate700)),
        const SizedBox(height: 6),
        TextField(
          controller: c,
          obscureText: obscure,
          keyboardType: keyboardType,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: AppColors.slate900),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 20, color: AppColors.primary),
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
}
