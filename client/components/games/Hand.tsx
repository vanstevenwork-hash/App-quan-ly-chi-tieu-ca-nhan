'use client';
import { cn } from '@/lib/utils';
import PlayingCard from './PlayingCard';
import type { CardId } from '@/hooks/useGameMatchStore';

interface HandProps {
    cards: CardId[];
    selectedIds: string[];
    onToggle: (id: string) => void;
    /** Ids that are part of a completed Phỏm meld — lifted + gold ring so a
     *  finished set/run is obvious at a glance instead of buried in the fan. */
    meldedIds?: Set<string>;
}

export default function Hand({ cards, selectedIds, onToggle, meldedIds }: HandProps) {
    return (
        <div className="flex overflow-x-auto overflow-y-visible hide-scrollbar px-3 pb-3 pt-4">
            {cards.map(c => {
                const isMelded = !!meldedIds?.has(c.id);
                const isSelected = selectedIds.includes(c.id);
                return (
                    <PlayingCard
                        key={c.id}
                        rank={c.rank}
                        suit={c.suit}
                        selected={isSelected}
                        onClick={() => onToggle(c.id)}
                        size="lg"
                        className={cn('-mr-1 last:mr-0', isMelded && !isSelected && '-translate-y-1.5 ring-2 ring-amber-300/80')}
                    />
                );
            })}
        </div>
    );
}
