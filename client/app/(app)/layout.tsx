'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import { cn } from '@/lib/utils';
import { useCustomCategoriesStore } from '@/hooks/useCustomCategories';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    // Load custom categories once so transactions using them render correctly
    // everywhere (lists, analytics, calendar…), not just in the add-transaction picker.
    useEffect(() => { useCustomCategoriesStore.getState().fetch(); }, []);
    // The live match table is a full-bleed, immersive screen with its own
    // fixed action bar — the app chrome's bottom nav has no place there.
    const isGameMatch = /^\/games\/.+/.test(pathname || '');

    return (
        <AuthGuard>
            <div className="relative min-h-screen max-w-md mx-auto bg-background">
                <main className={cn(!isGameMatch && 'pb-28')}>
                    {children}
                </main>
                {!isGameMatch && <BottomNav />}
            </div>
        </AuthGuard>
    );
}
