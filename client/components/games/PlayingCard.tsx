'use client';
import { cn } from '@/lib/utils';

const SUIT_SYMBOL: Record<string, string> = { spades: '♠', clubs: '♣', diamonds: '♦', hearts: '♥' };
const RED_SUITS = new Set(['diamonds', 'hearts']);

interface PlayingCardProps {
    rank: string;
    suit: string;
    faceDown?: boolean;
    selected?: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md';
}

export default function PlayingCard({ rank, suit, faceDown, selected, onClick, size = 'md' }: PlayingCardProps) {
    const isRed = RED_SUITS.has(suit);
    const dims = size === 'sm' ? 'w-9 h-13' : 'w-12 h-[68px]';

    if (faceDown) {
        return (
            <div className={cn(
                dims, 'rounded-lg border border-indigo-300/40 flex-shrink-0',
                'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm',
            )} style={{ width: size === 'sm' ? 36 : 48, height: size === 'sm' ? 52 : 68 }}>
                <div className="w-full h-full rounded-lg border-2 border-white/20 flex items-center justify-center">
                    <span className="text-white/50 text-xs">🃏</span>
                </div>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            className={cn(
                'flex-shrink-0 rounded-lg bg-white dark:bg-slate-100 border shadow-sm flex flex-col items-center justify-between px-1 py-1 transition-transform',
                selected ? '-translate-y-2.5 ring-2 ring-indigo-500 border-indigo-400' : 'border-slate-200',
                onClick && 'active:scale-95 cursor-pointer'
            )}
            style={{ width: size === 'sm' ? 36 : 48, height: size === 'sm' ? 52 : 68 }}
        >
            <span className={cn('text-[11px] font-bold self-start leading-none', isRed ? 'text-red-500' : 'text-slate-800')}>
                {rank}
            </span>
            <span className={cn('text-lg leading-none', isRed ? 'text-red-500' : 'text-slate-800')}>
                {SUIT_SYMBOL[suit]}
            </span>
            <span className={cn('text-[11px] font-bold self-end leading-none rotate-180', isRed ? 'text-red-500' : 'text-slate-800')}>
                {rank}
            </span>
        </button>
    );
}
