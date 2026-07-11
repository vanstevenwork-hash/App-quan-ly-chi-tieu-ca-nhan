'use client';
import PlayingCard from './PlayingCard';
import type { LastPlay } from '@/hooks/useGameMatchStore';

interface LastPlayDisplayProps {
    lastPlay: LastPlay | null;
    isYourLead: boolean;
}

export default function LastPlayDisplay({ lastPlay, isYourLead }: LastPlayDisplayProps) {
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
    return (
        <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-teal-300/18 bg-teal-400/5">
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_55px_rgba(45,212,191,0.08)]" />
            <div className="relative flex items-center justify-center -space-x-2">
            {lastPlay.cards.map(c => (
                <PlayingCard key={c.id} rank={c.rank} suit={c.suit} size="lg" />
            ))}
            </div>
        </div>
    );
}
