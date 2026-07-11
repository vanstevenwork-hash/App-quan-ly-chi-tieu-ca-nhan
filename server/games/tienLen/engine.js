const { sortHand } = require('../shared/card');
const { dealHandsByPlayerCount } = require('./deck');
const { classifyCombo, canBeat } = require('./combos');

const THREE_SPADES_ID = '3_spades';
const DEFAULT_TURN_SECONDS = 30;

function nextTurnExpiresAt(turnSeconds = DEFAULT_TURN_SECONDS) {
    return new Date(Date.now() + turnSeconds * 1000).toISOString();
}

// Pure, DB/socket-free state machine. `players` is [userId0, userId1] (strings).
function dealHands(players, options = {}) {
    const turnSeconds = options.turnSeconds || DEFAULT_TURN_SECONDS;
    const dealtHands = dealHandsByPlayerCount(players.length);
    const hands = Object.fromEntries(players.map((playerId, index) => [playerId, dealtHands[index]]));
    const starter = players.find(playerId => hands[playerId].some(c => c.id === THREE_SPADES_ID)) || players[0];

    return {
        players,
        hands,
        turnUserId: starter,
        lastPlay: null,
        lastPlayBy: null,
        passedUserIds: [],
        isFirstMove: true,
        winnerId: null,
        turnSeconds,
        turnExpiresAt: nextTurnExpiresAt(turnSeconds),
    };
}

function nextPlayer(state, userId, extraPassedUserIds = []) {
    const blocked = new Set(extraPassedUserIds);
    const startIndex = state.players.indexOf(userId);
    for (let offset = 1; offset <= state.players.length; offset++) {
        const candidate = state.players[(startIndex + offset) % state.players.length];
        if (candidate === state.winnerId) continue;
        if (blocked.has(candidate)) continue;
        if ((state.hands[candidate] || []).length === 0) continue;
        return candidate;
    }
    return userId;
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
        const passedUserIds = Array.from(new Set([...(state.passedUserIds || []), byUserId]));
        const activeOpponents = state.players.filter(playerId =>
            playerId !== state.lastPlayBy &&
            (state.hands[playerId] || []).length > 0
        );
        const allOpponentsPassed = activeOpponents.every(playerId => passedUserIds.includes(playerId));

        if (allOpponentsPassed) {
            return {
                nextState: {
                    ...state,
                    turnUserId: state.lastPlayBy,
                    lastPlay: null,
                    lastPlayBy: null,
                    passedUserIds: [],
                    turnExpiresAt: nextTurnExpiresAt(state.turnSeconds),
                },
                error: null,
            };
        }

        return {
            nextState: {
                ...state,
                turnUserId: nextPlayer(state, byUserId, passedUserIds),
                passedUserIds,
                turnExpiresAt: nextTurnExpiresAt(state.turnSeconds),
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
                passedUserIds: [],
                turnUserId: winnerId ? state.turnUserId : nextPlayer(state, byUserId),
                isFirstMove: false,
                winnerId,
                turnExpiresAt: winnerId ? null : nextTurnExpiresAt(state.turnSeconds),
            },
            error: null,
        };
    }

    return { nextState: state, error: 'Loại nước đi không hợp lệ' };
}

// Per-player redacted view — never leaks the opponent's actual hand.
function toPlayerView(state, forUserId) {
    const opponents = state.players
        .filter(playerId => playerId !== forUserId)
        .map(playerId => ({ userId: playerId, handCount: (state.hands[playerId] || []).length }));
    return {
        gameType: 'tien_len',
        youAre: forUserId,
        opponentId: opponents[0]?.userId || null,
        opponents,
        yourHand: sortHand(state.hands[forUserId] || []),
        opponentHandCount: opponents[0]?.handCount || 0,
        lastPlay: state.lastPlay,
        lastPlayBy: state.lastPlayBy,
        turnUserId: state.turnUserId,
        isFirstMove: state.isFirstMove,
        winnerId: state.winnerId,
        turnSeconds: state.turnSeconds || DEFAULT_TURN_SECONDS,
        turnExpiresAt: state.turnExpiresAt || null,
    };
}

module.exports = { dealHands, applyMove, toPlayerView, validatePlay };
