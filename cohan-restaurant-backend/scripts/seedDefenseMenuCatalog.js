import "dotenv/config.js";
import mongoose from "mongoose";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  Category,
  CategoryMenu,
  Ingredient,
  Menu,
  MenuItem,
  Recipe,
  Restaurant,
  StockItem,
  Warehouse,
} from "../models/index.js";
import {
  assertDemoScriptAllowed,
  safeDbInfo,
} from "./lib/scriptSafety.js";
import {
  INGREDIENT_DEFS,
  PRICE_REFERENCE_NOTE,
} from "./data/defenseMenuIngredients.js";
import { DISH_DEFS } from "./data/defenseMenuDishes.js";

export { DISH_DEFS, INGREDIENT_DEFS, PRICE_REFERENCE_NOTE };
export const SEED_KEY = "cohan-menu-catalog-v2";

const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const PRIMARY_RESTAURANT_NAME = "Nhà hàng COHAN Thủ Đức";

export const CATEGORY_DEFS = [
  { name: "Món sáng", icon: "🍜", order: 10 },
  { name: "Khai vị và gỏi", icon: "🥗", order: 20 },
  { name: "Cơm và món Việt", icon: "🍚", order: 30 },
  { name: "Hải sản", icon: "🦐", order: 40 },
  { name: "Món nướng", icon: "🔥", order: 50 },
  { name: "Lẩu", icon: "🍲", order: 60 },
  { name: "Rau và món phụ", icon: "🥬", order: 70 },
  { name: "Món ăn khuya", icon: "🌙", order: 80 },
  { name: "Đồ uống", icon: "🥤", order: 90 },
  { name: "Tráng miệng", icon: "🍉", order: 100 },
];

export const MENU_GROUP_DEFS = [
  {
    name: "Bữa sáng",
    icon: "☀️",
    order: 10,
    description: "Các món điểm tâm và thức uống phục vụ buổi sáng.",
  },
  {
    name: "Bữa trưa",
    icon: "🥗",
    order: 20,
    description: "Món Việt, cơm phần và thức uống phù hợp cho bữa trưa.",
  },
  {
    name: "Bữa tối",
    icon: "🌙",
    order: 30,
    description:
      "Hải sản, món nướng, lẩu và món dùng chung cho bữa tối và khuya.",
  },
];

export const MENU_DEFS = [
  {
    timeSlot: "breakfast",
    name: "Thực đơn buổi sáng",
    description:
      "Điểm tâm Việt Nam được chuẩn bị trong ngày, phục vụ nhanh và đủ năng lượng.",
    group: "Bữa sáng",
  },
  {
    timeSlot: "lunch",
    name: "Thực đơn buổi trưa",
    description:
      "Các món cơm và món Việt cân bằng, phù hợp dùng riêng hoặc dùng chung.",
    group: "Bữa trưa",
  },
  {
    timeSlot: "dinner",
    name: "Thực đơn buổi tối",
    description:
      "Hải sản tươi, món nướng và lẩu dành cho gia đình, nhóm bạn và tiệc thân mật.",
    group: "Bữa tối",
  },
  {
    timeSlot: "late_night",
    name: "Thực đơn khuya",
    description:
      "Các món nóng, món ăn nhẹ và đồ uống phục vụ khách dùng bữa muộn.",
    group: "Bữa tối",
  },
];

const ALLOWED_UNITS = new Set(["g", "ml", "piece"]);
const ALLOWED_MODES = new Set(["PORTION", "BY_WEIGHT"]);
const idString = (value) => String(value?._id || value?.id || value || "");

async function upsertOne(Model, filter, payload) {
  return Model.findOneAndUpdate(
    filter,
    { $set: payload },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}

function validateIngredientPrice(ingredient) {
  const cost = Number(ingredient.costPerBaseUnit);
  if (!Number.isFinite(cost) || cost <= 0) {
    throw new Error(`INVALID_INGREDIENT_COST: ${ingredient.name}`);
  }
  if (!ALLOWED_UNITS.has(ingredient.baseUnit)) {
    throw new Error(
      `INVALID_INGREDIENT_UNIT: ${ingredient.name} (${ingredient.baseUnit})`,
    );
  }

  const max =
    ingredient.baseUnit === "piece"
      ? 1_000_000
      : ingredient.baseUnit === "ml"
        ? 500
        : 1_000;
  if (cost > max) {
    throw new Error(
      `INGREDIENT_COST_OUT_OF_RANGE: ${ingredient.name}=${cost}/${ingredient.baseUnit}`,
    );
  }
}

export function recipeCost(variant, ingredientByKey) {
  return variant.ingredients.reduce((total, recipeLine) => {
    const ingredient = ingredientByKey.get(recipeLine.ingredient);
    if (!ingredient) return Number.NaN;
    return (
      total +
      recipeLine.qty *
        ingredient.costPerBaseUnit *
        (1 + Number(recipeLine.wastePct || 0) / 100)
    );
  }, 0);
}

export function validateDefenseMenuCatalog() {
  if (DISH_DEFS.length < 30) {
    throw new Error(`MENU_CATALOG_TOO_SMALL: ${DISH_DEFS.length}`);
  }

  const ingredientByKey = new Map();
  for (const ingredient of INGREDIENT_DEFS) {
    if (ingredientByKey.has(ingredient.key)) {
      throw new Error(`DUPLICATE_INGREDIENT_KEY: ${ingredient.key}`);
    }
    validateIngredientPrice(ingredient);
    ingredientByKey.set(ingredient.key, ingredient);
  }

  const dishCodes = new Set();
  let byWeightDishCount = 0;
  let dualModeDishCount = 0;
  let portionDishCount = 0;

  for (const dish of DISH_DEFS) {
    if (dishCodes.has(dish.code)) {
      throw new Error(`DUPLICATE_DISH_CODE: ${dish.code}`);
    }
    dishCodes.add(dish.code);

    if (!dish.name?.trim() || !dish.description?.trim()) {
      throw new Error(`DISH_DISPLAY_COPY_MISSING: ${dish.code}`);
    }
    if (!dish.thumbImage?.startsWith("/images/menu/")) {
      throw new Error(`DISH_IMAGE_NOT_MANAGED: ${dish.code}`);
    }
    if (!dish.variants.length) {
      throw new Error(`DISH_VARIANTS_MISSING: ${dish.code}`);
    }

    const modes = new Set();
    let defaultCount = 0;
    for (const variant of dish.variants) {
      if (!ALLOWED_MODES.has(variant.mode)) {
        throw new Error(`INVALID_VARIANT_MODE: ${dish.code}/${variant.key}`);
      }
      if (!Number.isFinite(variant.price) || variant.price <= 0) {
        throw new Error(`INVALID_VARIANT_PRICE: ${dish.code}/${variant.key}`);
      }
      if (variant.isDefault) defaultCount += 1;
      modes.add(variant.mode);

      for (const recipeLine of variant.ingredients) {
        const ingredient = ingredientByKey.get(recipeLine.ingredient);
        if (!ingredient) {
          throw new Error(
            `UNKNOWN_RECIPE_INGREDIENT: ${dish.code}/${recipeLine.ingredient}`,
          );
        }
        if (recipeLine.unit !== ingredient.baseUnit) {
          throw new Error(
            `RECIPE_UNIT_MISMATCH: ${dish.code}/${recipeLine.ingredient}`,
          );
        }
        if (!Number.isFinite(recipeLine.qty) || recipeLine.qty <= 0) {
          throw new Error(
            `INVALID_RECIPE_QUANTITY: ${dish.code}/${recipeLine.ingredient}`,
          );
        }
      }

      const cost = recipeCost(variant, ingredientByKey);
      if (!Number.isFinite(cost) || cost <= 0 || cost >= variant.price) {
        throw new Error(
          `INVALID_DISH_FOOD_COST: ${dish.code}/${variant.key} cost=${cost} price=${variant.price}`,
        );
      }
    }

    if (defaultCount !== 1) {
      throw new Error(`DISH_DEFAULT_VARIANT_INVALID: ${dish.code}`);
    }
    if (modes.has("PORTION")) portionDishCount += 1;
    if (modes.has("BY_WEIGHT")) byWeightDishCount += 1;
    if (modes.size === 2) dualModeDishCount += 1;
  }

  if (portionDishCount < 25) {
    throw new Error(`PORTION_MENU_COVERAGE_TOO_LOW: ${portionDishCount}`);
  }
  if (byWeightDishCount < 5) {
    throw new Error(`BY_WEIGHT_MENU_COVERAGE_TOO_LOW: ${byWeightDishCount}`);
  }
  if (dualModeDishCount < 3) {
    throw new Error(`DUAL_MODE_MENU_COVERAGE_TOO_LOW: ${dualModeDishCount}`);
  }

  return {
    dishes: DISH_DEFS.length,
    ingredients: INGREDIENT_DEFS.length,
    portionDishes: portionDishCount,
    byWeightDishes: byWeightDishCount,
    dualModeDishes: dualModeDishCount,
  };
}

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

async function seedCatalog(restaurant) {
  const restaurantId = restaurant._id;

  const groupIds = new Map();
  for (const definition of MENU_GROUP_DEFS) {
    const group = await upsertOne(
      CategoryMenu,
      { restaurantId, name: definition.name },
      { ...definition, restaurantId, isActive: true },
    );
    groupIds.set(definition.name, group._id);
  }

  const menuIds = new Map();
  for (const definition of MENU_DEFS) {
    const menu = await upsertOne(
      Menu,
      { restaurantId, timeSlot: definition.timeSlot },
      {
        restaurantId,
        timeSlot: definition.timeSlot,
        name: definition.name,
        description: definition.description,
        categoryMenuId: groupIds.get(definition.group),
        isActive: true,
      },
    );
    menuIds.set(definition.timeSlot, menu._id);
  }

  const categoryIds = new Map();
  for (const definition of CATEGORY_DEFS) {
    const category = await upsertOne(
      Category,
      { restaurantId, name: definition.name },
      { ...definition, restaurantId, isActive: true },
    );
    categoryIds.set(definition.name, category._id);
  }

  const warehouse = await upsertOne(
    Warehouse,
    { restaurantId, code: "KHO-TT-01" },
    {
      restaurantId,
      name: "Kho nguyên liệu chính",
      code: "KHO-TT-01",
      address:
        restaurant.address?.line1 ||
        restaurant.address?.city ||
        PRIMARY_RESTAURANT_NAME,
      isActive: true,
    },
  );

  const ingredientIds = new Map();
  for (const [index, definition] of INGREDIENT_DEFS.entries()) {
    const ingredient = await upsertOne(
      Ingredient,
      { restaurantId, name: definition.name },
      {
        restaurantId,
        name: definition.name,
        sku: `COHAN-ING-${String(index + 1).padStart(3, "0")}`,
        baseUnit: definition.baseUnit,
        costPerBaseUnit: definition.costPerBaseUnit,
        minStock: definition.minStock,
        notes: PRICE_REFERENCE_NOTE,
        isActive: true,
        deletedAt: null,
        deleteExpiresAt: null,
      },
    );
    ingredientIds.set(definition.key, ingredient._id);

    await StockItem.findOneAndUpdate(
      {
        restaurantId,
        warehouseId: warehouse._id,
        ingredientId: ingredient._id,
      },
      {
        $set: {
          onHand: definition.onHand,
          reserved: 0,
          costPerUnit: definition.costPerBaseUnit,
          note: PRICE_REFERENCE_NOTE,
        },
        $setOnInsert: {
          restaurantId,
          warehouseId: warehouse._id,
          ingredientId: ingredient._id,
          pricePerUnit: 0,
          batches: [],
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  const summary = { createdItems: 0, updatedItems: 0, recipes: 0 };
  for (const [index, dish] of DISH_DEFS.entries()) {
    const recipeVariants = dish.variants.map((variant) => ({
      ...variant,
      ingredients: variant.ingredients.map((recipeLine) => ({
        ingredientId: ingredientIds.get(recipeLine.ingredient),
        qty: recipeLine.qty,
        unit: recipeLine.unit,
        wastePct: recipeLine.wastePct,
      })),
    }));
    const defaultVariant =
      recipeVariants.find((variant) => variant.isDefault) || recipeVariants[0];
    const basePrice = Math.min(
      ...recipeVariants.map((variant) => Number(variant.price)),
    );
    const hasByWeightVariant = recipeVariants.some(
      (variant) => variant.mode === "BY_WEIGHT",
    );

    const existing = await MenuItem.findOne({ restaurantId, code: dish.code });
    const itemPayload = {
      restaurantId,
      menuId: menuIds.get(dish.timeSlot),
      categoryId: categoryIds.get(dish.category),
      code: dish.code,
      name: dish.name,
      description: dish.description,
      sortOrder: (index + 1) * 10,
      labels: dish.labels,
      foodType: dish.foodType,
      meatTypes: dish.meatTypes,
      dietTags: dish.dietTags,
      allergenTags: dish.allergenTags,
      basePrice,
      defaultServingKey: defaultVariant.key,
      hasByWeightVariant,
      servingPortion: defaultVariant.sellQty,
      servingUnit:
        defaultVariant.mode === "BY_WEIGHT"
          ? defaultVariant.sellUnit
          : "phần",
      prepStation: dish.prepStation,
      status: dish.status,
      avgPrepTimeMin: dish.avgPrepTimeMin,
      thumbImage: dish.thumbImage,
      notes: SEED_KEY,
      deletedAt: null,
      deleteExpiresAt: null,
    };

    let menuItem;
    if (existing) {
      existing.set(itemPayload);
      menuItem = await existing.save();
      summary.updatedItems += 1;
    } else {
      menuItem = await MenuItem.create(itemPayload);
      summary.createdItems += 1;
    }

    await upsertOne(
      Recipe,
      { restaurantId, menuItemId: menuItem._id },
      {
        restaurantId,
        menuItemId: menuItem._id,
        servingVariants: recipeVariants,
        notes: SEED_KEY,
        isActive: true,
        deletedAt: null,
        deleteExpiresAt: null,
      },
    );
    summary.recipes += 1;
  }

  for (const definition of CATEGORY_DEFS) {
    const categoryId = categoryIds.get(definition.name);
    const count = await MenuItem.countDocuments({
      restaurantId,
      categoryId,
      deletedAt: null,
    });
    await Category.updateOne(
      { _id: categoryId },
      { $set: { menuItemCount: count } },
    );
  }

  return {
    restaurantId: idString(restaurantId),
    restaurantName: restaurant.name,
    menus: menuIds.size,
    categories: categoryIds.size,
    ingredients: ingredientIds.size,
    ...summary,
  };
}

async function main() {
  assertDemoScriptAllowed("seedDefenseMenuCatalog.js");
  const catalog = validateDefenseMenuCatalog();
  const mongoUri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0";
  const dbName = process.env.MONGO_DB || "RestaurantDB";

  console.log("Validated defense menu catalog:", catalog);
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  try {
    const restaurant = await resolveRestaurant();
    const result = await seedCatalog(restaurant);
    console.table([result]);
    console.log(
      `✅ Production menu catalog ready: ${catalog.dishes} dishes, ` +
        `${catalog.byWeightDishes} by-weight, ` +
        `${catalog.dualModeDishes} dual-mode, ` +
        `${catalog.ingredients} priced ingredients`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

const scriptPath = fileURLToPath(import.meta.url);
if (path.resolve(process.argv[1] || "") === scriptPath) {
  main().catch(async (error) => {
    console.error(error?.stack || error?.message || error);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}
