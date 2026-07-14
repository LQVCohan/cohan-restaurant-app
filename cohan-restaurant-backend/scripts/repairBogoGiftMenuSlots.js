import "dotenv/config.js";
import process from "node:process";
import mongoose from "mongoose";
import {
  MenuItem,
  Promotion,
  Restaurant,
} from "../models/index.js";
import { maskMongoUri } from "./lib/scriptSafety.js";

const DEFAULT_RESTAURANT_ID = "6a5559eec3e3d7a76c59c0da";
const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/RestaurantDB";

function readArg(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return undefined;
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

function isSellable(item) {
  return ["available", "out_of_stock"].includes(
    String(item?.status || "").toLowerCase(),
  );
}

function candidateScore(candidate, { promotion, giftItem }) {
  const code = String(candidate?.code || "").trim().toUpperCase();
  const name = normalizeText(candidate?.name);
  const giftName = normalizeText(giftItem?.name);
  const promotionCode = String(promotion?.code || "").trim().toUpperCase();
  let score = 0;

  if (promotionCode === "PHOTANGTRA" && code === "TRA-TAC") score += 2000;
  if (promotionCode === "PHOTANGTRA" && code === "NUOC-TRA-001") score += 1900;

  if (giftName && name === giftName) score += 1200;
  if (giftName && name.includes(giftName)) score += 700;

  const giftLooksLikeTea = giftName.includes("tra") || giftName.includes("tea");
  if (giftLooksLikeTea && (name.includes("tra") || name.includes("tea"))) {
    score += 600;
  }

  if (
    sameId(candidate?.categoryId, giftItem?.categoryId) &&
    candidate?.categoryId
  ) {
    score += 180;
  }
  if (
    String(candidate?.prepStation || "").toLowerCase() ===
    String(giftItem?.prepStation || "").toLowerCase()
  ) {
    score += 160;
  }
  if (String(candidate?.prepStation || "").toLowerCase() === "bar") score += 90;
  if (String(candidate?.status || "").toLowerCase() === "available") score += 50;

  return score;
}

function selectReplacement({ promotion, buyItem, giftItem, menuItems }) {
  const candidates = menuItems
    .filter((item) => item?._id && !sameId(item._id, buyItem?._id))
    .filter((item) => sameId(item?.menuId, buyItem?.menuId))
    .filter(isSellable)
    .map((item) => ({
      item,
      score: candidateScore(item, { promotion, giftItem }),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.item?.name || "").localeCompare(
          String(right.item?.name || ""),
          "vi",
        ),
    );

  return candidates[0]?.item || null;
}

function buildPromotionCopy({ promotion, buyItem, giftItem }) {
  const promotionCode = String(promotion?.code || "").trim().toUpperCase();
  if (promotionCode === "PHOTANGTRA") {
    return {
      name: `Tặng ${giftItem.name} khi gọi ${buyItem.name}`,
      description: `Mua một phần ${buyItem.name}, tặng một ${giftItem.name} trong cùng menu phục vụ.`,
    };
  }

  return {
    name: promotion?.name,
    description: promotion?.description,
  };
}

async function resolveRestaurant(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new Error(`restaurantId không hợp lệ: ${restaurantId}`);
  }

  const restaurant = await Restaurant.findById(restaurantId)
    .select({ name: 1, status: 1 })
    .lean();
  if (!restaurant) {
    throw new Error(`Không tìm thấy nhà hàng ${restaurantId}`);
  }
  return restaurant;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const restaurantId =
    readArg("restaurantId") ||
    process.env.SEED_RESTAURANT_ID ||
    process.env.DEMO_RESTAURANT_ID ||
    DEFAULT_RESTAURANT_ID;
  const mongoUri =
    process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_MONGO_URI;
  const mongoDb = process.env.MONGO_DB;

  console.log(
    "[repair:bogo-menu-slot] Chế độ:",
    apply ? "APPLY" : "VALIDATE ONLY",
  );
  console.log("[repair:bogo-menu-slot] Nhà hàng:", restaurantId);
  console.log("[repair:bogo-menu-slot] Mongo:", maskMongoUri(mongoUri));
  if (mongoDb) console.log("[repair:bogo-menu-slot] DB:", mongoDb);

  await mongoose.connect(mongoUri, mongoDb ? { dbName: mongoDb } : {});
  const restaurant = await resolveRestaurant(restaurantId);

  const promotions = await Promotion.find({
    restaurantId,
    promotionType: "BOGO",
    scope: "ITEM",
    isActive: true,
  })
    .select({
      name: 1,
      description: 1,
      code: 1,
      itemId: 1,
      giftItemId: 1,
      isActive: 1,
    })
    .lean();

  if (!promotions.length) {
    console.log(
      `[repair:bogo-menu-slot] Không có BOGO đang hoạt động tại "${restaurant.name}".`,
    );
    return;
  }

  const referencedIds = [
    ...new Set(
      promotions
        .flatMap((promotion) => [promotion.itemId, promotion.giftItemId])
        .filter(Boolean)
        .map(String),
    ),
  ];

  const [referencedItems, allMenuItems] = await Promise.all([
    MenuItem.find({
      restaurantId,
      _id: { $in: referencedIds },
    })
      .select({
        name: 1,
        code: 1,
        menuId: 1,
        categoryId: 1,
        prepStation: 1,
        status: 1,
      })
      .lean(),
    MenuItem.find({ restaurantId })
      .select({
        name: 1,
        code: 1,
        menuId: 1,
        categoryId: 1,
        prepStation: 1,
        status: 1,
      })
      .lean(),
  ]);

  const itemMap = new Map(
    referencedItems.map((item) => [String(item._id), item]),
  );
  const repairs = [];
  const unresolved = [];

  for (const promotion of promotions) {
    const buyItem = itemMap.get(String(promotion.itemId || ""));
    const giftItem = itemMap.get(String(promotion.giftItemId || ""));

    if (!buyItem || !giftItem) {
      unresolved.push({
        promotion,
        reason: !buyItem
          ? "Không tìm thấy món mua"
          : "Không tìm thấy món tặng",
      });
      continue;
    }

    if (sameId(buyItem.menuId, giftItem.menuId)) {
      console.log(
        `✓ ${promotion.code || promotion.name}: "${buyItem.name}" và "${giftItem.name}" đã cùng menu.`,
      );
      continue;
    }

    const replacement = selectReplacement({
      promotion,
      buyItem,
      giftItem,
      menuItems: allMenuItems,
    });

    if (!replacement) {
      unresolved.push({
        promotion,
        buyItem,
        giftItem,
        reason: `Không có món thay thế trong menu của "${buyItem.name}"`,
      });
      continue;
    }

    repairs.push({ promotion, buyItem, oldGiftItem: giftItem, replacement });
    console.log(
      `↻ ${promotion.code || promotion.name}: "${giftItem.name}" → "${replacement.name}" để cùng menu với "${buyItem.name}".`,
    );
  }

  if (unresolved.length > 0) {
    for (const row of unresolved) {
      console.error(
        `✗ ${row.promotion?.code || row.promotion?.name}: ${row.reason}`,
      );
    }
  }

  if (!apply) {
    console.log(
      `\n[repair:bogo-menu-slot] Cần sửa ${repairs.length} promotion; chưa ghi DB.`,
    );
    if (unresolved.length > 0) process.exitCode = 1;
    return;
  }

  for (const row of repairs) {
    const copy = buildPromotionCopy({
      promotion: row.promotion,
      buyItem: row.buyItem,
      giftItem: row.replacement,
    });

    await Promotion.updateOne(
      { _id: row.promotion._id, restaurantId },
      {
        $set: {
          giftItemId: row.replacement._id,
          ...copy,
        },
      },
      { runValidators: true },
    );
  }

  console.log(
    `\n✅ Đã đồng bộ ${repairs.length} promotion BOGO theo đúng menu/buổi phục vụ.`,
  );
  if (unresolved.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("\n❌ Sửa promotion thất bại:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
