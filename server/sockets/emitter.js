// Lets REST controllers push a live event into a match room without importing
// the whole socket module (which owns the `io` instance via attachGameSockets).
let ioRef = null;

function setIO(io) {
    ioRef = io;
}

function emitToMatch(matchId, event, payload) {
    if (!ioRef) return;
    ioRef.of('/games').to(`match:${matchId}`).emit(event, payload);
}

module.exports = { setIO, emitToMatch };
