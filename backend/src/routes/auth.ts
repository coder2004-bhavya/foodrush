// src/routes/auth.ts
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { AppError } from '../lib/errors';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  role: z.enum(['CUSTOMER', 'RESTAURANT_OWNER', 'DELIVERY_PARTNER']).default('CUSTOMER'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] }
    });
    if (existing) throw new AppError('User already exists with this email or phone', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, phone, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, loyaltyPoints: true }
    });

    // Signup bonus
    if (role === 'CUSTOMER') {
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { loyaltyPoints: { increment: 100 } } }),
        prisma.loyaltyTransaction.create({ data: { userId: user.id, points: 100, type: 'SIGNUP_BONUS', description: 'Welcome to FoodRush!' } })
      ]);
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000) } });

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, passwordHash: true, isActive: true, loyaltyPoints: true, avatar: true }
    });
    if (!user || !user.isActive) throw new AppError('Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid credentials', 401);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000) } });

    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) { next(err); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required', 400);

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: { select: { id: true, role: true, isActive: true } } } });
    if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) throw new AppError('Invalid or expired refresh token', 401);

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(stored.user.id, stored.user.role);

    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: refreshToken } }),
      prisma.refreshToken.create({ data: { token: newRefreshToken, userId: stored.user.id, expiresAt: new Date(Date.now() + 7*24*60*60*1000) } })
    ]);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: any, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });

    // Blacklist access token in Redis
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token) as any;
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) await redis.setEx(`blacklist:${token}`, ttl, '1');
      }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, phone: true, role: true, avatar: true, loyaltyPoints: true, isVerified: true, createdAt: true }
    });
    if (!user) throw new AppError('User not found', 404);
    res.json(user);
  } catch (err) { next(err); }
});

export default router;
