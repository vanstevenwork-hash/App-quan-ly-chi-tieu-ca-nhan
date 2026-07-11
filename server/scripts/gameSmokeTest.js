// End-to-end smoke test for the real-time card-game feature: invite -> accept
// -> play a full hand over Socket.io -> assert win + illegal-move rejection +
// reconnect/resume. Run with the server already running on PORT (default 8000).
const axios = require('axios');
const { io } = require('socket.io-client');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const BASE = process.env.BASE_URL || 'http://localhost:8000/api';
const SOCKET_URL = BASE.replace(/\/api\/?$/, '');

// Re-runs reuse the same fixed test accounts — clear out any leftover
// pending/active match between them from a previous run first.
async function cleanupPriorMatches() {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../models/User');
    const GameMatch = require('../models/GameMatch');
    const vo = await User.findOne({ email: 'vo@test.com' });
    const chong = await User.findOne({ email: 'chong@test.com' });
    if (vo && chong) {
        await GameMatch.deleteMany({ players: { $all: [vo._id, chong._id] }, gameType: 'tien_len' });
    }
    await mongoose.disconnect();
}

function log(...args) { console.log(...args); }
function assert(cond, msg) { if (!cond) { throw new Error('ASSERT FAILED: ' + msg); } }

async function login(email, password) {
    const res = await axios.post(`${BASE}/auth/login`, { email, password });
    return { token: res.data.token, user: res.data.user || res.data.data };
}

function connectSocket(token) {
    return new Promise((resolve, reject) => {
        const socket = io(`${SOCKET_URL}/games`, { auth: { token }, transports: ['websocket'] });
        socket.on('connect', () => resolve(socket));
        socket.on('connect_error', (err) => reject(err));
    });
}

function waitFor(socket, event, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
        socket.once(event, (payload) => { clearTimeout(t); resolve(payload); });
    });
}

// Bot strategy: lowest legal single. Never inspects opponent's hand — only
// uses fields present in the redacted state (yourHand, lastPlay).
const RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const SUIT_ORDER = ['spades', 'clubs', 'diamonds', 'hearts'];
const cardPower = (c) => RANK_ORDER.indexOf(c.rank) * 10 + SUIT_ORDER.indexOf(c.suit);

function findMove(state) {
    if (state.yourHand.length === 0) return null;
    if (!state.lastPlay) return { type: 'play', cards: [state.yourHand[0].id] }; // leading: lowest single (3♠ first move)
    if (state.lastPlay.type !== 'single') return { type: 'pass' }; // bot only knows how to beat singles with singles
    const lastPower = cardPower(state.lastPlay.cards[0]);
    const beat = state.yourHand.find(c => cardPower(c) > lastPower);
    return beat ? { type: 'play', cards: [beat.id] } : { type: 'pass' };
}

async function main() {
    await cleanupPriorMatches();

    log('── Login as vo@test.com (host) and chong@test.com (invitee) ──');
    const host = await login('vo@test.com', '123456');
    const invitee = await login('chong@test.com', '123456');
    assert(host.token && invitee.token, 'both logins should return a JWT');

    log('── Host invites invitee to Tiến lên miền Nam ──');
    const inviteRes = await axios.post(`${BASE}/game-matches/invite`, { email: 'chong@test.com', gameType: 'tien_len' }, {
        headers: { Authorization: `Bearer ${host.token}` },
    });
    const matchId = inviteRes.data.data._id;
    log('match created:', matchId);

    log('── Invitee accepts ──');
    const acceptRes = await axios.patch(`${BASE}/game-matches/${matchId}/respond`, { accept: true }, {
        headers: { Authorization: `Bearer ${invitee.token}` },
    });
    assert(acceptRes.data.data.status === 'active', 'match should be active after accept');

    log('── Both sides connect sockets and join ──');
    const hostSocket = await connectSocket(host.token);
    const inviteeSocket = await connectSocket(invitee.token);

    const hostStatePromise = waitFor(hostSocket, 'match:state');
    const inviteeStatePromise = waitFor(inviteeSocket, 'match:state');
    hostSocket.emit('match:join', { matchId });
    inviteeSocket.emit('match:join', { matchId });
    let hostState = await hostStatePromise;
    let inviteeState = await inviteeStatePromise;
    assert(hostState.yourHand.length === 26 && inviteeState.yourHand.length === 26, 'both hands should start at 26 cards');
    assert(!('opponentHand' in hostState), 'redacted state must not carry opponentHand');
    log('✅ initial state received by both, hands = 26/26, no opponent hand leaked');

    log('── Negative-path check: illegal move gets rejected as a true no-op ──');
    const sockets = { [hostState.youAre]: hostSocket, [inviteeState.youAre]: inviteeSocket };
    const states = { [hostState.youAre]: hostState, [inviteeState.youAre]: inviteeState };
    const nonTurnUserId = hostState.turnUserId === hostState.youAre ? inviteeState.youAre : hostState.youAre;
    const nonTurnSocket = sockets[nonTurnUserId];
    const beforeSnapshot = (await axios.get(`${BASE}/game-matches/${matchId}`, { headers: { Authorization: `Bearer ${host.token}` } })).data.data;

    const errPromise = waitFor(nonTurnSocket, 'match:error');
    nonTurnSocket.emit('game:move', { matchId, move: { type: 'play', cards: [states[nonTurnUserId].yourHand[0].id] } });
    const err = await errPromise;
    assert(err.message.includes('lượt'), `expected "not your turn" error, got: ${err.message}`);

    const afterSnapshot = (await axios.get(`${BASE}/game-matches/${matchId}`, { headers: { Authorization: `Bearer ${host.token}` } })).data.data;
    assert(JSON.stringify(beforeSnapshot.state) === JSON.stringify(afterSnapshot.state) || beforeSnapshot.updatedAt === afterSnapshot.updatedAt,
        'illegal move must not mutate match state');
    log('✅ illegal move correctly rejected as no-op:', err.message);

    log('── Reconnect check: disconnect one side, reconnect, resume with identical state ──');
    const midState = sockets[hostState.turnUserId] === hostSocket ? hostState : inviteeState;
    const midUserId = midState.youAre;
    sockets[midUserId].disconnect();
    await new Promise(r => setTimeout(r, 300));
    const freshSocket = await connectSocket(midUserId === host.user?._id || midUserId === hostState.youAre ? host.token : invitee.token);
    const resumeStatePromise = waitFor(freshSocket, 'match:state');
    freshSocket.emit('match:join', { matchId });
    const resumeState = await resumeStatePromise;
    assert(resumeState.turnUserId === midState.turnUserId, 'resumed state should match pre-disconnect turn');
    assert(resumeState.yourHand.length === midState.yourHand.length, 'resumed hand size should be unchanged');
    log('✅ reconnect/resume returns identical state');
    sockets[midUserId] = freshSocket;

    log('── Playing the hand to completion (both bots play lowest legal single or pass) ──');
    let ended = null;
    hostSocket.on('match:ended', (p) => { ended = p; });
    inviteeSocket.on('match:ended', (p) => { ended = p; });

    let current = states[hostState.turnUserId] ? hostState : inviteeState;
    // Re-fetch authoritative current turn from live state objects we've been tracking.
    let turnUserId = resumeState.youAre === midUserId ? resumeState.turnUserId : (hostState.turnUserId);
    let latestByUser = { [hostState.youAre]: hostState, [inviteeState.youAre]: inviteeState };
    latestByUser[midUserId] = resumeState;

    hostSocket.on('match:state', (s) => { latestByUser[hostState.youAre] = s; });
    inviteeSocket.on('match:state', (s) => { latestByUser[inviteeState.youAre] = s; });
    sockets[midUserId].on('match:state', (s) => { latestByUser[midUserId] = s; });

    const MAX_MOVES = 3000;
    let moves = 0;
    while (!ended && moves < MAX_MOVES) {
        const turnUid = latestByUser[hostState.youAre].turnUserId;
        const actingState = latestByUser[turnUid];
        const move = findMove(actingState);
        if (!move) { log('bot stuck, no legal move, breaking'); break; }
        const actingSocket = sockets[turnUid] || (turnUid === hostState.youAre ? hostSocket : inviteeSocket);
        actingSocket.emit('game:move', { matchId, move });
        await new Promise(r => setTimeout(r, 15)); // let server process + broadcast before next loop tick
        moves++;
    }

    assert(!!ended, `match should have ended within ${MAX_MOVES} moves (took ${moves})`);
    log(`✅ match:ended fired after ${moves} moves, winnerId=${ended.winnerId}`);

    hostSocket.disconnect();
    inviteeSocket.disconnect();
    try { sockets[midUserId].disconnect(); } catch { /* already disconnected */ }

    log('\n════════ GAME SMOKE TEST: ALL CHECKS PASSED ════════');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ SMOKE TEST FAILED:', err.message);
    process.exit(1);
});
