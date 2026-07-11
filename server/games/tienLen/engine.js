const { sortHand } = require('../shared/card');
const { dealTwoHands } = require('./deck');
const { classifyCombo, canBeat } = require('./combos');

const THREE_SPADES_ID = '3_spades';

// Pure, DB/socket-free state machine. `players` is [userId0, userId1] (strings).
function dealHands(players) {
    const [hand0, hand1] = dealTwoHands();
    const hands = { [players[0]]: hand0, [players[1]]: hand1 };
    const starter = hand0.some(c => c.id === THREE_SPADES_ID) ? players[0] : players[1];

    return {
        players,
        hands,
        turnUserId: starter,
        lastPlay: null,
        lastPlayBy: null,
        isFirstMove: true,
        winnerId: null,
    };
}

function otherPlayer(state, userId) {
    return state.players.find(p => p !== userId);
}

// { valid, error?, combo? }
function validatePlay(hand, cardIds, lastPlay, isFirstMove) {
    const cards = cardIds.map(id => hand.find(c => c.id === id)).filter(Boolean);
    if (cards.length !== cardIds.length) {
        return { valid: false, error: 'Bạn không có (những) lá bài này' };
    }
    const combo = classifyCombo(cards);
    if (!combo) return { valid: false, error: 'Tổ hợp bài không hợp lệ' };
    if (isFirstMove && !cards.some(c => c.id === THREE_SPADES_ID)) {
        return { valid: false, error: 'Nước đi đầu tiên phải có lá 3♠' };
    }
    if (!canBeat(combo, lastPlay)) {
        return { valid: false, error: 'Bài không đủ lớn để chặt nước trước' };
    }
    return { valid: true, combo };
}

// Returns { nextState, error }. Never mutates `state` in place.
function applyMove(state, move, byUserId) {
    if (state.winnerId) return { nextState: state, error: 'Ván đấu đã kết thúc' };
    if (state.turnUserId !== byUserId) return { nextState: state, error: 'Không phải lượt của bạn' };

    if (move.type === 'pass') {
        if (!state.lastPlay) return { nextState: state, error: 'Không thể bỏ lượt khi đang được quyền ra bài' };
        // 2-player shortcut: the only other player passing clears the trick immediately.
        return {
            nextState: {
                ...state,
                turnUserId: state.lastPlayBy,
                lastPlay: null,
                lastPlayBy: null,
            },
            error: null,
        };
    }

    if (move.type === 'play') {
        const hand = state.hands[byUserId] || [];
        const { valid, error, combo } = validatePlay(hand, move.cards || [], state.lastPlay, state.isFirstMove);
        if (!valid) return { nextState: state, error };

        const playedIds = new Set(combo.cards.map(c => c.id));
        const nextHand = hand.filter(c => !playedIds.has(c.id));
        const winnerId = nextHand.length === 0 ? byUserId : null;

        return {
            nextState: {
                ...state,
                hands: { ...state.hands, [byUserId]: nextHand },
                lastPlay: { type: combo.type, cards: combo.cards, power: combo.power },
                lastPlayBy: byUserId,
                turnUserId: winnerId ? state.turnUserId : otherPlayer(state, byUserId),
                isFirstMove: false,
                winnerId,
            },
            error: null,
        };
    }

    return { nextState: state, error: 'Loại nước đi không hợp lệ' };
}

// Per-player redacted view — never leaks the opponent's actual hand.
function toPlayerView(state, forUserId) {
    const opponentId = otherPlayer(state, forUserId);
    return {
        gameType: 'tien_len',
        youAre: forUserId,
        opponentId,
        yourHand: sortHand(state.hands[forUserId] || []),
        opponentHandCount: (state.hands[opponentId] || []).length,
        lastPlay: state.lastPlay,
        lastPlayBy: state.lastPlayBy,
        turnUserId: state.turnUserId,
        isFirstMove: state.isFirstMove,
        winnerId: state.winnerId,
    };
}

module.exports = { dealHands, applyMove, toPlayerView, validatePlay };
