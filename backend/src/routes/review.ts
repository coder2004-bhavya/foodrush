// src/routes/review.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../lib/errors';
const router = Router();

router.post('/', authenticate, async (req: any, res, next) => {
  try {
    const { orderId, restaurantId, rating, comment, foodRating, deliveryRating } = req.body;
    const userId = req.user.userId;

    const order = await prisma.order.findFirst({ where: { id: orderId, userId, status: 'DELIVERED' } });
    if (!order) throw new AppError('Order not found or not delivered yet', 400);

    const existing = await prisma.review.findUnique({ where: { orderId } });
    if (existing) throw new AppError('Review already submitted', 400);

    const review = await prisma.$transaction(async (tx) => {
      const r = await tx.review.create({ data: { userId, restaurantId, orderId, rating, comment, foodRating, deliveryRating } });

      // Update restaurant avg rating
      const agg = await tx.review.aggregate({ where: { restaurantId }, _avg: { rating: true }, _count: true });
      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { avgRating: agg._avg.rating || rating, totalReviews: agg._count }
      });
      return r;
    });
    res.status(201).json(review);
  } catch (err) { next(err); }
});

router.get('/restaurant/:restaurantId', async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { restaurantId: req.params.restaurantId },
      include: { user: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(reviews);
  } catch (err) { next(err); }
});

export default router;
