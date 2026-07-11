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
            <div className="h-[68px] flex items-center justify-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {isYourLead ? 'Bạn được ra bài — chọn lá để đánh' : 'Bàn trống, đang chờ đối thủ ra bài'}
                </p>
            </div>
        );
    }
    return (
        <div className="flex items-center justify-center gap-1.5 h-[68px]">
            {lastPlay.cards.map(c => (
                <PlayingCard key={c.id} rank={c.rank} suit={c.suit} />
            ))}
        </div>
    );
}
