import "dotenv/config.js";
import mongoose from "mongoose";
import process from "node:process";

import {
  Category,
  Ingredient,
  MenuItem,
  Recipe,
  Restaurant,
  StockItem,
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const PRIMARY_RESTAURANT_NAME = "Nhà hàng COHAN Thủ Đức";
const LEGACY_EMPTY_CATEGORIES = ["Món nước", "Món chính", "Khai vị & súp"];
const LEGACY_UNUSED_INGREDIENTS = ["Thịt bò Úc", "Nền trà đào"];

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID);
    if (!restaurant) {
      throw new Error(`DEMO_RESTAURANT_NOT_FOUND: ${DEMO_RESTAURANT_ID}`);
    }
    return restaurant;
  }

  const restaurant = await Restaurant.findOne({
    name: PRIMARY_RESTAURANT_NAME,
    status: "active",
  });
  if (!restaurant) {
    throw new Error(`PRIMARY_RESTAURANT_NOT_FOUND: ${PRIMARY_RESTAURANT_NAME}`);
  }
  return restaurant;
}

async function removeEmptyLegacyCategories(restaurantId) {
  let removed = 0;
  const categories = await Category.find({
    restaurantId,
    name: { $in: LEGACY_EMPTY_CATEGORIES },
  });

  for (const category of categories) {
    const itemCount = await MenuItem.countDocuments({
      restaurantId,
      categoryId: category._id,
      deletedAt: null,
    });
    if (itemCount > 0) continue;
    await Category.deleteOne({ _id: category._id });
    removed += 1;
  }
  return removed;
}

async function removeUnusedLegacyIngredients(restaurantId) {
  let removed = 0;
  const ingredients = await Ingredient.find({
    restaurantId,
    name: { $in: LEGACY_UNUSED_INGREDIENTS },
  });

  for (const ingredient of ingredients) {
    const recipeCount = await Recipe.countDocuments({
      restaurantId,
      "servingVariants.ingredients.ingredientId": ingredient._id,
      deletedAt: null,
    });
    if (recipeCount > 0) continue;

    await StockItem.deleteMany({
      restaurantId,
      ingredientId: ingredient._id,
    });
    await Ingredient.deleteOne({ _id: ingredient._id });
    removed += 1;
  }
  return removed;
}

async function main() {
  assertDemoScriptAllowed("cleanupLegacyDefenseMenuData.js");
  const mongoUri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0";
  const dbName = process.env.MONGO_DB || "RestaurantDB";

  console.log("Cleaning legacy defense menu records:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  try {
    const restaurant = await resolveRestaurant();
    const [categoriesRemoved, ingredientsRemoved] = await Promise.all([
      removeEmptyLegacyCategories(restaurant._id),
      removeUnusedLegacyIngredients(restaurant._id),
    ]);
    console.log(
      `✅ Legacy menu cleanup complete: categories=${categoriesRemoved}, ingredients=${ingredientsRemoved}`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
