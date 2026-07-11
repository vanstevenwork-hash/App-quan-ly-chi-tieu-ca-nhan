const { makeDeck, shuffle, sortHand, compareCards } = require('../shared/card');

const DEFAULT_TURN_SECONDS = 30;
const PHOM_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const rankValue = rank => PHOM_RANKS.indexOf(rank);

function nextTurnExpiresAt(turnSeconds = DEFAULT_TURN_SECONDS) {
    return new Date(Date.now() + turnSeconds * 1000).toISOString();
}

function otherPlayer(state, userId) {
    return state.players.find(p => p !== userId);
}

function nextPlayer(state, userId) {
    const startIndex = state.players.indexOf(userId);
    for (let offset = 1; offset <= state.players.length; offset++) {
        const candidate = state.players[(startIndex + offset) % state.players.length];
        if ((state.hands[candidate] || []).length > 0) return candidate;
    }
    return userId;
}

function cardKey(card) {
    return card.id;
}

function sumDeadwood(cards) {
    return cards.reduce((sum, card) => {
        if (card.rank === 'A') return sum + 1;
        if (['J', 'Q', 'K'].includes(card.rank)) return sum + 10;
        return sum + Number(card.rank);
    }, 0);
}

function sameRankMelds(cards) {
    const byRank = new Map();
    for (const card of cards) {
        if (!byRank.has(card.rank)) byRank.set(card.rank, []);
        byRank.get(card.rank).push(card);
    }
    return Array.from(byRank.values())
        .filter(group => group.length >= 3)
        .flatMap(group => group.length === 4 ? [group.slice(0, 3), group] : [group]);
}

function runMelds(cards) {
    const bySuit = new Map();
    for (const card of cards) {
        if (!bySuit.has(card.suit)) bySuit.set(card.suit, []);
        bySuit.get(card.suit).push(card);
    }

    const melds = [];
    for (const suitedCards of bySuit.values()) {
        const sorted = suitedCards.slice().sort((a, b) => rankValue(a.rank) - rankValue(b.rank));
        for (let start = 0; start < sorted.length; start++) {
            const run = [sorted[start]];
            for (let i = start + 1; i < sorted.length; i++) {
                const previous = run[run.length - 1];
                const next = sorted[i];
                const diff = rankValue(next.rank) - rankValue(previous.rank);
                if (diff === 1) {
                    run.push(next);
                    if (run.length >= 3) melds.push(run.slice());
                } else if (diff > 1) {
                    break;
                }
            }
        }
    }
    return melds;
}

function findMelds(cards) {
    return [...sameRankMelds(cards), ...runMelds(cards)]
        .map(meld => meld.slice().sort(compareCards));
}

function bestDeadwood(cards) {
    const melds = findMelds(cards);
    const memo = new Map();

    function solve(remaining) {
        const key = remaining.map(cardKey).sort().join('|');
        if (memo.has(key)) return memo.get(key);

        let best = { score: sumDeadwood(remaining), melds: [] };
        for (const meld of melds) {
            const remainingIds = new Set(remaining.map(cardKey));
            if (!meld.every(card => remainingIds.has(cardKey(card)))) continue;
            const meldIds = new Set(meld.map(cardKey));
            const next = solve(remaining.filter(card => !meldIds.has(cardKey(card))));
            if (next.score < best.score) {
                best = { score: next.score, melds: [meld, ...next.melds] };
            }
        }

        memo.set(key, best);
        return best;
    }

    return solve(cards.slice().sort(compareCards));
}

function canEatDiscard(hand, discard) {
    if (!discard) return false;
    const withDiscard = [...hand, discard];
    return findMelds(withDiscard).some(meld => meld.some(card => card.id === discard.id));
}

function autoDiscard(hand) {
    const deadwood = bestDeadwood(hand);
    const meldCardIds = new Set(deadwood.melds.flat().map(card => card.id));
    const candidates = hand.filter(card => !meldCardIds.has(card.id));
    const source = candidates.length > 0 ? candidates : hand;
    return source.slice().sort((a, b) => sumDeadwood([b]) - sumDeadwood([a]) || compareCards(b, a))[0];
}

function scoreHands(state) {
    const scores = Object.fromEntries(
        state.players.map(playerId => [playerId, bestDeadwood(state.hands[playerId] || []).score])
    );
    const winnerId = state.players.slice().sort((a, b) => scores[a] - scores[b])[0];
    return { scores, winnerId };
}

function dealHands(players, options = {}) {
    const turnSeconds = options.turnSeconds || DEFAULT_TURN_SECONDS;
    const deck = shuffle(makeDeck());
    const hands = {};
    let cursor = 0;
    players.forEach((playerId, index) => {
        const count = index === 0 ? 10 : 9;
        hands[playerId] = sortHand(deck.slice(cursor, cursor + count));
        cursor += count;
    });

    return {
        players,
        hands,
        stock: deck.slice(cursor),
        discardPile: [],
        turnUserId: players[0],
        phase: 'discard',
        lastPlay: null,
        lastPlayBy: null,
        isFirstMove: false,
        winnerId: null,
        scores: null,
        // Standard Phỏm plays exactly 4 rounds — each player discards 4 times,
        // then hands are scored. Without this cap the game would keep drawing
        // until the whole 33-card stock ran dry.
        discardCounts: Object.fromEntries(players.map(p => [p, 0])),
        turnSeconds,
        turnExpiresAt: nextTurnExpiresAt(turnSeconds),
    };
}

const MAX_DISCARDS_PER_PLAYER = 4;

function drawStock(state, byUserId) {
    if (state.phase !== 'draw_or_eat') return { nextState: state, error: 'Bạn chưa được bốc bài' };
    if (!state.stock?.length) {
        const { scores, winnerId } = scoreHands(state);
        return {
            nextState: { ...state, scores, winnerId, turnExpiresAt: null },
            error: null,
        };
    }

    const [drawn, ...stock] = state.stock;
    const hand = state.hands[byUserId] || [];
    return {
        nextState: {
            ...state,
            stock,
            hands: { ...state.hands, [byUserId]: sortHand([...hand, drawn]) },
            phase: 'discard',
            turnExpiresAt: nextTurnExpiresAt(state.turnSeconds),
        },
        error: null,
    };
}

function eatDiscard(state, byUserId) {
    if (state.phase !== 'draw_or_eat') return { nextState: state, error: 'Bạn chưa được ăn bài' };
    const discardPile = state.discardPile || [];
    const discard = discardPile[discardPile.length - 1];
    const hand = state.hands[byUserId] || [];
    if (!canEatDiscard(hand, discard)) return { nextState: state, error: 'Lá bài này chưa tạo được phỏm' };

    return {
        nextState: {
            ...state,
            discardPile: discardPile.slice(0, -1),
            hands: { ...state.hands, [byUserId]: sortHand([...hand, discard]) },
            phase: 'discard',
            // Without this, lastPlay stays stuck on whatever was last *discarded* —
            // the center-table display would keep showing a card that's actually
            // just been picked up into this player's hand, and the opponent gets
            // no signal at all that an eat just happened (as opposed to a draw).
            lastPlay: { type: 'eat', cards: [discard], power: discard },
            lastPlayBy: byUserId,
            turnExpiresAt: nextTurnExpiresAt(state.turnSeconds),
        },
        error: null,
    };
}

function discardCard(state, byUserId, cardId) {
    if (state.phase !== 'discard') return { nextState: state, error: 'Bạn cần ăn hoặc bốc trước khi đánh' };
    const hand = state.hands[byUserId] || [];
    const card = cardId ? hand.find(c => c.id === cardId) : autoDiscard(hand);
    if (!card) return { nextState: state, error: 'Bạn không có lá bài này' };

    const nextHand = hand.filter(c => c.id !== card.id);
    const deadwood = bestDeadwood(nextHand);
    const winnerId = deadwood.score === 0 ? byUserId : null; // "ù" — zero deadwood ends immediately
    let scores = null;
    let finalWinnerId = winnerId;

    const discardCounts = {
        ...(state.discardCounts || Object.fromEntries(state.players.map(p => [p, 0]))),
        [byUserId]: ((state.discardCounts || {})[byUserId] || 0) + 1,
    };
    // Round limit: once everyone has discarded 4 times the hand is over and
    // scored — this is what actually ends a normal Phỏm game, NOT stock
    // exhaustion (kept below only as a safety net for weird states).
    const roundLimitReached = state.players.every(p => (discardCounts[p] || 0) >= MAX_DISCARDS_PER_PLAYER);

    if (!winnerId && (roundLimitReached || (state.stock || []).length === 0)) {
        const scored = scoreHands({ ...state, hands: { ...state.hands, [byUserId]: nextHand } });
        scores = scored.scores;
        finalWinnerId = scored.winnerId;
    }

    return {
        nextState: {
            ...state,
            hands: { ...state.hands, [byUserId]: sortHand(nextHand) },
            discardPile: [...(state.discardPile || []), card],
            discardCounts,
            lastPlay: { type: 'discard', cards: [card], power: card },
            lastPlayBy: byUserId,
            turnUserId: finalWinnerId ? state.turnUserId : nextPlayer(state, byUserId),
            phase: finalWinnerId ? 'finished' : 'draw_or_eat',
            winnerId: finalWinnerId,
            scores,
            turnExpiresAt: finalWinnerId ? null : nextTurnExpiresAt(state.turnSeconds),
        },
        error: null,
    };
}

function applyMove(state, move, byUserId) {
    if (state.winnerId) return { nextState: state, error: 'Ván đấu đã kết thúc' };
    if (state.turnUserId !== byUserId) return { nextState: state, error: 'Không phải lượt của bạn' };

    if (move.type === 'eat') return eatDiscard(state, byUserId);
    if (move.type === 'draw') return drawStock(state, byUserId);
    if (move.type === 'pass') {
        if (state.phase === 'draw_or_eat') return drawStock(state, byUserId);
        if (state.phase === 'discard') return discardCard(state, byUserId);
    }
    if (move.type === 'play') return discardCard(state, byUserId, move.cards?.[0]);

    return { nextState: state, error: 'Loại nước đi không hợp lệ' };
}

function toPlayerView(state, forUserId) {
    const opponents = state.players
        .filter(playerId => playerId !== forUserId)
        .map(playerId => ({ userId: playerId, handCount: (state.hands[playerId] || []).length }));
    const hand = sortHand(state.hands[forUserId] || []);
    const lastDiscard = (state.discardPile || [])[state.discardPile.length - 1] || null;
    const deadwood = bestDeadwood(hand);

    return {
        gameType: 'phom',
        youAre: forUserId,
        opponentId: opponents[0]?.userId || null,
        opponents,
        yourHand: hand,
        opponentHandCount: opponents[0]?.handCount || 0,
        lastPlay: state.lastPlay,
        lastPlayBy: state.lastPlayBy,
        turnUserId: state.turnUserId,
        isFirstMove: false,
        winnerId: state.winnerId,
        turnSeconds: state.turnSeconds || DEFAULT_TURN_SECONDS,
        turnExpiresAt: state.turnExpiresAt || null,
        phase: state.phase,
        stockCount: state.stock?.length || 0,
        discardCount: state.discardPile?.length || 0,
        yourDiscardsDone: (state.discardCounts || {})[forUserId] || 0,
        maxDiscards: 4,
        lastDiscard,
        canEatLastDiscard: state.turnUserId === forUserId && state.phase === 'draw_or_eat' && canEatDiscard(hand, lastDiscard),
        deadwoodScore: deadwood.score,
        melds: deadwood.melds,
        scores: state.scores,
    };
}

module.exports = { dealHands, applyMove, toPlayerView, bestDeadwood, canEatDiscard };
