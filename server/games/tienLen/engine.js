const { sortHand } = require('../shared/card');
const { dealHandsByPlayerCount } = require('./deck');
const { classifyCombo, canBeat } = require('./combos');

const THREE_SPADES_ID = '3_spades';
const DEFAULT_TURN_SECONDS = 30;

// "Tính thối" v1 — no single nationwide-standard ruleset exists for this, so
// this is a documented, reasonable convention rather than a claim of THE
// official rule: each remaining card = 1 điểm, except each remaining heo
// (con 2) counts as 2 điểm. Being "cóng" (never played a single card all
// match) doubles the total. On top of that, every time a bomb chops a hand
// containing heo(s), the chopped player owes an extra (heoCount * multiplier)
// — quad and 3-đôi-thông = x2 per heo, 4-đôi-thông (the strongest bomb) = x3.
const BOMB_HEO_MULTIPLIER = { quad: 2, three_pair_run: 2, four_pair_run: 3 };

function nextTurnExpiresAt(turnSeconds = DEFAULT_TURN_SECONDS) {
    return new Date(Date.now() + turnSeconds * 1000).toISOString();
}

// Pure, DB/socket-free state machine. `players` is [userId0, userId1, ...].
function dealHands(players, options = {}) {
    const turnSeconds = options.turnSeconds || DEFAULT_TURN_SECONDS;
    const dealtHands = dealHandsByPlayerCount(players.length);
    const hands = Object.fromEntries(players.map((playerId, index) => [playerId, dealtHands[index]]));
    const starter = players.find(playerId => hands[playerId].some(c => c.id === THREE_SPADES_ID)) || players[0];

    return {
        players,
        hands,
        // Original deal size per player — needed at game-end to detect "cóng"
        // (a player who never got to play a single card all match).
        dealtHandSizes: Object.fromEntries(players.map(p => [p, hands[p].length])),
        turnUserId: starter,
        lastPlay: null,
        lastPlayBy: null,
        passedUserIds: [],
        isFirstMove: true,
        winnerId: null,
        thoiEvents: [],
        rankings: null,
        finalScores: null,
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

// Did this bomb just chop a heo-holding play? Returns the heo count chopped
// (1 for a lone 2, 2 for a pair of 2s), or null if this wasn't a heo-chop
// (e.g. a bigger bomb chopping a smaller bomb — no heo directly involved).
function heoChoppedBy(comboType, lastPlay) {
    if (!lastPlay || !(comboType in BOMB_HEO_MULTIPLIER)) return null;
    if (lastPlay.type === 'single' && lastPlay.cards[0]?.rank === '2') return 1;
    if (lastPlay.type === 'pair' && lastPlay.cards.every(c => c.rank === '2')) return 2;
    return null;
}

// Rank 1 = winner (emptied hand first); everyone else ranked by cards left,
// fewest first — this is the "kết thúc ngay, xếp hạng theo số lá còn lại"
// convention (not full play-out to determine bét), matching what was asked.
function computeRankings(players, hands, winnerId) {
    const others = players.filter(p => p !== winnerId);
    others.sort((a, b) => (hands[a]?.length || 0) - (hands[b]?.length || 0));
    return [winnerId, ...others].map((userId, index) => ({
        userId,
        rank: index + 1,
        cardsLeft: hands[userId]?.length || 0,
    }));
}

function computeFinalScores(state, hands) {
    const scores = {};
    state.players.forEach(userId => {
        const hand = hands[userId] || [];
        const heoCount = hand.filter(c => c.rank === '2').length;
        const nonHeoCount = hand.length - heoCount;
        const isCong = hand.length > 0 && hand.length === (state.dealtHandSizes?.[userId] ?? hand.length);
        const baseScore = (nonHeoCount * 1 + heoCount * 2) * (isCong ? 2 : 1);
        const thoiBonus = (state.thoiEvents || [])
            .filter(event => event.againstUserId === userId)
            .reduce((sum, event) => sum + event.heoCount * (BOMB_HEO_MULTIPLIER[event.comboType] || 1), 0);
        scores[userId] = {
            cardsLeft: hand.length,
            heoLeft: heoCount,
            cong: isCong,
            thoiBonus,
            score: baseScore + thoiBonus,
        };
    });
    return scores;
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
        const nextHands = { ...state.hands, [byUserId]: nextHand };
        const winnerId = nextHand.length === 0 ? byUserId : null;

        const heoChopCount = heoChoppedBy(combo.type, state.lastPlay);
        const thoiEvents = heoChopCount
            ? [...(state.thoiEvents || []), { againstUserId: state.lastPlayBy, comboType: combo.type, heoCount: heoChopCount }]
            : (state.thoiEvents || []);

        const rankings = winnerId ? computeRankings(state.players, nextHands, winnerId) : null;
        const finalScores = winnerId ? computeFinalScores({ ...state, thoiEvents }, nextHands) : null;

        return {
            nextState: {
                ...state,
                hands: nextHands,
                lastPlay: { type: combo.type, cards: combo.cards, power: combo.power },
                lastPlayBy: byUserId,
                passedUserIds: [],
                turnUserId: winnerId ? state.turnUserId : nextPlayer(state, byUserId),
                isFirstMove: false,
                winnerId,
                thoiEvents,
                rankings,
                finalScores,
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
        rankings: state.rankings || null,
        finalScores: state.finalScores || null,
        turnSeconds: state.turnSeconds || DEFAULT_TURN_SECONDS,
        turnExpiresAt: state.turnExpiresAt || null,
    };
}

module.exports = { dealHands, applyMove, toPlayerView, validatePlay };
