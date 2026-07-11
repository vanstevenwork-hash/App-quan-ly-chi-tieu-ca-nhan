'use client';
import { cn } from '@/lib/utils';

interface GameActionsProps {
    canPlay: boolean;
    isYourTurn: boolean;
    onPlay: () => void;
    gameType?: 'tien_len' | 'phom';
    canEat?: boolean;
    canDraw?: boolean;
    onEat?: () => void;
    onDraw?: () => void;
}

export default function GameActions({ canPlay, isYourTurn, onPlay, gameType = 'tien_len', canEat = false, canDraw = false, onEat, onDraw }: GameActionsProps) {
    const isPhom = gameType === 'phom';

    return (
        <div className="flex items-center gap-3 px-4 pb-5 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}>
            <button
                type="button"
                onClick={isPhom ? onEat : undefined}
                disabled={!isPhom || !canEat}
                className={cn(
                    'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[22px] border py-3.5 text-base font-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]',
                    isPhom && canEat
                        ? 'border-amber-200/30 bg-amber-300/20 text-amber-100 active:scale-95'
                        : 'border-white/10 bg-white/6 text-white/45'
                )}
            >
                {isPhom ? 'Ăn bài' : 'Sắp xếp'}
            </button>
            <button
                type="button"
                onClick={isPhom ? onDraw : undefined}
                disabled={!isPhom || !canDraw}
                className={cn(
                    'flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[22px] border py-3.5 text-base font-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]',
                    isPhom && canDraw
                        ? 'border-cyan-200/30 bg-cyan-300/16 text-cyan-100 active:scale-95'
                        : 'border-white/10 bg-white/6 text-white/45'
                )}
            >
                {isPhom ? 'Bốc nọc' : 'Đổi bài'}
            </button>
            <button
                onClick={onPlay}
                disabled={!isYourTurn || !canPlay}
                className={cn(
                    'flex min-w-0 flex-[1.25] items-center justify-center gap-2 rounded-[24px] py-3.5 text-lg font-black transition-all active:scale-95',
                    !isYourTurn || !canPlay
                        ? 'bg-white/8 text-white/35 cursor-not-allowed'
                        : 'bg-gradient-to-b from-emerald-400 to-teal-700 text-white shadow-[0_0_26px_rgba(45,212,191,0.38),inset_0_0_0_1px_rgba(255,255,255,0.22)]'
                )}
            >
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
                    <path d="M6.3 4.8c0-1.35 1.48-2.18 2.63-1.47l10.6 6.6a1.73 1.73 0 0 1 0 2.94l-10.6 6.6A1.73 1.73 0 0 1 6.3 18V4.8Z" />
                </svg>
                {isPhom ? 'Đánh rác' : 'Đánh bài'}
            </button>
        </div>
    );
}
