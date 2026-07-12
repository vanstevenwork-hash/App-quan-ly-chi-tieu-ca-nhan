'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/useStore';

// (app)/* routes render with zero protection today — anyone (or a stale
// logged-out session) can load them directly, e.g. via the PWA's
// manifest.json start_url which opens straight to /dashboard, bypassing the
// "/" -> "/auth/login" redirect entirely.
export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const isAuthenticated = useAuthStore(s => s.isAuthenticated);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !isAuthenticated) {
            // Preserve where they were headed (e.g. a shared /games/join/<code>
            // link) so login can drop them right back there.
            const search = typeof window !== 'undefined' ? window.location.search : '';
            const dest = `${pathname || ''}${search}`;
            const isDefault = !pathname || pathname === '/dashboard';
            router.replace(isDefault ? '/auth/login' : `/auth/login?redirect=${encodeURIComponent(dest)}`);
        }
    }, [mounted, isAuthenticated, router, pathname]);

    if (!mounted || !isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
}
