'use client';
import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
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
