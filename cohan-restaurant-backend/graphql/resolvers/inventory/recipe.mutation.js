import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Recipe, MenuItem } from "../../../models/index.js";

const SELL_UNITS = new Set(["portion", "g", "kg"]);
const MODES = new Set(["PORTION", "BY_WEIGHT"]);

function slugifyKey(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "") // bỏ ký tự lạ
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function toNumberOrDefault(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export default {
  upsertRecipe: async (_p, { input }) => {
    const {
      restaurantId,
      menuItemId,
      servingVariants: inputServingVariants,
      ...rest
    } = input || {};

    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid ids");
    }

    const patch = { ...rest };
    let normalizedVariants = [];

    if (Array.isArray(inputServingVariants)) {
      normalizedVariants = inputServingVariants
        .map((v) => {
          if (!v) return null;

          // Backward compatibility: name có thể đến từ preparationMethodName (cũ)
          const name =
            (v.name ?? v.preparationMethodName ?? "").trim() || undefined;

          // Key: bắt buộc ổn định
          let key = String(v.key || "").trim();
          if (!key && name) key = slugifyKey(name);
          if (!key) return null;

          key = slugifyKey(key);
          if (!key) return null;

          // Mode
          const mode = (v.mode || "PORTION").toString();
          if (!MODES.has(mode)) {
            throw new GraphQLError(`Invalid mode for variant "${key}"`);
          }

          // Sell unit/qty
          let sellUnit = (
            v.sellUnit || (mode === "PORTION" ? "portion" : "kg")
          ).toString();
          let sellQty = toNumberOrDefault(v.sellQty, 1);

          if (mode === "PORTION") {
            sellUnit = "portion";
            sellQty = 1; // portion bán theo 1 phần
          } else {
            // BY_WEIGHT
            if (!["kg", "g"].includes(sellUnit)) sellUnit = "kg";
            if (!Number.isFinite(sellQty) || sellQty <= 0) sellQty = 1;
          }

          if (!SELL_UNITS.has(sellUnit)) {
            throw new GraphQLError(`Invalid sellUnit for variant "${key}"`);
          }

          // Price
          let price = Number(v.price);
          if (!Number.isFinite(price) || price < 0) price = 0;

          // isDefault
          const isDefault = !!v.isDefault;

          // Ingredients lines: bắt buộc qty + unit
          const rawLines = Array.isArray(v.ingredients)
            ? v.ingredients
            : Array.isArray(v.Ingredients) // fallback legacy
            ? v.Ingredients
            : [];

          const ingredients = rawLines
            .map((c) => {
              if (!c?.ingredientId) return null;

              const qty = toNumberOrDefault(
                c.qty ?? c.quantify ?? c.quantity, // fallback legacy
                0
              );
              const unit = c.unit ?? c.baseUnit; // baseUnit fallback legacy
              const wastePct = toNumberOrDefault(c.wastePct, 0);

              if (!unit) {
                throw new GraphQLError(
                  `Missing unit for ingredient line in variant "${key}"`
                );
              }

              // qty = 0 thì bỏ qua để sạch dữ liệu
              if (!Number.isFinite(qty) || qty <= 0) return null;

              return {
                ingredientId: c.ingredientId,
                qty,
                unit,
                wastePct: Math.min(100, Math.max(0, wastePct)),
              };
            })
            .filter(Boolean);

          return {
            key,
            name,
            mode,
            sellQty,
            sellUnit,
            ingredients,
            price,
            isDefault,
          };
        })
        .filter(Boolean);

      if (normalizedVariants.length === 0) {
        throw new GraphQLError("servingVariants must have at least 1 variant");
      }

      // Validate unique key
      const keys = normalizedVariants.map((x) => x.key);
      const set = new Set(keys);
      if (set.size !== keys.length) {
        throw new GraphQLError("servingVariants.key must be unique");
      }

      // Validate only one default
      const defaults = normalizedVariants.filter((v) => v.isDefault);
      if (defaults.length > 1) {
        throw new GraphQLError("Only one servingVariant can be isDefault=true");
      }

      // Auto set default nếu chưa có
      if (defaults.length === 0) {
        normalizedVariants[0].isDefault = true;
      }

      // Final consistency checks (mode vs sellUnit)
      for (const v of normalizedVariants) {
        if (v.mode === "PORTION" && v.sellUnit !== "portion") {
          throw new GraphQLError(
            `Variant "${v.key}": PORTION must use sellUnit=portion`
          );
        }
        if (v.mode === "BY_WEIGHT" && !["kg", "g"].includes(v.sellUnit)) {
          throw new GraphQLError(
            `Variant "${v.key}": BY_WEIGHT must use sellUnit kg/g`
          );
        }
      }

      // FE source-of-truth → overwrite toàn bộ
      patch.servingVariants = normalizedVariants;
    }

    // Upsert
    const doc = await Recipe.findOneAndUpdate(
      { restaurantId, menuItemId },
      { $set: patch },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).lean({ virtuals: true });

    // Sync MenuItem.basePrice = min variant.price
    try {
      const variants = patch.servingVariants || doc?.servingVariants || [];
      const prices = variants
        .map((v) => Number(v?.price))
        .filter((n) => Number.isFinite(n) && n >= 0);

      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        await MenuItem.updateOne(
          { _id: menuItemId, restaurantId },
          { $set: { basePrice: minPrice } }
        );
      }
    } catch (err) {
      console.error("sync MenuItem.basePrice from recipe failed:", err);
    }

    return doc;
  },

  deleteRecipe: async (_p, { restaurantId, menuItemId }) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId))
      return false;
    const res = await Recipe.deleteOne({ restaurantId, menuItemId });
    return res.deletedCount > 0;
  },
};
