'use client';
import type React from 'react';
import { cn } from '@/lib/utils';

const SUIT_SYMBOL: Record<string, string> = { spades: '♠', clubs: '♣', diamonds: '♦', hearts: '♥' };
const RED_SUITS = new Set(['diamonds', 'hearts']);

interface PlayingCardProps {
    rank: string;
    suit: string;
    faceDown?: boolean;
    selected?: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    style?: React.CSSProperties;
}

export default function PlayingCard({ rank, suit, faceDown, selected, onClick, size = 'md', className, style }: PlayingCardProps) {
    const isRed = RED_SUITS.has(suit);
    // 20% smaller across the board for a more compact table layout
    const dimensions = {
        sm: { width: 30, height: 43, radius: 'rounded-lg' },
        md: { width: 46, height: 67, radius: 'rounded-lg' },
        lg: { width: 54, height: 78, radius: 'rounded-xl' },
    }[size];

    if (faceDown) {
        return (
            <div className={cn(
                dimensions.radius,
                'relative flex-shrink-0 overflow-hidden border border-cyan-100/55',
                'bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,0.28),transparent_35%),linear-gradient(145deg,#0b6d71,#073f48)]',
                'shadow-[0_10px_18px_rgba(0,0,0,0.28),inset_0_0_0_1px_rgba(255,255,255,0.2)]',
                className
            )} style={{ width: dimensions.width, height: dimensions.height, ...style }}>
                <div className="absolute inset-1 rounded-[inherit] border border-cyan-100/25" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.24) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                <div className="relative w-full h-full flex items-center justify-center">
                    <span className={cn('block rotate-45 border-2 border-cyan-100/65', size === 'sm' ? 'h-4 w-2.5' : 'h-5 w-3.5')} />
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
                'flex-shrink-0 rounded-xl bg-gradient-to-br from-white to-slate-100 border border-white/80 shadow-[0_8px_12px_rgba(0,0,0,0.28)] flex flex-col items-center justify-between px-2 py-2 transition-transform',
                selected ? '-translate-y-3 ring-2 ring-emerald-300 border-emerald-200 shadow-[0_0_22px_rgba(45,212,191,0.42)]' : '',
                onClick && 'active:scale-95 cursor-pointer',
                className
            )}
            style={{ width: dimensions.width, height: dimensions.height, ...style }}
        >
            <span className={cn('text-lg font-black self-start leading-none', size === 'sm' && 'text-xs', isRed ? 'text-red-500' : 'text-slate-900')}>
                {rank}
            </span>
            <span className={cn('text-2xl leading-none', size === 'sm' && 'text-lg', isRed ? 'text-red-500' : 'text-slate-900')}>
                {SUIT_SYMBOL[suit]}
            </span>
            <span className={cn('text-lg font-black self-end leading-none rotate-180', size === 'sm' && 'text-xs', isRed ? 'text-red-500' : 'text-slate-900')}>
                {rank}
            </span>
        </button>
    );
}
