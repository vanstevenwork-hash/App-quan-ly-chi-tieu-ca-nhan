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
                'min-w-36 text-center rounded-[18px] border px-6 py-2 text-base font-black text-white shadow-[0_0_28px_rgba(45,212,191,0.28),inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                isYourTurn
                    ? 'border-emerald-300/70 bg-gradient-to-b from-teal-500/35 to-emerald-700/45'
                    : 'border-white/10 bg-black/18 text-white/70'
            )}>
                {isYourTurn ? 'Đến lượt bạn' : `Đang chờ ${opponentName}`}
            </span>
        </div>
    );
}
