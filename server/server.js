const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

dotenv.config();

const app = express();

// ===== SSE — realtime notification push =====
const { sseClients, pushSSE } = require('./sse');

// Global Logger for debugging
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// CORS — allow all localhost origins (frontend on any port + Swagger UI)
app.use(cors({
  origin: true,          // reflect any origin
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== Swagger UI =====
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: { persistAuthorization: true },
  customSiteTitle: '💰 Chi Tiêu API Docs',
}));
// Raw spec endpoint
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ===== API Routes =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/card-shares', require('./routes/cardShares'));
app.use('/api/expense-shares', require('./routes/expenseShares'));
app.use('/api/wealth', require('./routes/wealth'));
app.use('/api/banks', require('./routes/banks'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/day-notes', require('./routes/dayNotes'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/cashback-records', require('./routes/cashback'));
app.use('/api/game-matches', require('./routes/gameMatches'));

// ===== SSE Stream endpoint =====
// GET /api/notifications/stream  (auth via ?token=... query param)
const { protect } = require('./middleware/auth');
app.get('/api/notifications/stream', protect, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send a heartbeat comment every 25s to keep connection alive
  res.write(': ping\n\n');
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 25_000);

  const uid = req.user._id.toString();
  if (!sseClients.has(uid)) sseClients.set(uid, new Set());
  sseClients.get(uid).add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    const set = sseClients.get(uid);
    if (set) { set.delete(res); if (set.size === 0) sseClients.delete(uid); }
  });
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// 404 handler
app.use((req, res) => res.status(404).json({ success: false, message: 'Route không tồn tại' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    await dropStaleIndexes();
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// One-off cleanup for indexes left over from earlier schema versions that no
// longer match the current model (e.g. `CardShare` used to have a unique
// `inviteToken` field from an older token-based invite design — since removed
// in favor of resolving the invitee by email, but MongoDB never auto-drops
// indexes for fields that vanish from the schema). A stale *unique* index on
// an all-null field makes every 2nd document collide with E11000. Safe to run
// on every boot: dropIndex is a no-op error (ignored) once already cleaned up.
const dropStaleIndexes = async () => {
  try {
    await mongoose.connection.collection('cardshares').dropIndex('inviteToken_1');
    console.log('🧹 Dropped stale index cardshares.inviteToken_1');
  } catch (err) {
    // IndexNotFound (code 27) just means it's already clean — expected on
    // most boots after the first successful cleanup.
    if (err.codeName !== 'IndexNotFound') console.error('Index cleanup warning:', err.message);
  }
};

connectDB();

// ===== Socket.io — real-time game matches =====
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});
require('./sockets')(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Local Access: http://localhost:${PORT}`);
  console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`🃏 Socket.io /games namespace ready`);
});

module.exports = app;
