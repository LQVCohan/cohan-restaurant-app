import "dotenv/config.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import process from "node:process";
import {
  Ingredient,
  MenuItem,
  Recipe,
  Restaurant,
  StockItem,
  StockMovement,
  Warehouse,
} from "../models/index.js";
import { safeDbInfo } from "./lib/scriptSafety.js";

const EXPECTED_BRAND_ID = "6a447f6bea9844b4c8544c49";
const EXPECTED_DISHES_PER_RESTAURANT = 36;
const DEFAULT_PORTION_TARGET = 30;
const DEFAULT_WEIGHT_TARGET = 5;
const DEFAULT_EDGES = [
  { from: "kg", to: "g", ratio: 1000 },
  { from: "g", to: "kg", ratio: 1 / 1000 },
  { from: "l", to: "ml", ratio: 1000 },
  { from: "ml", to: "l", ratio: 1 / 1000 },
];

const TARGET_RESTAURANTS = [
  {
    id: "69ce9e2e8d8d711f12e251b1",
    expectedName: "Cohan Restaurant",
    codePrefix: "CR1",
  },
  {
    id: "6a447f6bea9844b4c8544c4f",
    expectedName: "Cohan Restaurant 2",
    codePrefix: "CR2",
  },
];

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const ceilInt = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.ceil(number - 1e-9);
};

function getArgValue(prefix) {
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : "";
}

function parsePositiveInteger(value, fallback, label) {
  if (value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return number;
}

function validateOptions() {
  const portionTarget = parsePositiveInteger(
    getArgValue("--portion-target="),
    DEFAULT_PORTION_TARGET,
    "--portion-target",
  );
  const weightTarget = parsePositiveInteger(
    getArgValue("--weight-target="),
    DEFAULT_WEIGHT_TARGET,
    "--weight-target",
  );

  return { portionTarget, weightTarget };
}

function runRecipeSeed(requestedRestaurantId) {
  const scriptPath = fileURLToPath(
    new URL("./seedProductionRecipeBindings.js", import.meta.url),
  );
  const args = [scriptPath, "--apply"];
  if (requestedRestaurantId) args.push(`--restaurantId=${requestedRestaurantId}`);

  const result = spawnSync(process.execPath, args, {
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Production recipe seed failed with exit code ${result.status}`);
  }
}

function buildConversionGraph(conversions = []) {
  const graph = new Map();
  const edges = [...DEFAULT_EDGES];

  for (const conversion of Array.isArray(conversions) ? conversions : []) {
    const from = String(conversion?.from || "").trim();
    const to = String(conversion?.to || "").trim();
    const ratio = toNumber(conversion?.ratio, 0);
    if (!from || !to || !(ratio > 0)) continue;
    edges.push({ from, to, ratio });
    edges.push({ from: to, to: from, ratio: 1 / ratio });
  }

  for (const edge of edges) {
    if (!graph.has(edge.from)) graph.set(edge.from, []);
    graph.get(edge.from).push({ to: edge.to, ratio: edge.ratio });
  }
  return graph;
}

function findMultiplier(fromUnit, toUnit, conversions = []) {
  const from = String(fromUnit || "").trim();
  const to = String(toUnit || "").trim();
  if (!from || !to) return null;
  if (from === to) return 1;

  const graph = buildConversionGraph(conversions);
  const queue = [{ unit: from, multiplier: 1 }];
  const seen = new Set([from]);

  while (queue.length) {
    const current = queue.shift();
    for (const edge of graph.get(current.unit) || []) {
      if (seen.has(edge.to)) continue;
      const multiplier = current.multiplier * edge.ratio;
      if (edge.to === to) return multiplier;
      seen.add(edge.to);
      queue.push({ unit: edge.to, multiplier });
    }
  }
  return null;
}

function getRequiredPerSellUnit(line, variant, ingredient) {
  const qty = toNumber(line?.qty, 0);
  const sellQty = toNumber(variant?.sellQty, 1);
  const wastePct = toNumber(line?.wastePct, 0);
  const sourceUnit = String(line?.unit || ingredient.baseUnit).trim();
  const multiplier = findMultiplier(
    sourceUnit,
    ingredient.baseUnit,
    ingredient.conversions,
  );

  if (!(qty > 0) || !(sellQty > 0)) return 0;
  if (multiplier == null) {
    throw new Error(
      `No conversion ${sourceUnit} -> ${ingredient.baseUnit} for ${ingredient.name}`,
    );
  }

  return ceilInt((qty * multiplier * (1 + wastePct / 100)) / sellQty);
}

async function requireRestaurant(target) {
  const restaurant = await Restaurant.findById(target.id).select({
    _id: 1,
    name: 1,
    brandId: 1,
  });
  if (!restaurant) throw new Error(`Restaurant not found: ${target.id}`);
  if (restaurant.name !== target.expectedName) {
    throw new Error(
      `Restaurant ${target.id} name mismatch: expected "${target.expectedName}", got "${restaurant.name}"`,
    );
  }
  if (String(restaurant.brandId || "") !== EXPECTED_BRAND_ID) {
    throw new Error(`Restaurant ${target.id} does not belong to brand ${EXPECTED_BRAND_ID}`);
  }
  return restaurant;
}

async function resolveOrderWarehouse(restaurantId) {
  const warehouse = await Warehouse.findOne({
    restaurantId,
    isActive: true,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!warehouse) {
    throw new Error(`No active warehouse found for restaurant ${restaurantId}`);
  }
  return warehouse;
}

async function buildRestaurantPlan(target, options) {
  const restaurant = await requireRestaurant(target);
  const warehouse = await resolveOrderWarehouse(restaurant._id);
  const menuItems = await MenuItem.find({
    restaurantId: restaurant._id,
    code: new RegExp(`^${target.codePrefix}-`),
  })
    .select({ _id: 1, code: 1, name: 1 })
    .lean();

  if (menuItems.length !== EXPECTED_DISHES_PER_RESTAURANT) {
    throw new Error(
      `${target.expectedName} must have ${EXPECTED_DISHES_PER_RESTAURANT} production dishes, got ${menuItems.length}`,
    );
  }

  const recipes = await Recipe.find({
    restaurantId: restaurant._id,
    menuItemId: { $in: menuItems.map((item) => item._id) },
    isActive: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select({ menuItemId: 1, servingVariants: 1 })
    .lean();

  if (recipes.length !== EXPECTED_DISHES_PER_RESTAURANT) {
    throw new Error(
      `${target.expectedName} must have ${EXPECTED_DISHES_PER_RESTAURANT} active recipes, got ${recipes.length}`,
    );
  }

  const recipeCountByItem = new Map();
  const ingredientIds = new Set();
  for (const recipe of recipes) {
    const menuItemId = String(recipe.menuItemId);
    recipeCountByItem.set(menuItemId, (recipeCountByItem.get(menuItemId) || 0) + 1);
    for (const variant of recipe.servingVariants || []) {
      for (const line of variant.ingredients || []) {
        if (line.ingredientId) ingredientIds.add(String(line.ingredientId));
      }
    }
  }

  for (const item of menuItems) {
    if (recipeCountByItem.get(String(item._id)) !== 1) {
      throw new Error(`${item.code} must have exactly one active recipe`);
    }
  }

  const ingredients = await Ingredient.find({
    _id: { $in: [...ingredientIds] },
    restaurantId: restaurant._id,
    isActive: { $ne: false },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  })
    .select({ name: 1, baseUnit: 1, conversions: 1, minStock: 1, costPerBaseUnit: 1 })
    .lean();
  const ingredientById = new Map(
    ingredients.map((ingredient) => [String(ingredient._id), ingredient]),
  );

  if (ingredientById.size !== ingredientIds.size) {
    throw new Error(
      `${target.expectedName} has missing or cross-restaurant recipe ingredients`,
    );
  }

  const plannedByIngredient = new Map();
  const variantChecks = [];

  for (const recipe of recipes) {
    const variants = Array.isArray(recipe.servingVariants)
      ? recipe.servingVariants
      : [];
    if (!variants.length) {
      throw new Error(`Recipe ${recipe._id} has no serving variants`);
    }

    for (const variant of variants) {
      const lines = Array.isArray(variant.ingredients) ? variant.ingredients : [];
      if (!lines.length) {
        throw new Error(`Recipe ${recipe._id}/${variant.key || "unknown"} has no ingredients`);
      }

      const targetUnits =
        variant.mode === "BY_WEIGHT" ? options.weightTarget : options.portionTarget;
      const requirements = [];

      for (const line of lines) {
        const ingredient = ingredientById.get(String(line.ingredientId));
        if (!ingredient) {
          throw new Error(`Ingredient not found for recipe line ${line.ingredientId}`);
        }

        const requiredPerUnit = getRequiredPerSellUnit(line, variant, ingredient);
        if (!(requiredPerUnit > 0)) {
          throw new Error(
            `Invalid quantity for ${ingredient.name} in recipe ${recipe._id}/${variant.key}`,
          );
        }

        const planned = requiredPerUnit * targetUnits;
        const current = plannedByIngredient.get(String(ingredient._id)) || {
          ingredient,
          planned: 0,
        };
        current.planned += planned;
        plannedByIngredient.set(String(ingredient._id), current);
        requirements.push({ ingredientId: String(ingredient._id), requiredPerUnit });
      }

      variantChecks.push({
        recipeId: String(recipe._id),
        menuItemId: String(recipe.menuItemId),
        key: variant.key,
        mode: variant.mode,
        targetUnits,
        requirements,
      });
    }
  }

  const stockItems = await StockItem.find({
    restaurantId: restaurant._id,
    warehouseId: warehouse._id,
    ingredientId: { $in: [...ingredientIds] },
  })
    .select({ ingredientId: 1, onHand: 1, reserved: 1 })
    .lean();
  const stockByIngredient = new Map(
    stockItems.map((stock) => [String(stock.ingredientId), stock]),
  );

  const rows = [...plannedByIngredient.entries()].map(([ingredientId, entry]) => {
    const stock = stockByIngredient.get(ingredientId);
    const reserved = Math.max(0, toNumber(stock?.reserved, 0));
    const plannedAvailable = Math.max(
      entry.planned,
      Math.max(0, toNumber(entry.ingredient.minStock, 0)) + 1,
    );
    const targetOnHand = ceilInt(plannedAvailable + reserved);
    const currentOnHand = toNumber(stock?.onHand, 0);

    return {
      ingredientId,
      ingredient: entry.ingredient,
      plannedAvailable: ceilInt(plannedAvailable),
      reserved,
      currentOnHand,
      targetOnHand,
      delta: targetOnHand - currentOnHand,
    };
  });

  const availableByIngredient = new Map(
    rows.map((row) => [row.ingredientId, row.plannedAvailable]),
  );
  let minimumVariantAvailability = Number.MAX_SAFE_INTEGER;
  for (const check of variantChecks) {
    const maxAvailable = Math.min(
      ...check.requirements.map(({ ingredientId, requiredPerUnit }) =>
        Math.floor(toNumber(availableByIngredient.get(ingredientId), 0) / requiredPerUnit),
      ),
    );
    if (maxAvailable < check.targetUnits) {
      throw new Error(
        `${target.expectedName} recipe ${check.recipeId}/${check.key} only supports ${maxAvailable}, expected at least ${check.targetUnits}`,
      );
    }
    if (maxAvailable < minimumVariantAvailability) {
      minimumVariantAvailability = maxAvailable;
    }
  }

  return {
    restaurant,
    warehouse,
    recipes,
    variantChecks,
    rows,
    minimumVariantAvailability:
      minimumVariantAvailability === Number.MAX_SAFE_INTEGER
        ? 0
        : minimumVariantAvailability,
  };
}

async function applyPlan(plan, options) {
  const changedRows = plan.rows.filter((row) => row.delta !== 0);
  if (!changedRows.length) return 0;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const row of changedRows) {
        const filter = {
          restaurantId: plan.restaurant._id,
          warehouseId: plan.warehouse._id,
          ingredientId: row.ingredient._id,
        };

        await StockItem.findOneAndUpdate(
          filter,
          {
            $set: {
              onHand: row.targetOnHand,
              costPerUnit: toNumber(row.ingredient.costPerBaseUnit, 0),
              note: `Tồn kho theo ${options.portionTarget} phần và ${options.weightTarget} đơn vị bán theo khối lượng cho mỗi biến thể công thức.`,
            },
            $setOnInsert: {
              ...filter,
              reserved: 0,
              pricePerUnit: 0,
              batches: [],
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
            session,
          },
        );

        await StockMovement.create(
          [
            {
              ...filter,
              type: "adjustment",
              qty: row.delta,
              reason: "Seed tồn kho theo công thức món ăn",
              meta: {
                script: "seedProductionRecipeStock.js",
                ingredientName: row.ingredient.name,
                baseUnit: row.ingredient.baseUnit,
                beforeOnHand: row.currentOnHand,
                targetOnHand: row.targetOnHand,
                reservedPreserved: row.reserved,
                plannedAvailable: row.plannedAvailable,
                portionTarget: options.portionTarget,
                weightTarget: options.weightTarget,
              },
            },
          ],
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return changedRows.length;
}

async function main() {
  const options = validateOptions();
  const apply = process.argv.includes("--apply");
  const requestedRestaurantId = getArgValue("--restaurantId=");
  const targets = requestedRestaurantId
    ? TARGET_RESTAURANTS.filter((target) => target.id === requestedRestaurantId)
    : TARGET_RESTAURANTS;

  if (!targets.length) {
    throw new Error(`Unsupported restaurantId: ${requestedRestaurantId}`);
  }

  console.log("Recipe stock validation passed:", {
    restaurants: targets.length,
    portionTarget: options.portionTarget,
    weightTarget: options.weightTarget,
  });

  if (!apply) {
    console.log("No database changes were made. Add --apply to seed recipe-based stock.");
    return;
  }
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required when --apply is used");
  }

  runRecipeSeed(requestedRestaurantId);

  const dbName = process.env.MONGO_DB?.trim();
  console.log("Connecting with DB settings:", safeDbInfo());
  await mongoose.connect(process.env.MONGO_URI, dbName ? { dbName } : {});

  try {
    const results = [];
    for (const target of targets) {
      const plan = await buildRestaurantPlan(target, options);
      const changedStockRows = await applyPlan(plan, options);
      results.push({
        restaurantId: String(plan.restaurant._id),
        restaurantName: plan.restaurant.name,
        warehouseName: plan.warehouse.name,
        recipes: plan.recipes.length,
        variants: plan.variantChecks.length,
        ingredients: plan.rows.length,
        changedStockRows,
        minimumVariantAvailability: plan.minimumVariantAvailability,
      });
    }
    console.table(results);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error?.stack || error?.message || error);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  process.exitCode = 1;
});
