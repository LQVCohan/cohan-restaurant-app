// scripts/seed-recipes.js
// Tạo Recipe (công thức) mẫu cho từng món ăn (MenuItem)

import mongoose from "mongoose";
import dotenv from "dotenv";
import { MenuItem, Ingredient, Recipe } from "../models/index.js";
import process from "process";
dotenv.config();

/* ========= CONFIG ========= */

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB"; // fallback local

const MONGO_DB = process.env.MONGO_DB || "RestaurantDB";

// Nhà hàng cần seed công thức
const RESTAURANT_ID = "68e3fc0486dc90d60c7101dc";

/**
 * Danh sách "cách chế biến" mẫu
 * => sẽ gán vào servingVariants.name
 */
const PREP_METHODS = [
  "Chiên bơ tỏi",
  "Xào sả ớt",
  "Hấp gừng",
  "Nướng muối ớt",
  "Áp chảo",
  "Rang me",
  "Kho tiêu",
  "Sốt chua ngọt",
];

/* ========= HELPERS ========= */

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr, count) {
  const copy = [...arr];
  const result = [];
  const len = Math.min(count, copy.length);
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
}

function randomPrep() {
  return PREP_METHODS[randomInt(0, PREP_METHODS.length - 1)];
}

/* ========= MAIN ========= */

async function main() {
  console.log("Connecting Mongo:", MONGO_URI, "| DB:", MONGO_DB);
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB });
  console.log("✅ Connected");

  // 1. Lấy tất cả nguyên liệu active của nhà hàng
  const ingredients = await Ingredient.find({
    restaurantId: RESTAURANT_ID,
    isActive: true,
  }).lean();

  console.log(`🔎 Found ${ingredients.length} ingredients`);
  if (!ingredients.length) {
    console.log("⚠️ Không có Ingredient nào, dừng script.");
    process.exit(0);
  }

  // 2. Lấy tất cả món ăn của nhà hàng
  const menuItems = await MenuItem.find({
    restaurantId: RESTAURANT_ID,
  }).lean();

  console.log(`🔎 Found ${menuItems.length} menu items`);

  for (const item of menuItems) {
    // Check nếu đã có recipe rồi thì bỏ qua
    const existing = await Recipe.findOne({
      restaurantId: RESTAURANT_ID,
      menuItemId: item._id,
    }).lean();

    if (existing) {
      console.log(`⏭  Skip "${item.name}" (đã có recipe)`);
      continue;
    }

    // 3–5 nguyên liệu random
    const pickedIngredients = pickRandom(ingredients, randomInt(3, 5));

    // Xác định dạng phục vụ theo byWeight
    const isByWeight = !!item.byWeight;
    const variantKey = isByWeight ? "byWeight" : "portion";
    const variantMode = isByWeight ? "BY_WEIGHT" : "PORTION";
    const variantYieldUnit = isByWeight ? "100g" : "portion";

    const servingVariant = {
      key: variantKey,
      mode: variantMode,
      yieldQty: 1,
      yieldUnit: variantYieldUnit,

      // 👇 TÊN CÁCH CHẾ BIẾN
      name: randomPrep(),

      Ingredients: pickedIngredients.map((ing) => ({
        ingredientId: ing._id,
        name: ing.name,
        quantify: randomInt(1, 3), // demo: 1–3 baseUnit
        wastePct: 0,
      })),
    };

    const recipeDoc = await Recipe.create({
      restaurantId: RESTAURANT_ID,
      menuItemId: item._id,
      servingVariants: [servingVariant],
      notes: "Dữ liệu công thức mẫu được seed tự động",
      isActive: true,
    });

    console.log(
      `✓ Tạo recipe cho "${item.name}" với ${servingVariant.Ingredients.length} nguyên liệu, cách chế biến: ${servingVariant.name}`
    );
  }

  console.log("\n🎉 DONE – Seed Recipe xong.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
