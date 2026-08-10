'use client';
import { useEffect } from 'react';

// Segment error boundary for all authenticated pages. Without this, any render
// error (bad data from an API response, an undefined field, etc.) unmounts the
// whole tree → a blank white screen. Here we catch it, log the real error, and
// show a recoverable UI so the app never just goes white.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        // Surfaces the actual cause in the console (and any error reporter).
        console.error('💥 App render error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center bg-[#F8F9FF] dark:bg-surface-deep">
            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/15 flex items-center justify-center text-3xl">😵</div>
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Có lỗi xảy ra</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Màn hình gặp sự cố khi hiển thị. Thử lại nhé.</p>
                {process.env.NODE_ENV !== 'production' && error?.message && (
                    <pre className="mt-3 max-w-full overflow-x-auto text-left text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{error.message}</pre>
                )}
            </div>
            <div className="flex gap-2">
                <button onClick={reset}
                    className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-sm shadow-sm shadow-brand/30 active:scale-95 transition">
                    Thử lại
                </button>
                <button onClick={() => { window.location.href = '/dashboard'; }}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm active:scale-95 transition">
                    Về trang chủ
                </button>
            </div>
        </div>
    );
}
