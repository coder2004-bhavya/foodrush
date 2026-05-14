// src/routes/coupon.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../lib/errors';

const router = Router();

// POST /api/coupons/validate
router.post('/validate', authenticate, async (req: any, res, next) => {
  try {
    const { code, subtotal, restaurantId } = req.body;
    const userId = req.user.userId;

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase(), isActive: true }
    });

    if (!coupon) throw new AppError('Coupon not found', 404);
    if (coupon.validUntil < new Date()) throw new AppError('Coupon has expired', 400);
    if (coupon.validFrom > new Date()) throw new AppError('Coupon not yet active', 400);
    if (subtotal < coupon.minOrderAmount) throw new AppError(`Minimum order ₹${coupon.minOrderAmount} required for this coupon`, 400);
    if (coupon.restaurantId && coupon.restaurantId !== restaurantId) throw new AppError('Coupon not valid for this restaurant', 400);
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError('Coupon usage limit reached', 400);

    const userUsage = await prisma.userCoupon.count({ where: { userId, couponId: coupon.id } });
    if (userUsage >= coupon.perUserLimit) throw new AppError(`You've already used this coupon ${coupon.perUserLimit} time(s)`, 400);

    res.json({ valid: true, coupon });
  } catch (err) { next(err); }
});

// GET /api/coupons — available coupons
router.get('/', async (req: any, res, next) => {
  try {
    const now = new Date();
    const coupons = await prisma.coupon.findMany({
      where: { isActive: true, validFrom: { lte: now }, validUntil: { gte: now }, restaurantId: null },
      select: { code: true, type: true, value: true, minOrderAmount: true, maxDiscount: true, validUntil: true }
    });
    res.json(coupons);
  } catch (err) { next(err); }
});

export default router;
