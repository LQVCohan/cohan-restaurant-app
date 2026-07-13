import "dotenv/config.js";
import mongoose from "mongoose";
import process from "node:process";

import {
  Ingredient,
  Menu,
  MenuItem,
  Recipe,
  Restaurant,
  StockItem,
} from "../models/index.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";
import {
  DISH_DEFS,
  INGREDIENT_DEFS,
  SEED_KEY,
} from "./seedDefenseMenuCatalog.js";

const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const PRIMARY_RESTAURANT_NAME = "Nhà hàng COHAN Thủ Đức";
const idString = (value) => String(value?._id || value?.id || value || "");

function fail(message) {
  throw new Error(`DEFENSE_MENU_INTEGRITY_FAILED: ${message}`);
}

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID).lean();
    if (!restaurant) fail(`missing restaurant ${DEMO_RESTAURANT_ID}`);
    return restaurant;
  }
  const restaurant = await Restaurant.findOne({
    name: PRIMARY_RESTAURANT_NAME,
    status: "active",
  }).lean();
  if (!restaurant) fail(`missing restaurant ${PRIMARY_RESTAURANT_NAME}`);
  return restaurant;
}

async function verifyDatabaseCatalog(restaurantId) {
  const expectedCodes = DISH_DEFS.map((dish) => dish.code);
  const expectedIngredientNames = INGREDIENT_DEFS.map(
    (ingredient) => ingredient.name,
  );

  const [menus, menuItems, ingredients] = await Promise.all([
    Menu.find({ restaurantId, isActive: true }).select("_id timeSlot").lean(),
    MenuItem.find({
      restaurantId,
      code: { $in: expectedCodes },
      deletedAt: null,
    })
      .select(
        "_id code name menuId categoryId status thumbImage hasByWeightVariant notes",
      )
      .lean(),
    Ingredient.find({
      restaurantId,
      name: { $in: expectedIngredientNames },
      deletedAt: null,
    })
      .select("_id name baseUnit costPerBaseUnit")
      .lean(),
  ]);

  if (menus.length < 4) fail(`expected at least 4 active menus, got ${menus.length}`);
  if (menuItems.length !== DISH_DEFS.length) {
    fail(`expected ${DISH_DEFS.length} catalog dishes, got ${menuItems.length}`);
  }
  if (ingredients.length !== INGREDIENT_DEFS.length) {
    fail(
      `expected ${INGREDIENT_DEFS.length} priced ingredients, got ${ingredients.length}`,
    );
  }

  const byWeightItems = menuItems.filter((item) => item.hasByWeightVariant);
  if (byWeightItems.length < 6) {
    fail(`expected at least 6 by-weight dishes, got ${byWeightItems.length}`);
  }

  const menuIds = new Set(menus.map((menu) => idString(menu._id)));
  for (const item of menuItems) {
    if (!menuIds.has(idString(item.menuId))) {
      fail(`${item.code} points to an inactive or missing menu`);
    }
    if (!item.categoryId) fail(`${item.code} has no category`);
    if (item.status !== "available") fail(`${item.code} is not available`);
    if (!String(item.thumbImage || "").startsWith("/images/menu/")) {
      fail(`${item.code} has no managed local image`);
    }
    if (item.notes !== SEED_KEY) fail(`${item.code} is not owned by catalog v2`);
  }

  const ingredientByName = new Map(
    ingredients.map((ingredient) => [ingredient.name, ingredient]),
  );
  for (const expected of INGREDIENT_DEFS) {
    const actual = ingredientByName.get(expected.name);
    if (!actual) fail(`missing priced ingredient ${expected.name}`);
    if (actual.baseUnit !== expected.baseUnit) {
      fail(`${expected.name} base unit mismatch`);
    }
    if (Number(actual.costPerBaseUnit) !== expected.costPerBaseUnit) {
      fail(`${expected.name} purchase cost mismatch`);
    }
  }

  const itemIds = menuItems.map((item) => item._id);
  const ingredientIds = ingredients.map((ingredient) => ingredient._id);
  const [recipes, stockItems] = await Promise.all([
    Recipe.find({
      restaurantId,
      menuItemId: { $in: itemIds },
      deletedAt: null,
      isActive: true,
    })
      .select("menuItemId servingVariants")
      .lean(),
    StockItem.find({
      restaurantId,
      ingredientId: { $in: ingredientIds },
    })
      .select("ingredientId costPerUnit onHand reserved")
      .lean(),
  ]);

  if (recipes.length !== DISH_DEFS.length) {
    fail(`expected ${DISH_DEFS.length} recipes, got ${recipes.length}`);
  }
  if (stockItems.length < INGREDIENT_DEFS.length) {
    fail(
      `expected stock for ${INGREDIENT_DEFS.length} ingredients, got ${stockItems.length}`,
    );
  }

  const ingredientById = new Map(
    ingredients.map((ingredient) => [idString(ingredient._id), ingredient]),
  );
  for (const stock of stockItems) {
    const ingredient = ingredientById.get(idString(stock.ingredientId));
    if (!ingredient) continue;
    if (Number(stock.costPerUnit) !== Number(ingredient.costPerBaseUnit)) {
      fail(`${ingredient.name} stock purchase cost is out of sync`);
    }
    if (Number(stock.onHand) < 0 || Number(stock.reserved) < 0) {
      fail(`${ingredient.name} has invalid stock quantity`);
    }
  }

  for (const recipe of recipes) {
    if (!Array.isArray(recipe.servingVariants) || !recipe.servingVariants.length) {
      fail(`recipe ${idString(recipe.menuItemId)} has no serving variants`);
    }
    const defaults = recipe.servingVariants.filter((variant) => variant.isDefault);
    if (defaults.length !== 1) {
      fail(`recipe ${idString(recipe.menuItemId)} has invalid default variant`);
    }
  }

  return {
    menus: menus.length,
    dishes: menuItems.length,
    byWeightDishes: byWeightItems.length,
    ingredients: ingredients.length,
    recipes: recipes.length,
    stockItems: stockItems.length,
  };
}

async function main() {
  assertDemoScriptAllowed("verifyDefenseMenuCatalogDb.js");
  const mongoUri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0";
  const dbName = process.env.MONGO_DB || "RestaurantDB";

  console.log("Verifying persisted defense menu catalog:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  try {
    const restaurant = await resolveRestaurant();
    const summary = await verifyDatabaseCatalog(restaurant._id);
    console.table([summary]);
    console.log("✅ Persisted defense menu catalog verified");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
