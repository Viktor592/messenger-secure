import express, { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

import authRoutes from './routes/auth';
import contactsRoutes from './routes/contacts';
import messageRoutes from './routes/messages';
import groupRoutes from './routes/groups';
import { setupSocketHandlers } from './socket/handlers';
import { errorHandler } from './middleware/errors';
import { requestLogger } from './middleware/logger';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Initialize Express app
const app: Express = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e5, // 100KB for messages
});

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Redis event handlers
redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err));

// ============================================
// Middleware Setup
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Handled by nginx
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));

// CORS
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use(requestLogger(logger));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});
app.use(limiter);

// ============================================
// Routes
// ============================================

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

// Error handler (must be last)
app.use(errorHandler);

// ============================================
// Socket.io Setup
// ============================================

// Socket authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    // Token verification would happen here
    // For now, just store connection info
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    socket.data.userId = decodedToken.userId;
    socket.data.phoneHash = decodedToken.phoneHash;
    next();
  } catch (err) {
    next(new Error('Invalid authentication token'));
  }
});

// Setup Socket.io event handlers
setupSocketHandlers(io, prisma, redis, logger);

// Socket.io events
io.on('connection', async (socket) => {
  const userId = socket.data.userId;

  logger.info(`User connected: ${userId}`);

  // Store presence in Redis (no persistence)
  await redis.setex(`presence:${userId}`, 3600, JSON.stringify({
    online: true,
    lastActive: Date.now(),
    socketId: socket.id,
  }));

  // Notify contacts that user is online
  socket.emit('connection_ready', { userId, socketId: socket.id });

  socket.on('disconnect', async () => {
    logger.info(`User disconnected: ${userId}`);
    await redis.del(`presence:${userId}`);
  });
});

// ============================================
// Server Startup
// ============================================

const PORT = parseInt(process.env.PORT || '3001');
const ADDRESS = process.env.API_URL || `http://localhost:${PORT}`;

server.listen(PORT, () => {
  logger.info(`🚀 Messenger Secure Server running at ${ADDRESS}`);
  logger.info(`📊 Socket.io ready for WebSocket connections`);
  logger.info(`🔒 Security: TLS, CORS, Rate Limiting enabled`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('⏹️ Shutting down gracefully...');

  // Close Socket.io
  io.close();

  // Close server
  server.close(async () => {
    // Disconnect Prisma
    await prisma.$disconnect();

    // Disconnect Redis
    await redis.quit();

    logger.info('✅ Server shut down successfully');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.warn('⚠️ Forcing shutdown...');
    process.exit(1);
  }, 10000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

export { app, server, io, prisma, redis, logger };
