// src/socket/index.ts
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

interface AuthSocket extends Socket {
  userId?: string;
  userRole?: string;
  userName?: string;
}

export function setupSocketHandlers(io: Server) {

  // ── Auth Middleware ──────────────────────────────────────────────────────
  io.use(async (socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const user = await prisma.user.findUnique({
        where: { id: payload.userId, isActive: true },
        select: { id: true, role: true, name: true }
      });
      if (!user) return next(new Error('User not found'));

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.userName = user.name;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    logger.info(`Socket connected: ${socket.id} (${socket.userName})`);

    // Join personal room
    socket.join(`user:${socket.userId}`);

    // ── Order Tracking ──────────────────────────────────────────────────
    socket.on('order:join', async (orderId: string) => {
      // Verify user has access to this order
      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          OR: [
            { userId: socket.userId },
            { restaurant: { ownerId: socket.userId } },
            { deliveryPartnerId: socket.userId },
          ]
        }
      });
      if (order) {
        socket.join(`order:${orderId}`);
        logger.info(`User ${socket.userId} joined order room: ${orderId}`);
      }
    });

    socket.on('order:leave', (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    // ── Restaurant Room (for owners) ────────────────────────────────────
    socket.on('restaurant:join', async (restaurantId: string) => {
      const restaurant = await prisma.restaurant.findFirst({
        where: { id: restaurantId, ownerId: socket.userId }
      });
      if (restaurant || socket.userRole === 'ADMIN') {
        socket.join(`restaurant:${restaurantId}`);
        logger.info(`Owner ${socket.userId} joined restaurant room: ${restaurantId}`);
      }
    });

    // ── Live Chat ────────────────────────────────────────────────────────
    socket.on('chat:join', async (roomId: string) => {
      const room = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        include: { order: true }
      });
      if (!room) return;

      const order = room.order;
      const hasAccess =
        order.userId === socket.userId ||
        order.deliveryPartnerId === socket.userId ||
        socket.userRole === 'RESTAURANT_OWNER' ||
        socket.userRole === 'ADMIN';

      if (hasAccess) {
        socket.join(`chat:${roomId}`);
        // Mark existing messages as read
        await prisma.chatMessage.updateMany({
          where: { roomId, senderId: { not: socket.userId }, isRead: false }
        });
      }
    });

    socket.on('chat:message', async (data: { roomId: string; content: string; type?: string }) => {
      try {
        const room = await prisma.chatRoom.findUnique({
          where: { id: data.roomId },
          include: { order: true }
        });
        if (!room) return;

        const message = await prisma.chatMessage.create({
          data: {
            roomId: data.roomId,
            senderId: socket.userId!,
            senderRole: socket.userRole!,
            content: data.content,
            type: data.type || 'text',
          },
          include: { sender: { select: { name: true, avatar: true } } }
        });

        io.to(`chat:${data.roomId}`).emit('chat:message', message);

        // Notify the other party
        const recipientId = room.order.userId === socket.userId ? room.order.restaurantId : room.order.userId;
        io.to(`user:${recipientId}`).emit('chat:notification', {
          roomId: data.roomId,
          senderName: socket.userName,
          preview: data.content.substring(0, 50),
        });

      } catch (err) {
        logger.error('Chat message error:', err);
      }
    });

    socket.on('chat:typing', (roomId: string) => {
      socket.to(`chat:${roomId}`).emit('chat:typing', { userId: socket.userId, userName: socket.userName });
    });

    socket.on('chat:stop_typing', (roomId: string) => {
      socket.to(`chat:${roomId}`).emit('chat:stop_typing', { userId: socket.userId });
    });

    // ── Delivery Partner Location ────────────────────────────────────────
    socket.on('delivery:location', async (data: { orderId: string; lat: number; lng: number }) => {
      if (socket.userRole !== 'DELIVERY_PARTNER') return;

      // Update in DB
      await prisma.deliveryPartner.updateMany({
        where: { userId: socket.userId },
        data: { currentLat: data.lat, currentLng: data.lng }
      });

      // Broadcast to order watchers
      io.to(`order:${data.orderId}`).emit('delivery:location', {
        orderId: data.orderId,
        lat: data.lat,
        lng: data.lng,
        timestamp: new Date(),
      });
    });

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id} (${socket.userName})`);
      if (socket.userRole === 'DELIVERY_PARTNER') {
        prisma.deliveryPartner.updateMany({
          where: { userId: socket.userId },
          data: { isAvailable: false }
        }).catch(() => {});
      }
    });
  });

  logger.info('✅ Socket.IO handlers initialized');
}
