// src/routes/admin.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../lib/errors';
import { startOfDay, endOfDay } from 'date-fns';

const router = Router();
router.use(authenticate);

// GET /api/admin/dashboard — stats for restaurant owner
router.get('/dashboard', async (req: any, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.userId } });
    if (!restaurant && req.user.role !== 'ADMIN') throw new AppError('Restaurant not found', 404);

    const restaurantId = restaurant?.id;
    const today = new Date();
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);

    const [todayOrders, todayRevenue, pendingOrders, totalOrders] = await Promise.all([
      prisma.order.count({ where: { restaurantId, createdAt: { gte: dayStart, lte: dayEnd } } }),
      prisma.order.aggregate({ where: { restaurantId, status: 'DELIVERED', createdAt: { gte: dayStart, lte: dayEnd } }, _sum: { total: true } }),
      prisma.order.count({ where: { restaurantId, status: 'PENDING' } }),
      prisma.order.count({ where: { restaurantId } }),
    ]);

    res.json({
      restaurantId,
      restaurantName: restaurant?.name,
      avgRating: restaurant?.avgRating,
      todayOrders,
      todayRevenue: todayRevenue._sum.total || 0,
      pendingOrders,
      totalOrders,
    });
  } catch (err) { next(err); }
});

// GET /api/admin/orders — restaurant's orders
router.get('/orders', async (req: any, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.userId } });
    if (!restaurant && req.user.role !== 'ADMIN') throw new AppError('Restaurant not found', 404);

    const { status, page = '1', limit = '20' } = req.query;
    const where: any = { restaurantId: restaurant?.id };
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true, email: true } },
        items: { include: { menuItem: { select: { name: true } } } },
        deliveryAddress: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    });

    res.json(orders);
  } catch (err) { next(err); }
});

// GET /api/admin/reviews
router.get('/reviews', async (req: any, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.userId } });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    const reviews = await prisma.review.findMany({
      where: { restaurantId: restaurant.id },
      include: { user: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(reviews);
  } catch (err) { next(err); }
});

// GET /api/admin/orders/:id/chat
router.get('/orders/:id/chat', async (req: any, res, next) => {
  try {
    const chatRoom = await prisma.chatRoom.findFirst({ where: { orderId: req.params.id } });
    if (!chatRoom) return res.json([]);
    const messages = await prisma.chatMessage.findMany({
      where: { roomId: chatRoom.id },
      include: { sender: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (err) { next(err); }
});

export default router;
