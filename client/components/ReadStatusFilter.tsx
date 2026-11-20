'use client';
import { cn } from '@/lib/utils';

export type ReadStatus = 'unread' | 'read' | 'all';

const OPTIONS: { key: ReadStatus; label: string }[] = [
    { key: 'unread', label: 'Chưa đọc' },
    { key: 'read', label: 'Đã đọc' },
    { key: 'all', label: 'Tất cả' },
];

// Chưa đọc / Đã đọc / Tất cả — used by the mailbox and Traveloka voucher screens.
export default function ReadStatusFilter({ value, onChange, className }: { value: ReadStatus; onChange: (v: ReadStatus) => void; className?: string }) {
    return (
        <div className={cn('bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl flex gap-1', className)} role="tablist" aria-label="Lọc theo trạng thái đọc">
            {OPTIONS.map(o => (
                <button key={o.key} role="tab" aria-selected={value === o.key} onClick={() => onChange(o.key)}
                    className={cn('flex-1 py-2 rounded-lg text-xs font-bold transition-all',
                        value === o.key ? 'bg-white dark:bg-surface text-foreground shadow-sm' : 'text-muted-foreground')}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}
