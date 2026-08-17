// Root-level streaming fallback (covers /auth/* and anything without a nested
// loading.tsx). Kept minimal — a centered spinner matching AuthGuard's.
export default function RootLoading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
    );
}
