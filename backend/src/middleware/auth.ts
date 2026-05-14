// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis } from '../lib/redis';
import { AppError } from '../lib/errors';

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new AppError('Authentication required', 401);

    // Check blacklist
    const blacklisted = await redis.get(`blacklist:${token}`);
    if (blacklisted) throw new AppError('Token has been revoked', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      next(new AppError('Invalid or expired token', 401));
    } else {
      next(err);
    }
  }
};

export const requireRole = (...roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError('Insufficient permissions', 403));
  }
  next();
};

// src/middleware/validate.ts
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
    });
  }
  req.body = result.data;
  next();
};

// src/middleware/errorHandler.ts
import { logger } from '../lib/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  if (status === 500) {
    logger.error(`${req.method} ${req.path} - ${message}`, { stack: err.stack });
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// src/lib/errors.ts
export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

declare global { var __prisma: PrismaClient | undefined; }

export const prisma = global.__prisma || new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'] });
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

// src/lib/redis.ts
import { createClient } from 'redis';
import { logger } from './logger';

export const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', (err) => logger.error('Redis error:', err));
redis.connect().catch(logger.error);

// src/lib/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production' ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV === 'production' ? [new winston.transports.File({ filename: 'logs/error.log', level: 'error' }), new winston.transports.File({ filename: 'logs/combined.log' })] : [])
  ],
});
