import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            <div className="relative min-h-screen max-w-md mx-auto bg-background">
                <main className="pb-28">
                    {children}
                </main>
                <BottomNav />
            </div>
        </AuthGuard>
    );
}
