// src/routes/restaurant.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../lib/errors';

const router = Router();

// GET /api/restaurants — list with filters
router.get('/', async (req, res, next) => {
  try {
    const { search, cuisine, filters, sort = 'relevance', page = '1', limit = '20', lat, lng } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { isApproved: true, isActive: true };
    if (search) where.OR = [{ name: { contains: search as string, mode: 'insensitive' } }, { cuisines: { has: search as string } }];
    if (cuisine) where.cuisines = { has: cuisine as string };
    if ((filters as string)?.includes('Pure Veg')) where.tags = { has: 'Pure Veg' };

    const orderBy: any =
      sort === 'rating' ? { avgRating: 'desc' } :
      sort === 'delivery_time' ? { avgDeliveryMin: 'asc' } :
      sort === 'price_low' ? { deliveryFee: 'asc' } :
      { totalOrders: 'desc' };

    const [restaurants, total] = await Promise.all([
      prisma.restaurant.findMany({ where, orderBy, skip, take: parseInt(limit as string), select: { id: true, name: true, slug: true, logo: true, coverImage: true, cuisines: true, tags: true, avgRating: true, totalReviews: true, avgDeliveryMin: true, deliveryFee: true, minOrderAmount: true, isOpen: true, city: true } }),
      prisma.restaurant.count({ where }),
    ]);

    res.json({ restaurants, total, page: parseInt(page as string) });
  } catch (err) { next(err); }
});

// GET /api/restaurants/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: req.params.slug },
      include: {
        menuCategories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { items: { where: { isAvailable: true }, orderBy: [{ isPopular: 'desc' }, { sortOrder: 'asc' }] } }
        }
      }
    });
    if (!restaurant) throw new AppError('Restaurant not found', 404);

    const { menuCategories, ...rest } = restaurant;
    res.json({ restaurant: rest, categories: menuCategories });
  } catch (err) { next(err); }
});

export default router;
