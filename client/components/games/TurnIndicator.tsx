'use client';
import { cn } from '@/lib/utils';

interface TurnIndicatorProps {
    isYourTurn: boolean;
    opponentName: string;
}

export default function TurnIndicator({ isYourTurn, opponentName }: TurnIndicatorProps) {
    return (
        <div className="flex justify-center">
            <span className={cn(
                'text-xs font-bold px-3 py-1 rounded-full',
                isYourTurn
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            )}>
                {isYourTurn ? 'Đến lượt bạn' : `Đang chờ ${opponentName}`}
            </span>
        </div>
    );
}
