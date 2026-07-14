import "dotenv/config.js";
import mongoose from "mongoose";
import { Coupon, Promotion, Restaurant, MenuItem } from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const LEGACY_COUPON_CODES = [
  "ACTIVE10",
  "FIXED20K",
  "EXPIRED10",
  "LIMIT5",
  "USERONLY",
];
const LEGACY_PROMOTION_CODES = [
  "LUNCH10",
  "ORDER20K",
  "FREESHIP",
  "PHOTEA",
  "FAMILYCOMBO",
];

function nowPlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function sameId(left, right) {
  return Boolean(left && right && String(left) === String(right));
}

function isSellableMenuItem(item) {
  return ["available", "out_of_stock"].includes(
    String(item?.status || "").toLowerCase(),
  );
}

function scoreGiftCandidate(item, { preferredCodes = [], preferredName = "" } = {}) {
  const code = String(item?.code || "").trim().toUpperCase();
  const normalizedName = item?.normalizedName || normalizeText(item?.name);
  const normalizedPreferredName = normalizeText(preferredName);
  let score = 0;

  const preferredIndex = preferredCodes
    .map((value) => String(value || "").trim().toUpperCase())
    .indexOf(code);
  if (preferredIndex >= 0) score += 1000 - preferredIndex * 20;

  if (normalizedPreferredName && normalizedName === normalizedPreferredName) {
    score += 800;
  }
  if (normalizedPreferredName && normalizedName.includes(normalizedPreferredName)) {
    score += 500;
  }

  if (normalizedName.includes("tra dao")) score += 320;
  else if (normalizedName.includes("tra") || normalizedName.includes("tea")) {
    score += 260;
  } else if (
    normalizedName.includes("ca phe") ||
    normalizedName.includes("nuoc") ||
    normalizedName.includes("soda")
  ) {
    score += 120;
  }

  if (String(item?.prepStation || "").toLowerCase() === "bar") score += 80;
  if (String(item?.status || "").toLowerCase() === "available") score += 40;

  return score;
}

function findSameMenuGift({
  buyItem,
  currentGiftItem = null,
  menuItems = [],
  preferredCodes = [],
}) {
  if (!buyItem?.menuId) return null;

  const candidates = menuItems
    .filter((item) => item?._id && !sameId(item._id, buyItem._id))
    .filter((item) => sameId(item.menuId, buyItem.menuId))
    .filter(isSellableMenuItem)
    .map((item) => ({
      item,
      score: scoreGiftCandidate(item, {
        preferredCodes,
        preferredName: currentGiftItem?.name || "",
      }),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.item?.name || "").localeCompare(String(right.item?.name || ""), "vi"),
    );

  return candidates[0]?.item || null;
}

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID);
    if (!restaurant) {
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    }
    return restaurant;
  }

  const existing = await Restaurant.findOne({ status: "active" }).sort({ createdAt: 1 });
  if (!existing) {
    throw new Error(
      "NO_ACTIVE_RESTAURANT_FOUND: seed restaurant data first or provide DEMO_RESTAURANT_ID",
    );
  }
  return existing;
}

async function cleanupLegacyCampaigns(restaurantId) {
  await Promise.all([
    Coupon.deleteMany({
      restaurantId,
      $or: [
        { code: { $in: LEGACY_COUPON_CODES } },
        { description: /demo-coupon-promotion|validation demo|usage demo/i },
      ],
    }),
    Promotion.deleteMany({
      restaurantId,
      $or: [
        { code: { $in: LEGACY_PROMOTION_CODES } },
        { description: /demo-coupon-promotion/i },
      ],
    }),
  ]);
}

async function seedCoupons(restaurantId) {
  const now = new Date();
  const couponDefs = [
    {
      name: "Ưu đãi thành viên 10%",
      code: "THANHVIEN10",
      description: "Giảm 10% cho hóa đơn từ 100.000đ, tối đa 50.000đ.",
      discountType: "PERCENT",
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
      name: "Giảm 20.000đ cho đơn từ 120.000đ",
      code: "GIAM20K",
      description: "Áp dụng trực tiếp 20.000đ cho hóa đơn đủ điều kiện.",
      discountType: "AMOUNT",
      discountValue: 20000,
      minOrderValue: 120000,
      maxUsage: 300,
      used: 0,
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(30),
      isActive: true,
    },
    {
      name: "Ưu đãi mùa hè 10%",
      code: "MUAHE10",
      description: "Chương trình ưu đãi theo mùa đã kết thúc.",
      discountType: "PERCENT",
      discountValue: 10,
      minOrderValue: 100000,
      maxUsage: 100,
      used: 20,
      startAt: nowPlusDays(-40),
      endAt: nowPlusDays(-2),
      isActive: true,
    },
    {
      name: "Ưu đãi giới hạn 5%",
      code: "UUDAI5",
      description: "Giảm 5% cho hóa đơn từ 80.000đ, số lượng có hạn.",
      discountType: "PERCENT",
      discountValue: 5,
      minOrderValue: 80000,
      maxUsage: 100,
      used: 99,
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(30),
      isActive: true,
    },
    {
      name: "Quà chào mừng khách hàng mới",
      code: "CHAOMUNG15K",
      description: "Giảm 15.000đ cho lần sử dụng đầu tiên của mỗi tài khoản.",
      discountType: "AMOUNT",
      discountValue: 15000,
      minOrderValue: 90000,
      maxUsage: 500,
      used: 0,
      constraints: { perUserLimit: 1 },
      startAt: nowPlusDays(-3),
      endAt: nowPlusDays(30),
      isActive: true,
    },
  ];

  for (const coupon of couponDefs) {
    await Coupon.findOneAndUpdate(
      { restaurantId, code: coupon.code },
      { $set: { ...coupon, restaurantId, publishAt: now } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  return couponDefs.map((coupon) => coupon.code);
}

async function seedPromotions(restaurantId) {
  const menuItems = await MenuItem.find({
    restaurantId,
    isDeleted: { $ne: true },
  })
    .select("_id name code menuId categoryId prepStation status")
    .lean();
  const normalizedItems = menuItems.map((item) => ({
    ...item,
    normalizedName: normalizeText(item.name),
  }));

  let pho =
    normalizedItems.find(
      (item) => String(item.code || "").toUpperCase() === "MON-PHO-001",
    ) || normalizedItems.find((item) => item.normalizedName.includes("pho"));

  if (!pho && normalizedItems[0]) pho = normalizedItems[0];

  const preferredTea =
    normalizedItems.find(
      (item) => String(item.code || "").toUpperCase() === "NUOC-TRA-001",
    ) ||
    normalizedItems.find(
      (item) =>
        item.normalizedName.includes("tra") || item.normalizedName.includes("tea"),
    );

  const tea = pho
    ? findSameMenuGift({
        buyItem: pho,
        currentGiftItem: preferredTea,
        menuItems: normalizedItems,
        preferredCodes: ["NUOC-TRA-001", "TRA-TAC"],
      })
    : null;

  const comboItems = normalizedItems
    .slice(0, 2)
    .map((item) => ({ itemId: item._id, quantity: 1 }));

  const definitions = [
    {
      name: "Ưu đãi bữa trưa 10%",
      description: "Giảm 10% cho hóa đơn bữa trưa từ 120.000đ.",
      code: "TRUA10",
      promotionType: "PERCENTAGE",
      scope: "ORDER",
      discountType: "PERCENT",
      discountValue: 10,
      minOrderValue: 120000,
      maxDiscount: 50000,
      stacking: false,
    },
    {
      name: "Giảm 20.000đ cho hóa đơn",
      description: "Ưu đãi trực tiếp 20.000đ cho hóa đơn từ 150.000đ.",
      code: "HOADON20K",
      promotionType: "FIXED",
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 20000,
      minOrderValue: 150000,
      stacking: false,
    },
    {
      name: "Miễn phí giao hàng",
      description: "Hỗ trợ phí giao hàng tối đa 30.000đ cho đơn từ 100.000đ.",
      code: "FREESHIP30K",
      promotionType: "FREESHIP",
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 30000,
      minOrderValue: 100000,
      stacking: true,
    },
  ];

  if (pho && tea && String(pho._id) !== String(tea._id)) {
    definitions.push({
      name: `Tặng ${tea.name} khi gọi ${pho.name}`,
      description: `Mua một phần ${pho.name}, tặng một ${tea.name} trong cùng menu phục vụ.`,
      code: "PHOTANGTRA",
      promotionType: "BOGO",
      scope: "ITEM",
      itemId: pho._id,
      giftItemId: tea._id,
      buyQuantity: 1,
      getQuantity: 1,
      discountType: "PERCENT",
      discountValue: 100,
      stacking: false,
    });
  } else if (pho) {
    console.warn(
      `[seed:coupon-promotion] Bỏ qua PHOTANGTRA vì không tìm thấy món uống cùng menu với "${pho.name}".`,
    );
  }

  if (comboItems.length >= 2) {
    definitions.push({
      name: "Combo sum họp",
      description: "Giảm 15% khi gọi combo hai món dành cho nhóm khách.",
      code: "COMBOSUMHOP",
      promotionType: "COMBO",
      scope: "ORDER",
      comboItems,
      discountType: "PERCENT",
      discountValue: 15,
      minOrderValue: 200000,
      stacking: false,
    });
  }

  for (const promotion of definitions) {
    await Promotion.findOneAndUpdate(
      { restaurantId, code: promotion.code },
      {
        $set: {
          ...promotion,
          restaurantId,
          startAt: nowPlusDays(-3),
          endAt: nowPlusDays(45),
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  return definitions.map((promotion) => promotion.code);
}

async function main() {
  assertDemoScriptAllowed("seedCouponPromotionDemo.js");
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGO_DB || "cohan";
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });

  const restaurant = await resolveRestaurant();
  await cleanupLegacyCampaigns(restaurant._id);
  const couponCodes = await seedCoupons(restaurant._id);
  const promotionCodes = await seedPromotions(restaurant._id);

  console.log(`Seeded coupon codes: ${couponCodes.join(", ")}`);
  console.log(`Seeded promotion codes: ${promotionCodes.join(", ")}`);
  console.log(`Restaurant: ${restaurant._id} - ${restaurant.name}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
