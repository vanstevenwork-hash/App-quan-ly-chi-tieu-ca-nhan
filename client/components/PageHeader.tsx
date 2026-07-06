'use client';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    onBack?: () => void;
    backHref?: string;
    showBackButton?: boolean;
    rightActions?: React.ReactNode;
    className?: string;
    zIndexClassName?: string;
}

// Shared sticky header for tab pages (optional back button + title + right action).
// Handles the iPhone notch/Dynamic Island safe area itself (via env(safe-area-inset-top)),
// so it must NOT be combined with an ancestor that also pads for the safe area —
// otherwise the offset is applied twice when the page is at rest.
export default function PageHeader({
    title, subtitle, onBack, backHref = '/dashboard', showBackButton = true, rightActions, className, zIndexClassName = 'z-20',
}: PageHeaderProps) {
    const router = useRouter();

    return (
        <header
            className={cn(
                'px-5 pb-2 flex items-center gap-4 sticky top-0 backdrop-blur-lg',
                zIndexClassName,
                className
            )}
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
        >
            {showBackButton && (
                <button
                    onClick={onBack ?? (() => router.push(backHref))}
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all flex-shrink-0"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
            )}
            <div className="flex-1 min-w-0">
                {subtitle && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-tight truncate">{subtitle}</p>
                )}
                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight truncate">{title}</h1>
            </div>
            {rightActions}
        </header>
    );
}
