// Streaming fallback for every (app) route. App Router wraps the segment's
// children in a Suspense boundary using this file, so navigating between tabs
// paints an instant skeleton instead of a blank frame while the route's JS and
// first data load. Individual routes can still add their own loading.tsx to
// override this. Pure presentational — no data, no client hooks.
export default function AppLoading() {
    return (
        <div className="min-h-screen bg-[#F8F9FF] dark:bg-surface-deep animate-pulse">
            {/* Header row: avatar + title */}
            <div className="px-5 flex items-center gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: '0.75rem' }}>
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700/60 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 rounded-md bg-slate-200 dark:bg-slate-700/60" />
                    <div className="h-3 w-20 rounded-md bg-slate-200/70 dark:bg-slate-700/40" />
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700/60 flex-shrink-0" />
            </div>

            {/* Content: a hero card, two tiles, a chart block, a couple rows */}
            <div className="px-5 space-y-4 mt-2">
                <div className="h-28 rounded-[20px] bg-white dark:bg-surface border border-gray-100 dark:border-slate-700" />
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 rounded-xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-700" />
                    <div className="h-20 rounded-xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-700" />
                </div>
                <div className="h-[236px] rounded-2xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-700" />
                <div className="space-y-2.5">
                    {[0, 1, 2].map(i => (
                        <div key={i} className="h-16 rounded-2xl bg-white dark:bg-surface border border-gray-100 dark:border-slate-700" />
                    ))}
                </div>
            </div>
        </div>
    );
}
