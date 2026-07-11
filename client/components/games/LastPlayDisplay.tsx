'use client';
import PlayingCard from './PlayingCard';
import type { LastPlay } from '@/hooks/useGameMatchStore';

interface LastPlayDisplayProps {
    lastPlay: LastPlay | null;
    isYourLead: boolean;
    /** e.g. "Bạn vừa ăn" / "Văn sĩ vừa ăn" — shown for Phỏm eat actions so the
     *  other player gets a clear signal a card was picked up from the discard,
     *  not just silently vanish from the pile. */
    actionLabel?: string;
}

export default function LastPlayDisplay({ lastPlay, isYourLead, actionLabel }: LastPlayDisplayProps) {
    if (!lastPlay) {
        return (
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-teal-300/18 bg-teal-400/5 shadow-[inset_0_0_55px_rgba(45,212,191,0.08)]">
                <div className="text-center text-teal-200/20">
                    <div className="mb-1 text-2xl tracking-[0.12em]">♠ ♥ ♦ ♣</div>
                    <div className="text-3xl font-black uppercase leading-none">Tiến lên</div>
                    <div className="text-base font-black uppercase">Miền Nam</div>
                    <p className="mt-2 max-w-40 text-[10px] font-bold uppercase tracking-wide text-teal-100/28">
                        {isYourLead ? 'Bạn mở bài' : 'Chờ đối thủ'}
                    </p>
                </div>
            </div>
        );
    }
    const isEat = lastPlay.type === 'eat';
    return (
        <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-teal-300/18 bg-teal-400/5">
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_55px_rgba(45,212,191,0.08)]" />
            {isEat && actionLabel && (
                <span className="absolute top-6 rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-100">
                    {actionLabel}
                </span>
            )}
            <div className="relative flex items-center justify-center -space-x-2">
            {lastPlay.cards.map(c => (
                <PlayingCard key={c.id} rank={c.rank} suit={c.suit} size="lg" className={isEat ? 'ring-2 ring-amber-300' : undefined} />
            ))}
            </div>
        </div>
    );
}
