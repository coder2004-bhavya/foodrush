// src/routes/payment.ts
import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { AppError } from '../lib/errors';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });
const router = Router();

// POST /api/payments/create-intent
router.post('/create-intent', authenticate, async (req: any, res, next) => {
  try {
    const { orderId } = req.body;
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.user.userId, paymentStatus: 'PENDING' }
    });
    if (!order) throw new AppError('Order not found', 404);

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // paise
      currency: 'inr',
      metadata: { orderId, userId: req.user.userId },
    });

    await prisma.order.update({ where: { id: orderId }, data: { stripePaymentId: intent.id } });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) { next(err); }
});

// POST /api/payments/webhook — Stripe webhook
router.post('/webhook', async (req, res, next) => {
  const sig = req.headers['stripe-signature'] as string;
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata.orderId;
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID', status: 'CONFIRMED', confirmedAt: new Date() }
      });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await prisma.order.update({
        where: { stripePaymentId: intent.id },
        data: { paymentStatus: 'FAILED' }
      });
    }

    res.json({ received: true });
  } catch (err) { next(err); }
});

export default router;
