import "dotenv/config.js";
import mongoose from "mongoose";
import {
  Coupon,
  MenuItem,
  Promotion,
  Restaurant,
  VoucherPackage,
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const DEFAULT_RESTAURANT_ID = "69ce9e2e8d8d711f12e251b1";
const RESTAURANT_ID =
  process.env.PROMOTION_DEMO_RESTAURANT_ID?.trim() ||
  process.argv
    .find((arg) => arg.startsWith("--restaurantId="))
    ?.split("=")[1]
    ?.trim() ||
  DEFAULT_RESTAURANT_ID;
const DEMO_TAG = "promotion-manager-demo-2026";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "cohan";

function nowPlusDays(days, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function nowPlusHours(hours) {
  const date = new Date();
  date.setHours(date.getHours() + hours, 0, 0, 0);
  return date;
}

function assertValidObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error(`INVALID_RESTAURANT_ID: ${id}`);
  }
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

async function resolveRestaurant(restaurantId) {
  assertValidObjectId(restaurantId);
  const restaurant = await Restaurant.findById(restaurantId)
    .select("_id name status")
    .lean();
  if (!restaurant) throw new Error(`RESTAURANT_NOT_FOUND: ${restaurantId}`);
  return restaurant;
}

async function loadMenuItems(restaurantId) {
  const items = await MenuItem.find({ restaurantId, isDeleted: { $ne: true } })
    .select("_id name categoryId basePrice status")
    .sort({ basePrice: -1, name: 1 })
    .limit(8)
    .lean();

  return items.map((item) => ({
    ...item,
    normalizedName: normalizeText(item.name),
  }));
}

async function upsertCoupon(restaurantId, coupon) {
  return Coupon.findOneAndUpdate(
    { restaurantId, code: coupon.code },
    {
      $set: {
        ...coupon,
        restaurantId,
        description: `${coupon.description || coupon.name} · ${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function seedCoupons(restaurantId) {
  const coupons = [
    {
      name: "NEW10 khách mới",
      code: "PM_NEW10",
      category: "order",
      description: "Giảm 10% cho khách mới, có giới hạn giảm tối đa",
      discountType: "PERCENT",
      discountValue: 10,
      minOrderValue: 120000,
      maxDiscount: 50000,
      maxUsage: 250,
      used: 36,
      publishAt: nowPlusDays(-3),
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(30),
      isActive: true,
      constraints: {
        firstOrderOnly: true,
        perUserLimit: 1,
        orderTypes: ["dine_in", "takeaway", "delivery"],
        paymentMethods: ["cash", "card", "bank_transfer", "e_wallet"],
        conditions: [
          "Chỉ áp dụng cho đơn đầu tiên",
          "Không áp dụng cùng coupon độc quyền",
        ],
      },
    },
    {
      name: "VIP giảm 50K",
      code: "PM_VIP50K",
      category: "food",
      description: "Ưu đãi tiền mặt cho khách VIP",
      discountType: "AMOUNT",
      discountValue: 50000,
      minOrderValue: 300000,
      maxDiscount: 0,
      maxUsage: 120,
      used: 28,
      publishAt: nowPlusDays(-5),
      startAt: nowPlusDays(-5),
      endAt: nowPlusDays(45),
      isActive: true,
      constraints: {
        perUserLimit: 2,
        customerRanks: ["gold", "platinum", "vip"],
        orderTypes: ["dine_in"],
        paymentMethods: ["card", "bank_transfer"],
        exclusive: true,
        priority: 2,
        conditions: ["Áp dụng cho khách VIP", "Không quy đổi thành tiền mặt"],
      },
    },
    {
      name: "Shipping 25K",
      code: "PM_SHIP25K",
      category: "shipping",
      description: "Giảm phí giao hàng cho đơn delivery",
      discountType: "AMOUNT",
      discountValue: 25000,
      minOrderValue: 180000,
      maxDiscount: 0,
      maxUsage: 180,
      used: 64,
      publishAt: nowPlusDays(-4),
      startAt: nowPlusDays(-4),
      endAt: nowPlusDays(21),
      isActive: true,
      constraints: {
        orderTypes: ["delivery"],
        perUserLimit: 3,
        combinableWithPromotions: true,
        conditions: ["Chỉ áp dụng cho đơn giao hàng"],
      },
    },
    {
      name: "Sắp hết hạn 72h",
      code: "PM_EXP72H",
      category: "order",
      description: "Dữ liệu demo cảnh báo sắp hết hạn",
      discountType: "PERCENT",
      discountValue: 15,
      minOrderValue: 150000,
      maxDiscount: 60000,
      maxUsage: 100,
      used: 58,
      publishAt: nowPlusDays(-10),
      startAt: nowPlusDays(-10),
      endAt: nowPlusHours(36),
      isActive: true,
      constraints: {
        perUserLimit: 1,
        conditions: ["Demo cảnh báo sắp hết hạn trong 72h"],
      },
    },
    {
      name: "Gần chạm giới hạn",
      code: "PM_LIMIT90",
      category: "food",
      description: "Dữ liệu demo cảnh báo gần hết lượt dùng",
      discountType: "PERCENT",
      discountValue: 12,
      minOrderValue: 100000,
      maxDiscount: 40000,
      maxUsage: 100,
      used: 92,
      publishAt: nowPlusDays(-7),
      startAt: nowPlusDays(-7),
      endAt: nowPlusDays(14),
      isActive: true,
      constraints: {
        perUserLimit: 1,
        conditions: ["Demo cảnh báo đã dùng hơn 85% giới hạn"],
      },
    },
    {
      name: "Rủi ro giảm sâu",
      code: "PM_DEEP60",
      category: "order",
      description: "Dữ liệu demo cảnh báo giảm sâu và thiếu đơn tối thiểu",
      discountType: "PERCENT",
      discountValue: 60,
      minOrderValue: 0,
      maxDiscount: 0,
      maxUsage: 60,
      used: 8,
      publishAt: nowPlusDays(-1),
      startAt: nowPlusDays(-1),
      endAt: nowPlusDays(10),
      isActive: true,
      constraints: {
        stackable: true,
        combinableWithPromotions: true,
        priority: 3,
        conditions: [
          "Demo cảnh báo giảm sâu",
          "Demo cảnh báo dùng chồng nhiều lớp",
        ],
      },
    },
    {
      name: "Coupon đã hết hạn",
      code: "PM_EXPIRED",
      category: "table",
      description: "Dữ liệu demo trạng thái hết hạn",
      discountType: "AMOUNT",
      discountValue: 30000,
      minOrderValue: 200000,
      maxUsage: 80,
      used: 31,
      publishAt: nowPlusDays(-40),
      startAt: nowPlusDays(-40),
      endAt: nowPlusDays(-3),
      isActive: true,
      constraints: {
        conditions: ["Coupon đã hết hạn để kiểm tra tab Đã xong"],
      },
    },
    {
      name: "Coupon nháp",
      code: "PM_DRAFT",
      category: "order",
      description: "Dữ liệu demo trạng thái nháp",
      discountType: "PERCENT",
      discountValue: 8,
      minOrderValue: 120000,
      maxDiscount: 35000,
      maxUsage: 100,
      used: 0,
      publishAt: nowPlusDays(3),
      startAt: nowPlusDays(3),
      endAt: nowPlusDays(25),
      isActive: false,
      constraints: {
        conditions: ["Coupon đang nháp, chưa phát hành"],
      },
    },
  ];

  const saved = [];
  for (const coupon of coupons) {
    saved.push(await upsertCoupon(restaurantId, coupon));
  }
  return saved;
}

async function upsertPromotion(restaurantId, promotion) {
  return Promotion.findOneAndUpdate(
    { restaurantId, code: promotion.code },
    {
      $set: {
        ...promotion,
        restaurantId,
        description: `${promotion.description || promotion.name} · ${DEMO_TAG}`,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function seedPromotions(restaurantId, menuItems) {
  const firstItem = menuItems[0];
  const secondItem = menuItems.find(
    (item) => String(item._id) !== String(firstItem?._id),
  );
  const categoryItem = menuItems.find((item) => item.categoryId);

  const promotions = [
    {
      name: "Giảm 10% bữa trưa",
      code: "PM_LUNCH10",
      promotionType: "PERCENTAGE",
      scope: "ORDER",
      discountType: "PERCENT",
      discountValue: 10,
      minOrderValue: 120000,
      maxDiscount: 50000,
      usageLimit: 300,
      usageCount: 74,
      targetAudience: "all",
      conditions: ["Áp dụng 10:00 - 14:00", "Không áp dụng ngày lễ"],
      startAt: nowPlusDays(-5),
      endAt: nowPlusDays(28),
      isActive: true,
      stacking: false,
      level: 1,
    },
    {
      name: "Giảm 20K toàn đơn",
      code: "PM_ORDER20K",
      promotionType: "FIXED",
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 20000,
      minOrderValue: 150000,
      maxDiscount: 0,
      usageLimit: 260,
      usageCount: 42,
      targetAudience: "all",
      conditions: ["Áp dụng cho đơn tại bàn và mang đi"],
      startAt: nowPlusDays(-2),
      endAt: nowPlusDays(35),
      isActive: true,
      stacking: false,
      level: 1,
    },
    {
      name: "Freeship đơn lớn",
      code: "PM_FREESHIP",
      promotionType: "FREESHIP",
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 30000,
      minOrderValue: 220000,
      maxDiscount: 30000,
      usageLimit: 180,
      usageCount: 39,
      targetAudience: "all",
      conditions: ["Chỉ áp dụng đơn giao hàng", "Bán kính giao hàng nội bộ"],
      startAt: nowPlusDays(-1),
      endAt: nowPlusDays(20),
      isActive: true,
      stacking: true,
      level: 2,
    },
    {
      name: "Promotion sắp hết hạn",
      code: "PM_EXP36H",
      promotionType: "PERCENTAGE",
      scope: "ORDER",
      discountType: "PERCENT",
      discountValue: 18,
      minOrderValue: 180000,
      maxDiscount: 70000,
      usageLimit: 100,
      usageCount: 61,
      targetAudience: "all",
      conditions: ["Demo cảnh báo sắp hết hạn trong 72h"],
      startAt: nowPlusDays(-8),
      endAt: nowPlusHours(36),
      isActive: true,
      stacking: false,
      level: 1,
    },
    {
      name: "Promotion gần hết lượt",
      code: "PM_USED90",
      promotionType: "FIXED",
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 25000,
      minOrderValue: 160000,
      maxDiscount: 0,
      usageLimit: 100,
      usageCount: 90,
      targetAudience: "all",
      conditions: ["Demo cảnh báo gần chạm giới hạn"],
      startAt: nowPlusDays(-10),
      endAt: nowPlusDays(12),
      isActive: true,
      stacking: false,
      level: 1,
    },
    {
      name: "Promotion giảm sâu",
      code: "PM_DEEP70",
      promotionType: "PERCENTAGE",
      scope: "ORDER",
      discountType: "PERCENT",
      discountValue: 70,
      minOrderValue: 0,
      maxDiscount: 0,
      usageLimit: 50,
      usageCount: 6,
      targetAudience: "all",
      conditions: [
        "Demo cảnh báo giảm quá sâu",
        "Demo cảnh báo thiếu đơn tối thiểu",
      ],
      startAt: nowPlusDays(-1),
      endAt: nowPlusDays(9),
      isActive: true,
      stacking: true,
      level: 3,
    },
    {
      name: "Promotion đã kết thúc",
      code: "PM_DONE",
      promotionType: "PERCENTAGE",
      scope: "ORDER",
      discountType: "PERCENT",
      discountValue: 15,
      minOrderValue: 100000,
      maxDiscount: 50000,
      usageLimit: 100,
      usageCount: 23,
      targetAudience: "all",
      conditions: ["Dữ liệu kiểm tra tab Đã xong"],
      startAt: nowPlusDays(-40),
      endAt: nowPlusDays(-3),
      isActive: true,
      stacking: false,
      level: 1,
    },
    {
      name: "Promotion nháp",
      code: "PM_DRAFT_PROMO",
      promotionType: "FIXED",
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 15000,
      minOrderValue: 90000,
      maxDiscount: 0,
      usageLimit: 100,
      usageCount: 0,
      targetAudience: "new",
      conditions: ["Đang chuẩn bị nội dung truyền thông"],
      startAt: nowPlusDays(5),
      endAt: nowPlusDays(25),
      isActive: false,
      stacking: false,
      level: 1,
    },
  ];

  if (categoryItem?.categoryId) {
    promotions.push({
      name: "Giảm 12% theo danh mục",
      code: "PM_CATEGORY12",
      promotionType: "PERCENTAGE",
      scope: "CATEGORY",
      categoryId: categoryItem.categoryId,
      discountType: "PERCENT",
      discountValue: 12,
      minOrderValue: 100000,
      maxDiscount: 45000,
      usageLimit: 120,
      usageCount: 18,
      targetAudience: "all",
      conditions: ["Áp dụng cho danh mục có món đang bán"],
      startAt: nowPlusDays(-2),
      endAt: nowPlusDays(24),
      isActive: true,
      stacking: false,
      level: 1,
    });
  }

  if (firstItem && secondItem) {
    promotions.push({
      name: `Mua ${firstItem.name} tặng ${secondItem.name}`,
      code: "PM_BOGO_ITEM",
      promotionType: "BOGO",
      scope: "ITEM",
      itemId: firstItem._id,
      giftItemId: secondItem._id,
      buyQuantity: 1,
      getQuantity: 1,
      discountType: "PERCENT",
      discountValue: 0,
      minOrderValue: 0,
      maxDiscount: 0,
      usageLimit: 80,
      usageCount: 11,
      targetAudience: "all",
      conditions: [
        "Mua món chính nhận món tặng",
        "Số lượng tặng theo tồn kho thực tế",
      ],
      startAt: nowPlusDays(-1),
      endAt: nowPlusDays(18),
      isActive: true,
      stacking: false,
      level: 2,
    });

    promotions.push({
      name: "Combo nhóm tiết kiệm",
      code: "PM_COMBO_GROUP",
      promotionType: "COMBO",
      scope: "ORDER",
      comboItems: [
        { itemId: firstItem._id, quantity: 1 },
        { itemId: secondItem._id, quantity: 1 },
      ],
      discountType: "PERCENT",
      discountValue: 15,
      minOrderValue: 200000,
      maxDiscount: 80000,
      usageLimit: 100,
      usageCount: 17,
      targetAudience: "all",
      conditions: [
        "Phải có đủ món trong combo",
        "Không tách combo sau khi áp dụng",
      ],
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(33),
      isActive: true,
      stacking: false,
      level: 2,
    });
  }

  const saved = [];
  for (const promotion of promotions) {
    saved.push(await upsertPromotion(restaurantId, promotion));
  }
  return saved;
}

async function seedVoucherPackages(restaurantId, coupons) {
  const couponByCode = new Map(coupons.map((coupon) => [coupon.code, coupon]));
  const getIds = (...codes) =>
    codes.map((code) => couponByCode.get(code)?._id).filter(Boolean);

  const packages = [
    {
      name: "Gói khách mới",
      code: "PM_PACK_NEW_CUSTOMER",
      description: `Gói onboarding khách mới · ${DEMO_TAG}`,
      voucherIds: getIds("PM_NEW10", "PM_SHIP25K"),
      startAt: nowPlusDays(-2),
      endAt: nowPlusDays(30),
      publishAt: nowPlusDays(-2),
      isActive: true,
      conditions: [
        "Phát cho khách mới sau khi tạo tài khoản",
        "Mỗi khách chỉ nhận 1 lần",
      ],
      restaurantId,
    },
    {
      name: "Gói VIP cuối tuần",
      code: "PM_PACK_VIP_WEEKEND",
      description: `Gói ưu đãi cho khách VIP · ${DEMO_TAG}`,
      voucherIds: getIds("PM_VIP50K", "PM_EXP72H"),
      startAt: nowPlusDays(-1),
      endAt: nowPlusDays(14),
      publishAt: nowPlusDays(-1),
      isActive: true,
      conditions: ["Chỉ phát cho khách gold/platinum", "Ưu tiên cuối tuần"],
      restaurantId,
    },
    {
      name: "Gói chưa gắn coupon",
      code: "PM_PACK_EMPTY_ALERT",
      description: `Gói demo cảnh báo chưa có coupon · ${DEMO_TAG}`,
      voucherIds: [],
      startAt: nowPlusDays(1),
      endAt: nowPlusDays(20),
      publishAt: nowPlusDays(1),
      isActive: true,
      conditions: ["Dữ liệu demo cảnh báo gói chưa có coupon"],
      restaurantId,
    },
  ];

  const saved = [];
  for (const voucherPackage of packages) {
    saved.push(
      await VoucherPackage.findOneAndUpdate(
        { code: voucherPackage.code },
        { $set: voucherPackage },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    );
  }
  return saved;
}

async function main() {
  assertDemoScriptAllowed("seedPromotionManagementDemo.js");
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });

  console.log("Connecting with DB settings:", safeDbInfo());
  const restaurant = await resolveRestaurant(RESTAURANT_ID);
  const menuItems = await loadMenuItems(restaurant._id);

  const coupons = await seedCoupons(restaurant._id);
  const promotions = await seedPromotions(restaurant._id, menuItems);
  const voucherPackages = await seedVoucherPackages(restaurant._id, coupons);

  console.log("Promotion management demo data seeded successfully.");
  console.log(`Restaurant: ${restaurant._id} - ${restaurant.name}`);
  console.log(`Coupons: ${coupons.map((coupon) => coupon.code).join(", ")}`);
  console.log(
    `Promotions: ${promotions.map((promotion) => promotion.code).join(", ")}`,
  );
  console.log(
    `Voucher packages: ${voucherPackages.map((item) => item.code).join(", ")}`,
  );
  if (menuItems.length < 2) {
    console.log(
      "Note: BOGO/COMBO item-based promotions need at least 2 menu items. Current seed skipped those if unavailable.",
    );
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
