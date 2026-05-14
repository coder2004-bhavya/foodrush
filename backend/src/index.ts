// src/index.ts
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers } from './socket';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import restaurantRoutes from './routes/restaurant';
import menuRoutes from './routes/menu';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/order';
import couponRoutes from './routes/coupon';
import reviewRoutes from './routes/review';
import loyaltyRoutes from './routes/loyalty';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/upload';
import paymentRoutes from './routes/payment';

const app = express();
const httpServer = createServer(app);

// ── Socket.IO ──────────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});

setupSocketHandlers(io);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Stricter limiter for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts.' },
});

// ── Health Check ──────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  const redisOk = await redis.ping().then(() => true).catch(() => false);
  res.json({
    status: dbOk && redisOk ? 'healthy' : 'degraded',
    db: dbOk, redis: redisOk,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentRoutes);

// ── Error Handler ──────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, async () => {
  logger.info(`🚀 FoodRush API running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Test DB connection
  await prisma.$connect();
  logger.info('✅ Database connected');

  // Test Redis connection
  await redis.ping();
  logger.info('✅ Redis connected');
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  httpServer.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

export default app;
