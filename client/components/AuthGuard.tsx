'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useStore';

// (app)/* routes render with zero protection today — anyone (or a stale
// logged-out session) can load them directly, e.g. via the PWA's
// manifest.json start_url which opens straight to /dashboard, bypassing the
// "/" -> "/auth/login" redirect entirely.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !isAuthenticated) {
            router.replace('/auth/login');
        }
    }, [mounted, isAuthenticated, router]);

    if (!mounted || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
}
