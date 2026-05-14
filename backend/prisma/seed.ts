// prisma/seed.ts
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@foodrush.com' },
    update: {},
    create: { email: 'admin@foodrush.com', name: 'Admin User', passwordHash, role: Role.ADMIN, isVerified: true, loyaltyPoints: 0 }
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: { email: 'customer@example.com', name: 'Rahul Sharma', phone: '+919876543210', passwordHash, role: Role.CUSTOMER, isVerified: true, loyaltyPoints: 250 }
  });

  const owner1 = await prisma.user.upsert({
    where: { email: 'owner1@example.com' },
    update: {},
    create: { email: 'owner1@example.com', name: 'Priya Patel', passwordHash, role: Role.RESTAURANT_OWNER, isVerified: true }
  });

  const owner2 = await prisma.user.upsert({
    where: { email: 'owner2@example.com' },
    update: {},
    create: { email: 'owner2@example.com', name: 'Arun Kumar', passwordHash, role: Role.RESTAURANT_OWNER, isVerified: true }
  });

  // ── Addresses ──────────────────────────────────────────────────────────
  await prisma.address.upsert({
    where: { id: 'addr-1' },
    update: {},
    create: { id: 'addr-1', userId: customer.id, label: 'Home', line1: '45 MG Road', city: 'Lucknow', state: 'UP', pincode: '226001', lat: 26.8467, lng: 80.9462, isDefault: true }
  });

  // ── Restaurant 1: Spice Garden ──────────────────────────────────────────
  const restaurant1 = await prisma.restaurant.upsert({
    where: { slug: 'spice-garden' },
    update: {},
    create: {
      ownerId: owner1.id,
      name: 'Spice Garden',
      slug: 'spice-garden',
      description: 'Authentic North Indian cuisine with rich flavors and aromatic spices.',
      logo: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200&h=200&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=400&fit=crop',
      cuisines: ['North Indian', 'Mughlai'],
      tags: ['Best Seller', 'Pure Veg'],
      phone: '+919876543201',
      addressLine: '12 Hazratganj Market',
      city: 'Lucknow', state: 'UP', pincode: '226001',
      lat: 26.8521, lng: 80.9384,
      openingTime: '10:00', closingTime: '23:00',
      isApproved: true, avgRating: 4.5, totalReviews: 342, totalOrders: 1240,
      minOrderAmount: 150, deliveryFee: 30, avgDeliveryMin: 35,
    }
  });

  // Categories for Restaurant 1
  const cat1 = await prisma.menuCategory.create({ data: { restaurantId: restaurant1.id, name: 'Starters', sortOrder: 1 } });
  const cat2 = await prisma.menuCategory.create({ data: { restaurantId: restaurant1.id, name: 'Main Course', sortOrder: 2 } });
  const cat3 = await prisma.menuCategory.create({ data: { restaurantId: restaurant1.id, name: 'Breads', sortOrder: 3 } });
  const cat4 = await prisma.menuCategory.create({ data: { restaurantId: restaurant1.id, name: 'Desserts', sortOrder: 4 } });

  // Menu Items
  await prisma.menuItem.createMany({ data: [
    { restaurantId: restaurant1.id, categoryId: cat1.id, name: 'Paneer Tikka', description: 'Marinated cottage cheese grilled in tandoor', price: 299, isVeg: true, spiceLevel: 2, isPopular: true, image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=400&fit=crop', tags: ['Bestseller'] },
    { restaurantId: restaurant1.id, categoryId: cat1.id, name: 'Veg Seekh Kebab', description: 'Mixed vegetable kebabs with aromatic spices', price: 249, isVeg: true, spiceLevel: 2 },
    { restaurantId: restaurant1.id, categoryId: cat2.id, name: 'Dal Makhani', description: 'Slow-cooked black lentils in rich tomato cream sauce', price: 349, isVeg: true, spiceLevel: 1, isPopular: true, image: 'https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=400&fit=crop' },
    { restaurantId: restaurant1.id, categoryId: cat2.id, name: 'Palak Paneer', description: 'Fresh spinach curry with cottage cheese', price: 329, isVeg: true, spiceLevel: 1 },
    { restaurantId: restaurant1.id, categoryId: cat2.id, name: 'Shahi Paneer', description: 'Cottage cheese in rich royal gravy', price: 369, isVeg: true, spiceLevel: 1 },
    { restaurantId: restaurant1.id, categoryId: cat3.id, name: 'Butter Naan', description: 'Soft leavened bread baked in tandoor', price: 59, isVeg: true, spiceLevel: 0 },
    { restaurantId: restaurant1.id, categoryId: cat3.id, name: 'Garlic Roti', description: 'Whole wheat roti with garlic butter', price: 49, isVeg: true, spiceLevel: 0 },
    { restaurantId: restaurant1.id, categoryId: cat4.id, name: 'Gulab Jamun', description: 'Soft milk solids dumplings in sugar syrup', price: 149, isVeg: true, spiceLevel: 0, image: 'https://images.unsplash.com/photo-1602351447937-745cb720612f?w=400&fit=crop' },
    { restaurantId: restaurant1.id, categoryId: cat4.id, name: 'Phirni', description: 'Chilled rice pudding garnished with pistachios', price: 129, isVeg: true, spiceLevel: 0 },
  ]});

  // ── Restaurant 2: Burger Bros ──────────────────────────────────────────
  const restaurant2 = await prisma.restaurant.upsert({
    where: { slug: 'burger-bros' },
    update: {},
    create: {
      ownerId: owner2.id,
      name: 'Burger Bros',
      slug: 'burger-bros',
      description: 'Gourmet burgers crafted with the finest ingredients. No shortcuts, all flavour.',
      logo: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop',
      coverImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop',
      cuisines: ['American', 'Fast Food'],
      tags: ['Trending', 'Non-Veg'],
      phone: '+919876543202',
      addressLine: '8 Gomti Nagar, Sector 2',
      city: 'Lucknow', state: 'UP', pincode: '226010',
      lat: 26.8599, lng: 81.0064,
      openingTime: '11:00', closingTime: '00:00',
      isApproved: true, avgRating: 4.3, totalReviews: 218, totalOrders: 876,
      minOrderAmount: 200, deliveryFee: 40, avgDeliveryMin: 25,
    }
  });

  const bcat1 = await prisma.menuCategory.create({ data: { restaurantId: restaurant2.id, name: 'Burgers', sortOrder: 1 } });
  const bcat2 = await prisma.menuCategory.create({ data: { restaurantId: restaurant2.id, name: 'Sides', sortOrder: 2 } });
  const bcat3 = await prisma.menuCategory.create({ data: { restaurantId: restaurant2.id, name: 'Beverages', sortOrder: 3 } });

  await prisma.menuItem.createMany({ data: [
    { restaurantId: restaurant2.id, categoryId: bcat1.id, name: 'Classic Smash Burger', description: 'Double smash patty, American cheese, special sauce', price: 349, isVeg: false, spiceLevel: 1, isPopular: true, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&fit=crop', tags: ['Bestseller'] },
    { restaurantId: restaurant2.id, categoryId: bcat1.id, name: 'Crispy Chicken Burger', description: 'Fried chicken thigh, coleslaw, honey mustard', price: 329, isVeg: false, spiceLevel: 2, isPopular: true },
    { restaurantId: restaurant2.id, categoryId: bcat1.id, name: 'Veggie Stack', description: 'Grilled portobello, feta, avocado', price: 289, isVeg: true, spiceLevel: 0 },
    { restaurantId: restaurant2.id, categoryId: bcat2.id, name: 'Loaded Fries', description: 'Crispy fries with cheese sauce and jalapeños', price: 199, isVeg: true, spiceLevel: 2, isPopular: true },
    { restaurantId: restaurant2.id, categoryId: bcat2.id, name: 'Onion Rings', description: 'Beer-battered crispy onion rings', price: 149, isVeg: true, spiceLevel: 0 },
    { restaurantId: restaurant2.id, categoryId: bcat3.id, name: 'Thick Milkshake', description: 'Choose: Chocolate, Vanilla, Strawberry', price: 199, isVeg: true, spiceLevel: 0 },
    { restaurantId: restaurant2.id, categoryId: bcat3.id, name: 'Lemonade', description: 'Fresh squeezed with mint', price: 99, isVeg: true, spiceLevel: 0 },
  ]});

  // ── Coupons ────────────────────────────────────────────────────────────
  await prisma.coupon.createMany({ data: [
    { code: 'WELCOME50', type: 'FLAT', value: 50, minOrderAmount: 200, perUserLimit: 1, validFrom: new Date(), validUntil: new Date(Date.now() + 30*24*60*60*1000), isActive: true },
    { code: 'SAVE20', type: 'PERCENTAGE', value: 20, minOrderAmount: 300, maxDiscount: 100, perUserLimit: 3, validFrom: new Date(), validUntil: new Date(Date.now() + 15*24*60*60*1000), isActive: true },
    { code: 'FREEDEL', type: 'FREE_DELIVERY', value: 0, minOrderAmount: 199, perUserLimit: 2, validFrom: new Date(), validUntil: new Date(Date.now() + 7*24*60*60*1000), isActive: true },
  ]});

  // ── Loyalty transaction for seeded customer ────────────────────────────
  await prisma.loyaltyTransaction.create({ data: { userId: customer.id, points: 250, type: 'SIGNUP_BONUS', description: 'Welcome bonus points!' }});

  console.log('✅ Seed complete!');
  console.log('\n📋 Test Credentials:');
  console.log('  Customer: customer@example.com / Password123!');
  console.log('  Restaurant Owner: owner1@example.com / Password123!');
  console.log('  Admin: admin@foodrush.com / Password123!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
