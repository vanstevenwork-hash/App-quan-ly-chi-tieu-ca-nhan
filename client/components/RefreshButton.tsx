'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshDuotone } from '@/components/icons/RefreshDuotone';

// Shared header refresh button — brand-tinted pill that spins its icon while
// the refresh promise is in flight. Pass any (optionally async) refresh fn.
export default function RefreshButton({
    onRefresh,
    className,
    children,
}: {
    onRefresh: () => unknown | Promise<unknown>;
    className?: string;
    children?: React.ReactNode; // e.g. a notification dot rendered over the button
}) {
    const [spinning, setSpinning] = useState(false);
    const handle = async () => {
        if (spinning) return;
        setSpinning(true);
        try { await onRefresh(); }
        finally { setTimeout(() => setSpinning(false), 400); } // keep a beat so the spin reads
    };
    return (
        <button
            onClick={handle}
            disabled={spinning}
            aria-label="Làm mới"
            className={cn(
                'relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90',
                'bg-brand-light/60 dark:bg-brand/25 text-brand dark:text-brand-light',
                'ring-1 ring-brand/15 dark:ring-white/10 shadow-sm shadow-brand/10',
                'hover:bg-brand-light/90 dark:hover:bg-brand/35',
                className
            )}
        >
            <RefreshDuotone className={cn('w-[18px] h-[18px] transition-transform', spinning && 'animate-spin')} />
            {children}
        </button>
    );
}
