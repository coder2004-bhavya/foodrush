// src/routes/user.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/auth';
import { AppError } from '../lib/errors';

const router = Router();
router.use(authenticate);

const addressSchema = z.object({
  label: z.string().min(1).max(50),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().regex(/^\d{6}$/),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/users/addresses
router.get('/addresses', async (req: any, res, next) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }]
    });
    res.json(addresses);
  } catch (err) { next(err); }
});

// POST /api/users/addresses
router.post('/addresses', async (req: any, res, next) => {
  try {
    const data = addressSchema.parse(req.body);
    const userId = req.user.userId;

    if (data.isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const addr = await prisma.address.create({ data: { ...data, userId } });
    res.status(201).json(addr);
  } catch (err) { next(err); }
});

// PUT /api/users/addresses/:id
router.put('/addresses/:id', async (req: any, res, next) => {
  try {
    const data = addressSchema.parse(req.body);
    const userId = req.user.userId;

    const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } });
    if (!existing) throw new AppError('Address not found', 404);

    if (data.isDefault) {
      await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const addr = await prisma.address.update({ where: { id: req.params.id }, data });
    res.json(addr);
  } catch (err) { next(err); }
});

// DELETE /api/users/addresses/:id
router.delete('/addresses/:id', async (req: any, res, next) => {
  try {
    const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user.userId } });
    if (!existing) throw new AppError('Address not found', 404);
    await prisma.address.delete({ where: { id: req.params.id } });
    res.json({ message: 'Address deleted' });
  } catch (err) { next(err); }
});

// GET /api/users/profile
router.get('/profile', async (req: any, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, phone: true, avatar: true, loyaltyPoints: true, role: true, isVerified: true, createdAt: true }
    });
    if (!user) throw new AppError('User not found', 404);
    res.json(user);
  } catch (err) { next(err); }
});

// PATCH /api/users/profile
router.patch('/profile', async (req: any, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: { ...(name && { name }), ...(phone && { phone }) },
      select: { id: true, name: true, email: true, phone: true, avatar: true, loyaltyPoints: true, role: true }
    });
    res.json(user);
  } catch (err) { next(err); }
});

export default router;
