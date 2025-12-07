import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Recipe, MenuItem } from "../../../models/index.js";

export default {
  upsertRecipe: async (_p, { input }) => {
    const {
      restaurantId,
      menuItemId,
      servingVariants: inputServingVariants,
      yieldQty: defaultYieldQty,
      yieldUnit: defaultYieldUnit,
      ...rest
    } = input;

    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid ids");
    }

    const existing = await Recipe.findOne({ restaurantId, menuItemId });

    const patch = { ...rest };
    let normalizedVariants = [];

    if (Array.isArray(inputServingVariants)) {
      normalizedVariants = inputServingVariants
        .map((v) => {
          if (!v) return null;

          const {
            key,
            mode,
            yieldQty,
            yieldUnit,
            preparationMethodName,
            ingredients,
            price,
          } = v;

          // 1) chuẩn hoá key
          let finalKey = key;
          if (!finalKey && preparationMethodName) {
            finalKey = String(preparationMethodName)
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "_")
              .slice(0, 80);
          }
          if (!finalKey) return null;

          // 2) chuẩn hoá ingredients
          const normalizedIngredients = Array.isArray(ingredients)
            ? ingredients.map((c) => ({
                ingredientId: c.ingredientId,
                quantify: Number(c.qty) || 0,
                wastePct: Number(c.wastePct || 0) || 0,
                name: c.name,
              }))
            : [];

          // 3) chuẩn hoá price, yield
          let finalPrice = Number(price);
          if (!Number.isFinite(finalPrice) || finalPrice < 0) {
            finalPrice = undefined;
          }

          let finalYieldQty = Number(yieldQty);
          if (!Number.isFinite(finalYieldQty) || finalYieldQty <= 0) {
            finalYieldQty =
              Number(defaultYieldQty) && defaultYieldQty > 0
                ? Number(defaultYieldQty)
                : 1;
          }

          const finalYieldUnit = yieldUnit || defaultYieldUnit || "portion";
          const finalMode = mode || "PORTION";

          return {
            key: finalKey,
            mode: finalMode,
            yieldQty: finalYieldQty,
            yieldUnit: finalYieldUnit,
            name: preparationMethodName || undefined,
            price: finalPrice,
            Ingredients: normalizedIngredients,
          };
        })
        .filter(Boolean);

      // ❗ Quan trọng: FE là source-of-truth → GHI ĐÈ TOÀN BỘ
      patch.servingVariants = normalizedVariants;
    }

    const doc = await Recipe.findOneAndUpdate(
      { restaurantId, menuItemId },
      { $set: patch },
      { new: true, upsert: true, runValidators: true }
    ).lean({ virtuals: true });

    // Sync basePrice từ recipe (giữ nguyên như trước)
    try {
      const allVariants =
        patch.servingVariants || existing?.servingVariants || [];
      const prices = allVariants
        .map((v) => Number(v.price))
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
