import mongoose from "mongoose";
import dotenv from "dotenv";
import { MenuItem } from "../models/index.js";
import process from "process";

dotenv.config();

// ====== CONFIG ======
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB"; // fallback local

const MONGO_DB = process.env.MONGO_DB || "RestaurantDB";

// Nhà hàng
const RESTAURANT_ID = "69ce9e2e8d8d711f12e251b1";

// Menu theo timeslot
const MENUS = {
  breakfast: "68e4174004521aa428f95d23",
  dinner: "68e4174b04521aa428f95d24",
  lunch: "68e5417804521aa428f95d28",
  late_night: "68e54d8604521aa428f95d29",
};

// Category (giữ giống trước)
const CATEGORY_APPETIZER = "69ce9e328d8d711f12e251ff"; // Khai vị
const CATEGORY_MAIN = "69ce9e338d8d711f12e25205"; // Món chính

// Modifier group cho tất cả món
const DEFAULT_MODIFIER_GROUP_IDS = ["68e4d89bca13bb3391858677"];

// ====== HELPERS ======
function oid(id) {
  return new mongoose.Types.ObjectId(id);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Danh sách tên món theo menu
const NAMES_BY_SLOT = {
  breakfast: [
    "Bánh mì ốp la",
    "Phở bò tái",
    "Bún riêu",
    "Xôi gà",
    "Bánh cuốn",
    "Cháo cá",
    "Mì Quảng",
    "Bún bò Huế",
    "Bánh canh giò",
    "Bánh mì thịt nướng",
  ],
  lunch: [
    "Cơm gà xối mỡ",
    "Canh chua cá lóc",
    "Thịt kho tàu",
    "Gà kho gừng",
    "Rau muống xào tỏi",
    "Mực ống xào chua ngọt",
    "Tôm sú rang me",
    "Cá hồi áp chảo",
    "Bò xào lá lốt",
    "Đậu hũ sốt cà",
  ],
  dinner: [
    "Lẩu hải sản",
    "Cơm chiên Dương Châu",
    "Gỏi cuốn tôm thịt",
    "Lẩu kim chi",
    "Sườn nướng BBQ",
    "Cá tầm nướng",
    "Gà quay",
    "Mì xào hải sản",
    "Nghêu hấp sả",
    "Sườn xào chua ngọt",
  ],
  late_night: [
    "Cháo sườn",
    "Miến gà",
    "Bánh mì bít tết",
    "Mì trứng",
    "Hủ tiếu xương",
    "Bạch tuộc nướng",
    "Cánh gà chiên mắm",
    "Mì hải sản",
    "Khoai tây chiên",
    "Mì xào bò",
  ],
};

// Payload cơ bản cho MenuItem
function baseMenuItemPayload({
  name,
  description,
  restaurantId,
  menuId,
  categoryId,
  byWeight = false,
  basePrice = 0,
}) {
  return {
    restaurantId: oid(restaurantId),
    menuId: oid(menuId),
    categoryId: oid(categoryId),
    name,
    description,
    basePrice,
    byWeight,
    thumbImage: null,
    mediaAssetIds: [],
    modifierGroupIds: DEFAULT_MODIFIER_GROUP_IDS.map(oid),
    status: "available",
    avgPrepTimeMin: randomInt(8, 20),
    point: randomInt(0, 5),
    notes: "",
  };
}

// Tạo danh sách món cho 1 slot
function buildItemsForSlot(slot) {
  const names = NAMES_BY_SLOT[slot] || [];
  const menuId = MENUS[slot];

  if (!menuId) return [];

  const items = [];

  // Quy ước:
  // - index 0..4: khai vị (CATEGORY_APPETIZER, byWeight=false)
  // - index 5..8: món chính (CATEGORY_MAIN, byWeight=false)
  // - index 9: món chính bán theo 100g (byWeight=true)
  names.forEach((name, index) => {
    const isAppetizer = index < 5;
    const isByWeight = index === 9; // món cuối bán theo 100g

    const categoryId = isAppetizer ? CATEGORY_APPETIZER : CATEGORY_MAIN;
    const description = isByWeight
      ? "Giá theo 100g. Tổng tiền = (gram/100) × giá chế biến."
      : "Món giá cố định theo phần.";

    const basePrice = isByWeight
      ? 0
      : isAppetizer
        ? randomInt(20000, 50000)
        : randomInt(40000, 90000);

    items.push(
      baseMenuItemPayload({
        name,
        description,
        restaurantId: RESTAURANT_ID,
        menuId,
        categoryId,
        byWeight: isByWeight,
        basePrice,
      }),
    );
  });

  return items;
}

// ====== MAIN ======
async function main() {
  console.log("Connecting Mongo:", MONGO_URI, "| DB:", MONGO_DB);
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  console.log("✅ Connected");

  // ❗ Nếu muốn xóa hết món cũ của nhà hàng trước khi seed, mở comment dòng dưới:
  // await MenuItem.deleteMany({ restaurantId: oid(RESTAURANT_ID) });

  const slots = ["breakfast", "lunch", "dinner", "late_night"];

  for (const slot of slots) {
    const menuId = MENUS[slot];
    if (!menuId) {
      console.log(`⚠️  Không có menuId cho slot=${slot}, skip.`);
      continue;
    }

    const items = buildItemsForSlot(slot);
    console.log(
      `\n[${slot}] Seeding ${items.length} items vào menuId=${menuId}...`,
    );

    for (const item of items) {
      try {
        // Tránh trùng: check theo (restaurantId, menuId, categoryId, name)
        const exists = await MenuItem.findOne({
          restaurantId: item.restaurantId,
          menuId: item.menuId,
          categoryId: item.categoryId,
          name: item.name,
        }).lean();

        if (exists) {
          console.log(`⏭  Skip (đã tồn tại): ${item.name}`);
          continue;
        }

        const created = await MenuItem.create(item);
        console.log(
          `✓ ${created.name} | menu=${slot} | cat=${created.categoryId} | byWeight=${created.byWeight} | basePrice=${created.basePrice}`,
        );
      } catch (err) {
        console.error(`✗ Lỗi tạo món "${item.name}":`, err.message);
      }
    }
  }

  console.log("\n🎉 DONE – Seed MenuItem xong cho nhà hàng", RESTAURANT_ID);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
