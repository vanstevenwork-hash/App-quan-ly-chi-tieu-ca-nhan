'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/useStore';
import { authApi } from '@/lib/api';
import { mockUser } from '@/lib/mockData';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const login = useAuthStore(s => s.login);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await authApi.login({ email, password });
            login(res.data.user, res.data.token);
            router.push('/dashboard');
        } catch {
            // Demo mode: login with any credentials
            login(mockUser, 'mock-token');
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = () => {
        login(mockUser, 'mock-token');
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            {/* Top gradient blob */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/10 blur-3xl -translate-y-1/3 translate-x-1/4" />
            <div className="absolute top-40 left-0 w-48 h-48 rounded-full bg-purple-300/20 blur-3xl -translate-x-1/4" />

            {/* Logo area */}
            <div className="px-6 pt-16 pb-8 text-center">
                <div className="w-16 h-16 gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-glow animate-float">
                    <span className="text-2xl">💰</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Đăng nhập</h1>
                <p className="text-muted-foreground text-sm mt-1">Quản lý tài chính cá nhân thông minh</p>
            </div>

            {/* Form */}
            <div className="flex-1 px-6">
                <form onSubmit={handleLogin} className="space-y-4">
                    {/* Email */}
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="email"
                            placeholder="Số điện thoại / Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-11 rounded-2xl border-border/50 bg-muted/50 h-14 text-sm focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    {/* Password */}
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Mật khẩu"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-11 pr-12 rounded-2xl border-border/50 bg-muted/50 h-14 text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    <div className="text-right">
                        <Link href="#" className="text-primary text-sm font-medium hover:underline">
                            Quên mật khẩu?
                        </Link>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full gradient-primary text-white rounded-2xl h-14 text-base font-bold shadow-glow hover:opacity-90 transition-all border-0 mt-2"
                    >
                        {loading ? 'Đang đăng nhập...' : (
                            <>Đăng nhập <ArrowRight className="w-4 h-4 ml-2" /></>
                        )}
                    </Button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-muted-foreground text-xs">hoặc đăng nhập bằng</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Google', icon: '🌐', color: '#DB4437' },
                        { label: 'Apple', icon: '🍎', color: '#000' },
                        { label: 'Facebook', icon: '📘', color: '#1877F2' },
                    ].map((s) => (
                        <button
                            key={s.label}
                            onClick={handleDemoLogin}
                            className="flex flex-col items-center gap-1 py-3 px-2 rounded-2xl bg-muted/50 border border-border/50 hover:bg-muted transition-colors text-xs font-medium text-foreground"
                        >
                            <span className="text-xl">{s.icon}</span>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Demo button */}
                <button
                    onClick={handleDemoLogin}
                    className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
                >
                    🎯 Dùng thử với dữ liệu mẫu
                </button>
            </div>

            {/* Register link */}
            <div className="text-center py-8">
                <span className="text-muted-foreground text-sm">Chưa có tài khoản? </span>
                <Link href="/auth/register" className="text-primary font-semibold text-sm hover:underline">
                    Đăng ký ngay
                </Link>
            </div>
        </div>
    );
}
