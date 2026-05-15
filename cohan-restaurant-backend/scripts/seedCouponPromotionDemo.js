import 'dotenv/config.js';
import mongoose from 'mongoose';
import { Coupon, Promotion, Restaurant, MenuItem } from '../models/index.js';

const DEMO_TAG = '[demo-coupon-promotion-2026]';
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || '';

function nowPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID);
    if (!restaurant) throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    return restaurant;
  }

  const existing = await Restaurant.findOne({ status: 'active' }).sort({ createdAt: 1 });
  if (!existing) {
    throw new Error('NO_ACTIVE_RESTAURANT_FOUND: seed restaurant data first or provide DEMO_RESTAURANT_ID');
  }
  return existing;
}

async function seedCoupons(restaurantId) {
  const now = new Date();
  const couponDefs = [
    {
      name: 'Active 10% Coupon',
      code: 'ACTIVE10',
      description: `10% active coupon ${DEMO_TAG}`,
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderValue: 100000,
      maxDiscount: 50000,
      maxUsage: 200,
      used: 0,
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(30),
      isActive: true,
    },
    {
      name: 'Fixed 20k Coupon',
      code: 'FIXED20K',
      description: `20,000 VND off ${DEMO_TAG}`,
      discountType: 'AMOUNT',
      discountValue: 20000,
      minOrderValue: 120000,
      maxUsage: 300,
      used: 0,
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(30),
      isActive: true,
    },
    {
      name: 'Expired 10% Coupon',
      code: 'EXPIRED10',
      description: `Expired validation demo ${DEMO_TAG}`,
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderValue: 100000,
      maxUsage: 100,
      used: 20,
      startAt: nowPlusDays(-40),
      endAt: nowPlusDays(-2),
      isActive: true,
    },
    {
      name: 'Limit 5 Coupon',
      code: 'LIMIT5',
      description: `Near max usage demo ${DEMO_TAG}`,
      discountType: 'PERCENT',
      discountValue: 5,
      minOrderValue: 80000,
      maxUsage: 100,
      used: 99,
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(30),
      isActive: true,
    },
    {
      name: 'User Only Coupon',
      code: 'USERONLY',
      description: `Per-user limit via constraints ${DEMO_TAG}`,
      discountType: 'AMOUNT',
      discountValue: 15000,
      minOrderValue: 90000,
      maxUsage: 500,
      used: 0,
      constraints: { perUserLimit: 1, note: DEMO_TAG },
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(30),
      isActive: true,
    },
  ];

  for (const coupon of couponDefs) {
    await Coupon.findOneAndUpdate(
      { restaurantId, code: coupon.code },
      { $set: { ...coupon, restaurantId, publishAt: now } },
      { upsert: true, new: true }
    );
  }
}

async function seedPromotions(restaurantId) {
  const menuItems = await MenuItem.find({ restaurantId, isDeleted: { $ne: true } }).select('_id name').lean();
  const pho = menuItems.find((m) => /pho/i.test(m.name));
  const tea = menuItems.find((m) => /tea|tra/i.test(m.name));

  const comboItems = menuItems.slice(0, 2).map((item) => ({ itemId: item._id, quantity: 1 }));

  const defs = [
    {
      name: 'Lunch 10% percentage',
      code: 'LUNCH10',
      promotionType: 'PERCENTAGE',
      scope: 'ORDER',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderValue: 120000,
      maxDiscount: 50000,
      stacking: false,
    },
    {
      name: 'Fixed 20k order discount',
      code: 'ORDER20K',
      promotionType: 'FIXED',
      scope: 'ORDER',
      discountType: 'AMOUNT',
      discountValue: 20000,
      minOrderValue: 150000,
      stacking: false,
    },
    {
      name: 'Buy Pho get Tea BOGO',
      code: 'PHOTEA',
      promotionType: 'BOGO',
      scope: pho ? 'ITEM' : 'ORDER',
      itemId: pho?._id,
      giftItemId: tea?._id || null,
      buyQuantity: 1,
      getQuantity: 1,
      discountType: 'PERCENT',
      discountValue: 100,
      stacking: false,
    },
    {
      name: 'Freeship order promotion',
      code: 'FREESHIP',
      promotionType: 'FREESHIP',
      scope: 'ORDER',
      discountType: 'AMOUNT',
      discountValue: 30000,
      minOrderValue: 100000,
      stacking: true,
    },
    {
      name: 'Family Combo promotion',
      code: 'FAMILYCOMBO',
      promotionType: 'COMBO',
      scope: 'ORDER',
      comboItems,
      discountType: 'PERCENT',
      discountValue: 15,
      minOrderValue: 200000,
      stacking: false,
    },
  ];

  for (const promotion of defs) {
    await Promotion.findOneAndUpdate(
      { restaurantId, name: promotion.name },
      {
        $set: {
          ...promotion,
          restaurantId,
          description: `${promotion.name} ${DEMO_TAG}`,
          startAt: nowPlusDays(-3),
          endAt: nowPlusDays(45),
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
  }
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const DB_NAME = process.env.MONGO_DB || 'foodhub';
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });

  const restaurant = await resolveRestaurant();
  await seedCoupons(restaurant._id);
  await seedPromotions(restaurant._id);

  console.log('Coupon/Promotion demo data seeded successfully.');
  console.log(`Restaurant: ${restaurant._id} - ${restaurant.name}`);
  if (!DEMO_RESTAURANT_ID) {
    console.log('Tip: set DEMO_RESTAURANT_ID to target a specific restaurant.');
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
