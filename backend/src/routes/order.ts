// src/routes/order.ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AppError } from '../lib/errors';
import { io } from '../index';

const router = Router();
router.use(authenticate);

const createOrderSchema = z.object({
  restaurantId: z.string(),
  deliveryAddressId: z.string(),
  items: z.array(z.object({
    menuItemId: z.string(),
    quantity: z.number().int().min(1),
    customizations: z.any().optional(),
    notes: z.string().optional(),
  })).min(1),
  paymentMethod: z.enum(['CARD', 'UPI', 'CASH_ON_DELIVERY', 'WALLET']),
  couponCode: z.string().optional(),
  loyaltyPointsToUse: z.number().int().min(0).optional(),
  specialInstructions: z.string().optional(),
});

// GET /api/orders — list user's orders
router.get('/', async (req: any, res, next) => {
  try {
    const { page = '1', limit = '10', status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = { userId: req.user.userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          restaurant: { select: { name: true, logo: true, slug: true } },
          items: { include: { menuItem: { select: { name: true, image: true } } } },
          deliveryAddress: true,
          review: true,
        },
        orderBy: { createdAt: 'desc' },
        skip, take: parseInt(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
});

// GET /api/orders/:id
router.get('/:id', async (req: any, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
      include: {
        restaurant: { select: { name: true, logo: true, phone: true, addressLine: true } },
        items: { include: { menuItem: true } },
        deliveryAddress: true,
        deliveryPartner: { include: { user: { select: { name: true, phone: true } } } },
        tracking: { orderBy: { createdAt: 'asc' } },
        review: true,
        chatRoom: true,
      }
    });
    if (!order) throw new AppError('Order not found', 404);
    res.json(order);
  } catch (err) { next(err); }
});

// POST /api/orders — create order
router.post('/', validate(createOrderSchema), async (req: any, res, next) => {
  try {
    const { restaurantId, deliveryAddressId, items, paymentMethod, couponCode, loyaltyPointsToUse = 0, specialInstructions } = req.body;
    const userId = req.user.userId;

    // Validate address belongs to user
    const address = await prisma.address.findFirst({ where: { id: deliveryAddressId, userId } });
    if (!address) throw new AppError('Invalid delivery address', 400);

    // Fetch restaurant & validate open
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant || !restaurant.isApproved) throw new AppError('Restaurant unavailable', 400);

    // Fetch menu items & calculate subtotal
    const menuItemIds = items.map((i: any) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds }, restaurantId, isAvailable: true } });
    if (menuItems.length !== menuItemIds.length) throw new AppError('Some items are unavailable', 400);

    const itemMap = new Map(menuItems.map(m => [m.id, m]));
    let subtotal = 0;
    const orderItems = items.map((item: any) => {
      const menuItem = itemMap.get(item.menuItemId)!;
      const price = menuItem.discountedPrice || menuItem.price;
      subtotal += price * item.quantity;
      return { menuItemId: item.menuItemId, name: menuItem.name, price, quantity: item.quantity, customizations: item.customizations, notes: item.notes };
    });

    if (subtotal < restaurant.minOrderAmount) throw new AppError(`Minimum order is ₹${restaurant.minOrderAmount}`, 400);

    // Apply coupon
    let discount = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode, isActive: true } });
      if (!coupon || coupon.validUntil < new Date() || subtotal < coupon.minOrderAmount) throw new AppError('Invalid or expired coupon', 400);

      const userUsage = await prisma.userCoupon.count({ where: { userId, couponId: coupon.id } });
      if (userUsage >= coupon.perUserLimit) throw new AppError('Coupon usage limit reached', 400);

      if (coupon.type === 'FLAT') discount = coupon.value;
      else if (coupon.type === 'PERCENTAGE') discount = Math.min(subtotal * coupon.value / 100, coupon.maxDiscount || Infinity);
      else if (coupon.type === 'FREE_DELIVERY') discount = restaurant.deliveryFee;
    }

    // Loyalty points (1 point = ₹0.25)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { loyaltyPoints: true } });
    const maxPointsUsable = Math.min(loyaltyPointsToUse, user!.loyaltyPoints, Math.floor(subtotal / 0.25));
    const loyaltyDiscount = maxPointsUsable * 0.25;

    const taxes = (subtotal - discount - loyaltyDiscount) * 0.05; // 5% GST
    const deliveryFee = couponCode ? (discount === restaurant.deliveryFee ? 0 : restaurant.deliveryFee) : restaurant.deliveryFee;
    const total = Math.max(0, subtotal - discount - loyaltyDiscount + taxes + deliveryFee);

    // Points earned = 1 point per ₹10 spent
    const pointsEarned = Math.floor(total / 10);

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId, restaurantId, deliveryAddressId,
          status: 'PENDING', paymentMethod,
          subtotal, deliveryFee, taxes,
          discount: discount + loyaltyDiscount,
          total, couponCode,
          loyaltyPointsUsed: maxPointsUsable,
          loyaltyPointsEarned: pointsEarned,
          specialInstructions,
          estimatedDeliveryMin: restaurant.avgDeliveryMin,
          items: { createMany: { data: orderItems } },
        },
        include: { items: true, restaurant: { select: { name: true } }, deliveryAddress: true }
      });

      // Create initial tracking event
      await tx.orderTracking.create({ data: { orderId: newOrder.id, status: 'PENDING', message: 'Order placed successfully' } });

      // Create chat room
      await tx.chatRoom.create({ data: { orderId: newOrder.id } });

      // Deduct loyalty points
      if (maxPointsUsable > 0) {
        await tx.user.update({ where: { id: userId }, data: { loyaltyPoints: { decrement: maxPointsUsable } } });
        await tx.loyaltyTransaction.create({ data: { userId, points: -maxPointsUsable, type: 'ORDER_REDEEMED', description: `Redeemed for order #${newOrder.orderNumber}`, orderId: newOrder.id } });
      }

      // Record coupon usage
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
        if (coupon) {
          await tx.userCoupon.create({ data: { userId, couponId: coupon.id } });
          await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
        }
      }

      return newOrder;
    });

    // Emit to restaurant via socket
    io.to(`restaurant:${restaurantId}`).emit('new:order', { orderId: order.id, restaurantName: order.restaurant.name });

    // Cache order status in Redis
    await redis.setEx(`order:${order.id}:status`, 86400, 'PENDING');

    res.status(201).json(order);
  } catch (err) { next(err); }
});

// PATCH /api/orders/:id/status — restaurant/admin update status
router.patch('/:id/status', async (req: any, res, next) => {
  try {
    const { status, message, lat, lng } = req.body;
    const orderId = req.params.id;

    // Find order and check permissions
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { restaurant: { select: { ownerId: true } } }
    });
    if (!order) throw new AppError('Order not found', 404);

    const isOwner = order.restaurant.ownerId === req.user.userId;
    const isAdmin = req.user.role === 'ADMIN';
    const isDelivery = req.user.role === 'DELIVERY_PARTNER';
    if (!isOwner && !isAdmin && !isDelivery) throw new AppError('Forbidden', 403);

    const statusTimestamps: Record<string, string> = {
      CONFIRMED: 'confirmedAt', READY_FOR_PICKUP: 'preparedAt',
      OUT_FOR_DELIVERY: 'pickedUpAt', DELIVERED: 'deliveredAt', CANCELLED: 'cancelledAt',
    };

    const updateData: any = { status };
    if (statusTimestamps[status]) updateData[statusTimestamps[status]] = new Date();

    // Award loyalty points on delivery
    if (status === 'DELIVERED') {
      await prisma.$transaction([
        prisma.order.update({ where: { id: orderId }, data: { ...updateData, paymentStatus: 'PAID' } }),
        prisma.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: order.loyaltyPointsEarned } } }),
        prisma.loyaltyTransaction.create({ data: { userId: order.userId, points: order.loyaltyPointsEarned, type: 'ORDER_EARNED', description: `Earned from order #${order.orderNumber}`, orderId } }),
        prisma.orderTracking.create({ data: { orderId, status, message: message || 'Order delivered!', lat, lng } }),
        prisma.restaurant.update({ where: { id: order.restaurantId }, data: { totalOrders: { increment: 1 } } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.order.update({ where: { id: orderId }, data: updateData }),
        prisma.orderTracking.create({ data: { orderId, status, message: message || `Status updated to ${status}`, lat, lng } }),
      ]);
    }

    // Update Redis
    await redis.setEx(`order:${orderId}:status`, 86400, status);

    // Emit real-time update to customer
    io.to(`order:${orderId}`).emit('order:status', { orderId, status, message, timestamp: new Date() });
    io.to(`user:${order.userId}`).emit('notification', { type: 'ORDER_UPDATE', title: 'Order Update', body: `Your order is now ${status.toLowerCase().replace(/_/g, ' ')}` });

    res.json({ message: 'Status updated', status });
  } catch (err) { next(err); }
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', async (req: any, res, next) => {
  try {
    const { reason } = req.body;
    const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user.userId } });
    if (!order) throw new AppError('Order not found', 404);
    if (!['PENDING', 'CONFIRMED'].includes(order.status)) throw new AppError('Order cannot be cancelled at this stage', 400);

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason }
    });

    // Refund loyalty points
    if (order.loyaltyPointsUsed > 0) {
      await prisma.$transaction([
        prisma.user.update({ where: { id: req.user.userId }, data: { loyaltyPoints: { increment: order.loyaltyPointsUsed } } }),
        prisma.loyaltyTransaction.create({ data: { userId: req.user.userId, points: order.loyaltyPointsUsed, type: 'ORDER_REDEEMED', description: `Refunded from cancelled order #${order.orderNumber}` } })
      ]);
    }

    io.to(`restaurant:${order.restaurantId}`).emit('order:cancelled', { orderId: order.id });
    res.json({ message: 'Order cancelled successfully' });
  } catch (err) { next(err); }
});

export default router;
