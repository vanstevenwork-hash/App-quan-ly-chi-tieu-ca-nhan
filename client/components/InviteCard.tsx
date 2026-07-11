'use client';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InviteCardProps {
    icon: ReactNode;
    iconBg?: string;
    title: string;
    sub: string;
    onAccept: () => Promise<void>;
    onDecline: () => Promise<void>;
    acceptLabel?: string;
    declineLabel?: string;
    className?: string;
}

// Shared "invite with inline Accept/Decline" card — used for card-share
// invites and game invites so the interaction pattern only exists once.
export default function InviteCard({
    icon, iconBg = 'bg-indigo-50 dark:bg-indigo-500/15', title, sub,
    onAccept, onDecline, acceptLabel = 'Chấp nhận', declineLabel = 'Từ chối', className,
}: InviteCardProps) {
    const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

    const handle = async (accept: boolean) => {
        setBusy(accept ? 'accept' : 'decline');
        try {
            await (accept ? onAccept() : onDecline());
        } catch {
            toast.error('Không thể xử lý lời mời, thử lại sau');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className={cn('w-full bg-white dark:bg-surface rounded-xl border border-indigo-100 dark:border-indigo-500/25 shadow-sm px-4 py-3.5', className)}>
            <div className="flex items-center gap-3">
                <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0', iconBg)}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{title}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{sub}</p>
                </div>
            </div>
            <div className="flex gap-2 mt-3">
                <button
                    onClick={() => handle(false)}
                    disabled={busy !== null}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all disabled:opacity-50"
                >
                    {busy === 'decline' ? 'Đang xử lý…' : declineLabel}
                </button>
                <button
                    onClick={() => handle(true)}
                    disabled={busy !== null}
                    className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                >
                    {busy === 'accept' ? 'Đang xử lý…' : acceptLabel}
                </button>
            </div>
        </div>
    );
}
