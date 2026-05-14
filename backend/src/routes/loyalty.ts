// src/routes/loyalty.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
const router = Router();
router.use(authenticate);

router.get('/history', async (req: any, res, next) => {
  try {
    const history = await prisma.loyaltyTransaction.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(history);
  } catch (err) { next(err); }
});

export default router;
