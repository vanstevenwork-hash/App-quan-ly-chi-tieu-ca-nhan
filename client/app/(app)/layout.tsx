import BottomNav from '@/components/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative min-h-screen max-w-md mx-auto bg-background">
            <main className="pb-28">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}
