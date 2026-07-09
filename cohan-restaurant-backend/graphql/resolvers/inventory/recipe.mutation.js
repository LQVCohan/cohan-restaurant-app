import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Recipe, MenuItem } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const SELL_UNITS = new Set(["portion", "g", "kg"]);
const MODES = new Set(["PORTION", "BY_WEIGHT"]);
const SOFT_DELETE_RETENTION_DAYS = 30;
const ACTIVE_RECIPE_FILTER = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };

function slugifyKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function toNumberOrDefault(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function pickDefaultVariantKey(variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) return undefined;
  const d = variants.find((x) => x?.isDefault);
  return (d?.key || variants[0]?.key || "").trim() || undefined;
}

function computeMinPrice(variants = []) {
  const prices = (Array.isArray(variants) ? variants : [])
    .map((v) => Number(v?.price))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (!prices.length) return 0;
  return Math.min(...prices);
}

function computeHasByWeight(variants = []) {
  return (Array.isArray(variants) ? variants : []).some((v) => v?.mode === "BY_WEIGHT");
}

function normalizeServingVariants(inputServingVariants = []) {
  const normalizedVariants = inputServingVariants
    .map((v) => {
      if (!v) return null;
      const name = (v.name ?? v.preparationMethodName ?? "").trim() || undefined;
      let key = String(v.key || "").trim();
      if (!key && name) key = slugifyKey(name);
      if (!key) return null;
      key = slugifyKey(key);
      if (!key) return null;

      const mode = (v.mode || "PORTION").toString();
      if (!MODES.has(mode)) throw new GraphQLError(`Invalid mode for variant "${key}"`);

      let sellUnit = (v.sellUnit || (mode === "PORTION" ? "portion" : "kg")).toString();
      let sellQty = toNumberOrDefault(v.sellQty, 1);
      if (mode === "PORTION") {
        sellUnit = "portion";
        sellQty = 1;
      } else {
        if (!["kg", "g"].includes(sellUnit)) sellUnit = "kg";
        if (!Number.isFinite(sellQty) || sellQty <= 0) sellQty = 1;
      }
      if (!SELL_UNITS.has(sellUnit)) throw new GraphQLError(`Invalid sellUnit for variant "${key}"`);

      let price = Number(v.price);
      if (!Number.isFinite(price) || price < 0) price = 0;
      const rawLines = Array.isArray(v.ingredients) ? v.ingredients : Array.isArray(v.Ingredients) ? v.Ingredients : [];
      const ingredients = rawLines
        .map((c) => {
          if (!c?.ingredientId) return null;
          const qty = toNumberOrDefault(c.qty ?? c.quantify ?? c.quantity, 0);
          const unit = c.unit ?? c.baseUnit;
          const wastePct = toNumberOrDefault(c.wastePct, 0);
          if (!unit) throw new GraphQLError(`Missing unit for ingredient line in variant "${key}"`);
          if (!Number.isFinite(qty) || qty <= 0) return null;
          return { ingredientId: c.ingredientId, qty, unit, wastePct: Math.min(100, Math.max(0, wastePct)) };
        })
        .filter(Boolean);

      return { key, name, mode, sellQty, sellUnit, ingredients, price, isDefault: !!v.isDefault };
    })
    .filter(Boolean);

  if (normalizedVariants.length === 0) throw new GraphQLError("servingVariants must have at least 1 variant");
  const keys = normalizedVariants.map((x) => x.key);
  if (new Set(keys).size !== keys.length) throw new GraphQLError("servingVariants.key must be unique");
  const defaults = normalizedVariants.filter((v) => v.isDefault);
  if (defaults.length > 1) throw new GraphQLError("Only one servingVariant can be isDefault=true");
  if (defaults.length === 0) normalizedVariants[0].isDefault = true;

  for (const v of normalizedVariants) {
    if (v.mode === "PORTION" && v.sellUnit !== "portion") throw new GraphQLError(`Variant "${v.key}": PORTION must use sellUnit=portion`);
    if (v.mode === "BY_WEIGHT" && !["kg", "g"].includes(v.sellUnit)) throw new GraphQLError(`Variant "${v.key}": BY_WEIGHT must use sellUnit kg/g`);
  }
  return normalizedVariants;
}

async function syncMenuItemFromRecipe({ restaurantId, menuItemId, variants = [] }) {
  try {
    const minPrice = computeMinPrice(variants);
    const defaultServingKey = pickDefaultVariantKey(variants);
    const hasByWeightVariant = computeHasByWeight(variants);
    const setObj = { basePrice: minPrice, hasByWeightVariant };
    if (defaultServingKey) setObj.defaultServingKey = defaultServingKey;
    await MenuItem.updateOne({ _id: menuItemId, restaurantId }, { $set: setObj });
  } catch (err) {
    console.error("sync MenuItem from recipe failed:", err);
  }
}

async function resetMenuItemRecipeCache({ restaurantId, menuItemId }) {
  try {
    await MenuItem.updateOne(
      { _id: menuItemId, restaurantId },
      { $set: { hasByWeightVariant: false }, $unset: { defaultServingKey: 1 } },
    );
  } catch (err) {
    console.error("sync MenuItem after recipe delete failed:", err);
  }
}

export default {
  upsertRecipe: async (_p, { input }, ctx) => {
    const { restaurantId, menuItemId, servingVariants: inputServingVariants, ...rest } = input || {};
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) throw new GraphQLError("Invalid ids");
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_WRITE);

    const patch = { ...rest };
    if (Array.isArray(inputServingVariants)) {
      patch.servingVariants = normalizeServingVariants(inputServingVariants);
    }

    const doc = await Recipe.findOneAndUpdate(
      { restaurantId, menuItemId },
      { $set: patch, $unset: { deletedAt: 1, deleteExpiresAt: 1 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean({ virtuals: true });

    await syncMenuItemFromRecipe({ restaurantId, menuItemId, variants: patch.servingVariants || doc?.servingVariants || [] });
    return doc;
  },

  deleteRecipe: async (_p, { restaurantId, menuItemId }, ctx) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) return false;
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_WRITE);
    const recipe = await Recipe.findOne({ restaurantId, menuItemId, ...ACTIVE_RECIPE_FILTER });
    if (!recipe) return false;
    const now = new Date();
    recipe.set({
      isActive: false,
      deletedAt: now,
      deleteExpiresAt: new Date(now.getTime() + SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    });
    await recipe.save();
    await resetMenuItemRecipeCache({ restaurantId, menuItemId });
    return true;
  },

  restoreRecipe: async (_p, { restaurantId, menuItemId }, ctx) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) return null;
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_WRITE);
    const recipe = await Recipe.findOne({ restaurantId, menuItemId, deletedAt: { $ne: null } });
    if (!recipe) return null;
    recipe.set({ isActive: true, deletedAt: null, deleteExpiresAt: null });
    await recipe.save();
    await syncMenuItemFromRecipe({ restaurantId, menuItemId, variants: recipe.servingVariants || [] });
    return recipe.toObject({ virtuals: true });
  },

  deleteRecipePermanently: async (_p, { restaurantId, menuItemId }, ctx) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) return false;
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_WRITE);

    const res = await Recipe.deleteOne({
      restaurantId,
      menuItemId,
      deletedAt: { $ne: null },
    });

    if (res.deletedCount > 0) {
      await resetMenuItemRecipeCache({ restaurantId, menuItemId });
    }
    return res.deletedCount > 0;
  },
};