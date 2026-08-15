'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CustomIcon } from '@/components/icons/CustomIcon';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useStore';
import { authApi } from '@/lib/api';
import { mockUser } from '@/lib/mockData';
import GoogleIcon from '@/components/icons/GoogleIcon';
import AppleIcon from '@/components/icons/AppleIcon';
import FacebookIcon from '@/components/icons/FacebookIcon';

// Simple fingerprint glyph (no matching CustomIcon)
const Fingerprint = ({ className = '' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 11.5c.6 0 1 .5 1 1.1 0 2.6-.3 4.8-1.1 6.9" />
        <path d="M9.2 11a3 3 0 0 1 5.8 1c0 3-.5 5.6-1.3 7.6" />
        <path d="M6.6 12.2a5.5 5.5 0 0 1 10.9-.7c.1 1.9-.1 3.7-.5 5.3" />
        <path d="M4.2 12a8 8 0 0 1 15.6-2" />
        <path d="M8 19.6c.9-1.9 1.4-4.1 1.4-6.6" />
    </svg>
);

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
    
    // Forgot Password State
    const [showForgotPwd, setShowForgotPwd] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);

    const router = useRouter();
    const login = useAuthStore(s => s.login);

    // Carry any ?redirect (e.g. a shared game link) over to the register page too,
    // so a brand-new user can sign up and still land straight in the game.
    const [authSuffix, setAuthSuffix] = useState('');
    useEffect(() => { setAuthSuffix(window.location.search); }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: { email?: string; password?: string } = {};
        if (!email.trim()) errs.email = 'Vui lòng nhập email';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email không hợp lệ';
        if (!password) errs.password = 'Vui lòng nhập mật khẩu';
        else if (password.length < 6) errs.password = 'Mật khẩu ít nhất 6 ký tự';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setLoading(true);
        setErrors({});
        try {
            const res = await authApi.login({ email, password });
            login(res.data.user, res.data.token);
            // Return to the page that bounced them here (e.g. a shared game link).
            const redirect = new URLSearchParams(window.location.search).get('redirect');
            router.push(redirect && redirect.startsWith('/') ? redirect : '/dashboard');
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Email hoặc mật khẩu không đúng';
            setErrors({ general: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = () => {
        login(mockUser, 'mock-token');
        router.push('/dashboard');
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
            toast.error('Vui lòng nhập email hợp lệ');
            return;
        }

        setForgotLoading(true);
        try {
            await authApi.forgotPassword(forgotEmail);
            setForgotSuccess(true);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau');
        } finally {
            setForgotLoading(false);
        }
    };

    return (
        <div className="relative flex flex-col overflow-hidden"
            style={{
                minHeight: '100dvh',
                background: 'linear-gradient(180deg, #0b0828 0%, #17104a 35%, #6f5bc9 68%, #f0edff 100%)',
            }}>
            {/* Artwork (lightweight WebP) — drops onto the gradient base. Falls back
                gracefully to the gradient + glows if the file isn't present yet. */}
            <div className="absolute inset-0 bg-cover bg-top bg-no-repeat pointer-events-none"
                style={{ backgroundImage: 'url("/images/fintech-login-background.webp")' }} />

            {/* Ambient CSS glows — no image weight, blend into the artwork */}
            <div className="absolute pointer-events-none rounded-full" style={{ width: 280, height: 280, top: 80, right: -100, background: 'rgba(139,92,246,0.45)', filter: 'blur(90px)', mixBlendMode: 'screen' }} />
            <div className="absolute pointer-events-none rounded-full" style={{ width: 320, height: 320, top: 420, left: -180, background: 'rgba(99,102,241,0.28)', filter: 'blur(90px)', mixBlendMode: 'screen' }} />
            <div className="absolute pointer-events-none rounded-full" style={{ width: 380, height: 380, bottom: -180, right: -100, background: 'rgba(124,58,237,0.20)', filter: 'blur(90px)', mixBlendMode: 'screen' }} />

            {/* ── Top: logo + welcome (over the illustration) ── */}
            <div className="relative z-10 px-7 flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm ring-1 ring-white/25 flex items-center justify-center mb-7 shadow-lg">
                    <span className="text-3xl font-black bg-gradient-to-br from-[#C4B5FD] to-[#8B7CF6] bg-clip-text text-transparent leading-none">W</span>
                </div>
                <h1 className="text-[34px] font-extrabold text-white leading-tight tracking-tight">Chào mừng bạn!</h1>
                <p className="text-white/65 text-[15px] mt-2 leading-snug">Đăng nhập để tiếp tục quản lý<br />tài chính thông minh</p>
            </div>

            {/* ── Bottom: frosted glass form card — translucent so the glow shows through ── */}
            <div className="relative z-10 mt-auto rounded-t-[2rem] px-6 pt-7 border-t border-white/60"
                style={{
                    background: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    boxShadow: '0 -18px 60px -18px rgba(43,25,110,0.28), inset 0 1px 0 rgba(255,255,255,0.85)',
                    paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
                }}>
                <form onSubmit={handleLogin} className="space-y-4">
                    {/* Email */}
                    <div>
                        <label className="text-[15px] font-bold text-slate-700 mb-2 block">Email</label>
                        <div className="relative">
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-brand-light/70 flex items-center justify-center">
                                <CustomIcon type="mail" size={16} tile={false} color="#6C4DE6" />
                            </div>
                            <input
                                type="email"
                                placeholder="you@email.com"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
                                className={`w-full h-14 rounded-2xl bg-white pl-[52px] pr-11 text-[15px] font-medium text-slate-900 outline-none border transition-colors placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/15 ${errors.email ? 'border-red-400' : 'border-slate-200'}`}
                            />
                            {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                                <CustomIcon type="checkCircle" size={18} tile={false} color="#6C4DE6" className="absolute right-4 top-1/2 -translate-y-1/2" />
                            )}
                        </div>
                        {errors.email && <p className="text-xs text-red-500 mt-1 ml-1">{errors.email}</p>}
                    </div>

                    {/* Password */}
                    <div>
                        <label className="text-[15px] font-bold text-slate-700 mb-2 block">Mật khẩu</label>
                        <div className="relative">
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-brand-light/70 flex items-center justify-center">
                                <CustomIcon type="lock" size={16} tile={false} color="#6C4DE6" />
                            </div>
                            <input
                                type={showPass ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                                className={`w-full h-14 rounded-2xl bg-white pl-[52px] pr-12 text-[15px] font-medium text-slate-900 outline-none border transition-colors placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/15 ${errors.password ? 'border-red-400' : 'border-slate-200'}`}
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPass ? <CustomIcon type="eyeOff" size={18} tile={false} color="currentColor" /> : <CustomIcon type="eye" size={18} tile={false} color="currentColor" />}
                            </button>
                        </div>
                        {errors.password && <p className="text-xs text-red-500 mt-1 ml-1">{errors.password}</p>}
                    </div>

                    <div className="text-right -mt-1">
                        <button type="button"
                            onClick={() => { setShowForgotPwd(true); setForgotEmail(''); setForgotSuccess(false); }}
                            className="text-brand text-sm font-bold hover:underline">
                            Quên mật khẩu?
                        </button>
                    </div>

                    {errors.general && <p className="text-red-500 text-sm text-center">{errors.general}</p>}

                    <button type="submit" disabled={loading}
                        className="relative w-full h-14 rounded-[18px] text-white text-[17px] font-bold flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-60"
                        style={{
                            background: 'linear-gradient(135deg, #6757ff 0%, #8b5cf6 50%, #c084fc 100%)',
                            boxShadow: '0 14px 34px -8px rgba(124,92,246,0.45), inset 0 1px 0 rgba(255,255,255,0.35)',
                        }}>
                        <span className="absolute left-3 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                            <Fingerprint className="w-5 h-5 text-white" />
                        </span>
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        {!loading && <CustomIcon type="arrowRight" size={18} tile={false} color="currentColor" className="absolute right-5" />}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-slate-400 text-xs font-medium">hoặc đăng nhập bằng</span>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Google', icon: <GoogleIcon /> },
                        { label: 'Apple', icon: <AppleIcon /> },
                        { label: 'Facebook', icon: <FacebookIcon /> },
                    ].map((s) => (
                        <button key={s.label} onClick={handleDemoLogin}
                            className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-brand/40 hover:shadow-md transition-all active:scale-95 text-[13px] font-semibold text-slate-700">
                            <span className="text-2xl leading-none">{s.icon}</span>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Biometric quick login */}
                <button onClick={handleDemoLogin}
                    className="w-full mt-3 flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white/70 border border-slate-200/70 hover:bg-white transition-colors active:scale-[0.99] text-left">
                    <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#8B7CF6] to-[#6C4DE6] flex items-center justify-center flex-shrink-0 shadow-md shadow-brand/30">
                        <Fingerprint className="w-6 h-6 text-white" />
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">Đăng nhập nhanh với sinh trắc học</p>
                        <p className="text-[11px] text-slate-400">An toàn & bảo mật tuyệt đối</p>
                    </div>
                    <CustomIcon type="chevronRight" size={18} tile={false} color="currentColor" className="text-slate-400 flex-shrink-0" />
                </button>

                {/* Register link */}
                <div className="text-center pt-5 pb-1">
                    <span className="text-slate-500 text-sm">Chưa có tài khoản? </span>
                    <Link href={`/auth/register${authSuffix}`} className="text-brand font-bold text-sm hover:underline">
                        Đăng ký ngay
                    </Link>
                </div>
            </div>

            {/* Forgot Password Dialog */}
            <Dialog open={showForgotPwd} onOpenChange={setShowForgotPwd}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Quên mật khẩu?</DialogTitle>
                        <DialogDescription>
                            Nhập email của bạn và chúng tôi sẽ gửi một mật khẩu mới.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {forgotSuccess ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CustomIcon type="checkCircle2" size={24} tile={false} color="#10B981" />
                            </div>
                            <h3 className="font-bold text-lg">Đã gửi thành công!</h3>
                            <p className="text-sm text-muted-foreground">
                                Vui lòng kiểm tra hộp thư đến (và thư mục rác) của <b>{forgotEmail}</b> để nhận mật khẩu mới.
                            </p>
                            <Button 
                                className="mt-4 w-full rounded-xl" 
                                onClick={() => setShowForgotPwd(false)}
                            >
                                Đóng
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleForgotPassword} className="space-y-4 py-4">
                            <div className="relative">
                                <CustomIcon type="mail" size={16} tile={false} color="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="email"
                                    placeholder="Nhập email của bạn"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    className="pl-10 rounded-xl h-12"
                                    required
                                />
                            </div>
                            <DialogFooter className="flex-row gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowForgotPwd(false)}
                                    className="rounded-xl flex-1"
                                >
                                    Hủy
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={forgotLoading}
                                    className="rounded-xl flex-1 bg-primary hover:bg-primary/90"
                                >
                                    {forgotLoading && <CustomIcon type="loader" size={16} tile={false} spin className="mr-2" />}
                                    Gửi mật khẩu mới
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
