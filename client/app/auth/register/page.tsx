'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomIcon } from '@/components/icons/CustomIcon';
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
        try {
            const res = await authApi.register({ name, email, password });
            login(res.data.user, res.data.token);
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
        <div className="min-h-screen flex flex-col bg-background">
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-primary/10 blur-3xl -translate-y-1/3 -translate-x-1/4" />

            <div className="px-6 pb-8 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 4rem)' }}>
                <div className="w-16 h-16 gradient-primary rounded-[20px] flex items-center justify-center mx-auto mb-4 shadow-glow animate-float">
                    <span className="text-3xl">💰</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Tạo tài khoản</h1>
                <p className="text-muted-foreground text-sm mt-1">Bắt đầu hành trình tài chính của bạn</p>
            </div>

            <div className="flex-1 px-6">
                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="relative">
                        <CustomIcon type="user" size={16} tile={false} color="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Họ và tên"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                            className={`pl-11 rounded-2xl h-14 text-sm ${errors.name ? 'border-red-400 bg-red-50' : 'border-border/50 bg-muted/50'
                                }`}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1 ml-1">{errors.name}</p>}
                    </div>
                    <div className="relative">
                        <CustomIcon type="mail" size={16} tile={false} color="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
                            className={`pl-11 rounded-2xl h-14 text-sm ${errors.email ? 'border-red-400 bg-red-50' : 'border-border/50 bg-muted/50'
                                }`}
                        />
                        {errors.email && <p className="text-xs text-red-500 mt-1 ml-1">{errors.email}</p>}
                    </div>
                    <div className="relative">
                        <CustomIcon type="lock" size={16} tile={false} color="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Mật khẩu"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                            className={`pl-11 pr-12 rounded-2xl h-14 text-sm ${errors.password ? 'border-red-400 bg-red-50' : 'border-border/50 bg-muted/50'
                                }`}
                        />
                        <button type="button" onClick={() => setShowPass(!showPass)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPass ? <CustomIcon type="eyeOff" size={16} tile={false} color="currentColor" /> : <CustomIcon type="eye" size={16} tile={false} color="currentColor" />}
                        </button>
                        {errors.password && <p className="text-xs text-red-500 mt-1 ml-1">{errors.password}</p>}
                    </div>

                    {errors.general && <p className="text-red-500 text-sm text-center">{errors.general}</p>}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full gradient-primary text-white rounded-2xl h-14 text-base font-bold shadow-glow hover:opacity-90 transition-all border-0 mt-2"
                    >
                        {loading ? 'Đang tạo tài khoản...' : (
                            <>Đăng ký <CustomIcon type="arrowRight" size={16} tile={false} color="currentColor" className="ml-2" /></>
                        )}
                    </Button>
                </form>
            </div>

            <div className="text-center py-8">
                <span className="text-muted-foreground text-sm">Đã có tài khoản? </span>
                <Link href={`/auth/login${authSuffix}`} className="text-primary font-semibold text-sm hover:underline">
                    Đăng nhập
                </Link>
            </div>
        </div>
    );
}
