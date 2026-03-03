'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/useStore';
import { authApi } from '@/lib/api';
import { mockUser } from '@/lib/mockData';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const login = useAuthStore(s => s.login);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await authApi.register({ name, email, password });
            login(res.data.user, res.data.token);
            router.push('/dashboard');
        } catch {
            login({ ...mockUser, name: name || mockUser.name, email: email || mockUser.email }, 'mock-token');
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-primary/10 blur-3xl -translate-y-1/3 -translate-x-1/4" />

            <div className="px-6 pt-16 pb-8 text-center">
                <div className="w-16 h-16 gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-glow animate-float">
                    <span className="text-3xl">💰</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Tạo tài khoản</h1>
                <p className="text-muted-foreground text-sm mt-1">Bắt đầu hành trình tài chính của bạn</p>
            </div>

            <div className="flex-1 px-6">
                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Họ và tên"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="pl-11 rounded-2xl border-border/50 bg-muted/50 h-14 text-sm"
                        />
                    </div>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-11 rounded-2xl border-border/50 bg-muted/50 h-14 text-sm"
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            type={showPass ? 'text' : 'password'}
                            placeholder="Mật khẩu"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-11 pr-12 rounded-2xl border-border/50 bg-muted/50 h-14 text-sm"
                        />
                        <button type="button" onClick={() => setShowPass(!showPass)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full gradient-primary text-white rounded-2xl h-14 text-base font-bold shadow-glow hover:opacity-90 transition-all border-0 mt-2"
                    >
                        {loading ? 'Đang tạo tài khoản...' : (
                            <>Đăng ký <ArrowRight className="w-4 h-4 ml-2" /></>
                        )}
                    </Button>
                </form>
            </div>

            <div className="text-center py-8">
                <span className="text-muted-foreground text-sm">Đã có tài khoản? </span>
                <Link href="/auth/login" className="text-primary font-semibold text-sm hover:underline">
                    Đăng nhập
                </Link>
            </div>
        </div>
    );
}
