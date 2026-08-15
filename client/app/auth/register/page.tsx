'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CustomIcon } from '@/components/icons/CustomIcon';
import AuthSubmitButton from '@/components/auth/AuthSubmitButton';
import WLogo from '@/components/auth/WLogo';
import { useAuthStore } from '@/store/useStore';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; general?: string }>({});
    const router = useRouter();
    const login = useAuthStore(s => s.login);

    const [authSuffix, setAuthSuffix] = useState('');
    useEffect(() => { setAuthSuffix(window.location.search); }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs: { name?: string; email?: string; password?: string } = {};
        if (!name.trim()) errs.name = 'Vui lòng nhập họ và tên';
        if (!email.trim()) errs.email = 'Vui lòng nhập email';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email không hợp lệ';
        if (!password) errs.password = 'Vui lòng nhập mật khẩu';
        else if (password.length < 6) errs.password = 'Mật khẩu ít nhất 6 ký tự';
        setErrors(errs);
        if (Object.keys(errs).length > 0) return;
        setLoading(true);
        setErrors({});
        const t0 = Date.now();
        try {
            const res = await authApi.register({ name, email, password });
            login(res.data.user, res.data.token);
            const wait = 900 - (Date.now() - t0);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
            const redirect = new URLSearchParams(window.location.search).get('redirect');
            router.push(redirect && redirect.startsWith('/') ? redirect : '/dashboard');
        } catch (err: any) {
            // Never fake a successful registration on failure — that leaves the
            // user thinking they have an account when nothing was created on
            // the server, and login afterward fails with no explanation.
            const msg = err?.response?.data?.message || 'Đăng ký thất bại, vui lòng thử lại';
            setErrors({ general: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex flex-col overflow-hidden"
            style={{
                minHeight: '100dvh',
                background: 'linear-gradient(180deg, #0b0828 0%, #17104a 35%, #6f5bc9 68%, #f0edff 100%)',
            }}>
            {/* Artwork (lightweight WebP) over the gradient base */}
            <div className="absolute inset-0 bg-cover bg-top bg-no-repeat pointer-events-none"
                style={{ backgroundImage: 'url("/images/fintech-login-background.webp")' }} />

            {/* Ambient CSS glows */}
            <div className="absolute pointer-events-none rounded-full" style={{ width: 280, height: 280, top: 80, right: -100, background: 'rgba(139,92,246,0.45)', filter: 'blur(90px)', mixBlendMode: 'screen' }} />
            <div className="absolute pointer-events-none rounded-full" style={{ width: 320, height: 320, top: 420, left: -180, background: 'rgba(99,102,241,0.28)', filter: 'blur(90px)', mixBlendMode: 'screen' }} />
            <div className="absolute pointer-events-none rounded-full" style={{ width: 380, height: 380, bottom: -180, right: -100, background: 'rgba(124,58,237,0.20)', filter: 'blur(90px)', mixBlendMode: 'screen' }} />

            {/* ── Top: logo + heading ── */}
            <div className="relative z-10 px-6 flex-shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.75rem)' }}>
                <WLogo className="w-[78px] h-auto mb-6 drop-shadow-[0_10px_24px_rgba(124,92,246,0.45)]" />
                <h1 className="text-[36px] font-extrabold text-white leading-[1.1] tracking-tight">Tạo tài khoản</h1>
                <p className="text-white/70 text-[15px] mt-2.5 leading-relaxed">Bắt đầu hành trình quản lý<br />tài chính thông minh</p>
            </div>

            {/* ── Bottom: frosted glass form card ── */}
            <div className="relative z-10 mt-auto rounded-t-[2.25rem] px-6 pt-8 border-t border-white/70"
                style={{
                    background: 'rgba(250,249,255,0.86)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    boxShadow: '0 -20px 60px -20px rgba(43,25,110,0.30), inset 0 1px 0 rgba(255,255,255,0.9)',
                    paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)',
                }}>
                <form onSubmit={handleRegister} className="space-y-4">
                    {/* Họ và tên */}
                    <div>
                        <label className="text-[15px] font-bold text-slate-700 mb-2 block">Họ và tên</label>
                        <div className="relative">
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-brand-light/70 flex items-center justify-center">
                                <CustomIcon type="user" size={16} tile={false} color="#6C4DE6" />
                            </div>
                            <input
                                placeholder="Nguyễn Văn A"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                                className={`w-full h-14 rounded-2xl bg-white pl-[52px] pr-4 text-[15px] font-medium text-slate-900 outline-none border transition-colors placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/15 ${errors.name ? 'border-red-400' : 'border-slate-200'}`}
                            />
                        </div>
                        {errors.name && <p className="text-xs text-red-500 mt-1 ml-1">{errors.name}</p>}
                    </div>

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

                    {/* Mật khẩu */}
                    <div>
                        <label className="text-[15px] font-bold text-slate-700 mb-2 block">Mật khẩu</label>
                        <div className="relative">
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-brand-light/70 flex items-center justify-center">
                                <CustomIcon type="lock" size={16} tile={false} color="#6C4DE6" />
                            </div>
                            <input
                                type={showPass ? 'text' : 'password'}
                                placeholder="Ít nhất 6 ký tự"
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

                    {errors.general && <p className="text-red-500 text-sm text-center">{errors.general}</p>}

                    <AuthSubmitButton
                        loading={loading}
                        idleLabel="Đăng ký"
                        loadingLabel="Đang tạo tài khoản..."
                        className="mt-1"
                    />
                </form>

                {/* Login link */}
                <div className="text-center pt-5 pb-1">
                    <span className="text-slate-500 text-sm">Đã có tài khoản? </span>
                    <Link href={`/auth/login${authSuffix}`} className="text-brand font-bold text-sm hover:underline">
                        Đăng nhập
                    </Link>
                </div>
            </div>
        </div>
    );
}
