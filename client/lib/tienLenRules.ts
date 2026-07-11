import type { CardId, LastPlay } from '@/hooks/useGameMatchStore';

const SUITS = ['spades', 'clubs', 'diamonds', 'hearts'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const THREE_SPADES_ID = '3_spades';

export type ComboType = Exclude<LastPlay['type'], 'discard' | 'eat'>;

export interface ClassifiedCombo {
    type: ComboType;
    cards: CardId[];
    power: CardId;
}

export interface SelectionValidation {
    valid: boolean;
    playable: boolean;
    label: string;
    message: string;
    combo?: ClassifiedCombo;
}

const rankValue = (rank: string) => RANKS.indexOf(rank);
const suitValue = (suit: string) => SUITS.indexOf(suit);

function compareCards(a: CardId, b: CardId) {
    const rankDiff = rankValue(a.rank) - rankValue(b.rank);
    if (rankDiff !== 0) return rankDiff;
    return suitValue(a.suit) - suitValue(b.suit);
}

function classifyCombo(cards: CardId[]): ClassifiedCombo | null {
    if (cards.length === 0) return null;
    const sorted = cards.slice().sort(compareCards);
    const power = sorted[sorted.length - 1];

    if (sorted.length === 1) return { type: 'single', cards: sorted, power };

    const sameRank = sorted.every(card => card.rank === sorted[0].rank);
    if (sameRank) {
        if (sorted.length === 2) return { type: 'pair', cards: sorted, power };
        if (sorted.length === 3) return { type: 'triple', cards: sorted, power };
        if (sorted.length === 4) return { type: 'quad', cards: sorted, power };
        return null;
    }

    // 6 and 8 cards are ambiguous lengths: they could be a pair-run (đôi thông)
    // OR a plain 6/8-card straight. Try the pair-run shape first, but fall
    // through to the straight check when it doesn't match — an early
    // `return null` here made 6- and 8-card straights unplayable.
    if (sorted.length === 6 || sorted.length === 8) {
        const pairRun = ((): ClassifiedCombo | null => {
            const pairs: CardId[][] = [];
            for (let i = 0; i < sorted.length; i += 2) {
                const first = sorted[i];
                const second = sorted[i + 1];
                if (!second || first.rank !== second.rank) return null;
                if (rankValue(first.rank) === rankValue('2')) return null;
                pairs.push([first, second]);
            }
            for (let i = 1; i < pairs.length; i++) {
                if (rankValue(pairs[i][0].rank) !== rankValue(pairs[i - 1][0].rank) + 1) return null;
            }
            return { type: sorted.length === 6 ? 'three_pair_run' : 'four_pair_run', cards: sorted, power };
        })();
        if (pairRun) return pairRun;
    }

    if (sorted.length >= 3) {
        const ranks = sorted.map(card => rankValue(card.rank));
        if (ranks.some(rank => rank === rankValue('2'))) return null;
        for (let i = 1; i < ranks.length; i++) {
            if (ranks[i] !== ranks[i - 1] + 1) return null;
        }
        if (new Set(sorted.map(card => card.rank)).size !== sorted.length) return null;
        return { type: 'straight', cards: sorted, power };
    }

    return null;
}

function isSingleTwo(play: ClassifiedCombo | LastPlay) {
    return play.type === 'single' && play.cards[0]?.rank === '2';
}

function isPairTwos(play: ClassifiedCombo | LastPlay) {
    return play.type === 'pair' && play.cards.every(card => card.rank === '2');
}

function canBeat(play: ClassifiedCombo, lastPlay: LastPlay | null) {
    if (!lastPlay) return true;

    if (play.type === 'four_pair_run') {
        if (lastPlay.type === 'four_pair_run') return compareCards(play.power, lastPlay.cards[lastPlay.cards.length - 1]) > 0;
        return isSingleTwo(lastPlay) || isPairTwos(lastPlay) || lastPlay.type === 'quad' || lastPlay.type === 'three_pair_run';
    }

    if (play.type === 'three_pair_run') {
        if (lastPlay.type === 'three_pair_run') return compareCards(play.power, lastPlay.cards[lastPlay.cards.length - 1]) > 0;
        return isSingleTwo(lastPlay);
    }

    if (play.type === 'quad') {
        if (lastPlay.type === 'quad') return rankValue(play.power.rank) > rankValue(lastPlay.cards[lastPlay.cards.length - 1].rank);
        return isSingleTwo(lastPlay) || isPairTwos(lastPlay);
    }

    if (lastPlay.type === 'quad' || lastPlay.type === 'three_pair_run' || lastPlay.type === 'four_pair_run') return false;
    if (play.type !== lastPlay.type) return false;
    if (play.cards.length !== lastPlay.cards.length) return false;
    return compareCards(play.power, lastPlay.cards[lastPlay.cards.length - 1]) > 0;
}

function comboLabel(type: ComboType, count: number) {
    switch (type) {
        case 'single': return 'Bài lẻ';
        case 'pair': return 'Đôi';
        case 'triple': return 'Sám';
        case 'straight': return `Sảnh ${count} lá`;
        case 'quad': return 'Tứ quý';
        case 'three_pair_run': return '3 đôi thông';
        case 'four_pair_run': return '4 đôi thông';
    }
}

export function validateSelection(cards: CardId[], lastPlay: LastPlay | null, isFirstMove: boolean): SelectionValidation {
    if (cards.length === 0) {
        return { valid: false, playable: false, label: 'Chưa chọn bài', message: 'Chọn lá bài để kiểm tra tổ hợp' };
    }

    const combo = classifyCombo(cards);
    if (!combo) {
        return { valid: false, playable: false, label: 'Không hợp lệ', message: 'Các lá đang chọn không tạo thành tổ hợp hợp lệ' };
    }

    const label = comboLabel(combo.type, combo.cards.length);
    if (isFirstMove && !combo.cards.some(card => card.id === THREE_SPADES_ID)) {
        return { valid: true, playable: false, combo, label, message: 'Nước đầu tiên phải có 3♠' };
    }

    if (!canBeat(combo, lastPlay)) {
        return { valid: true, playable: false, combo, label, message: 'Tổ hợp hợp lệ nhưng chưa đủ lớn để đánh' };
    }

    return { valid: true, playable: true, combo, label, message: 'Có thể đánh' };
}
