import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Recipe } from "../../../models/index.js";

export default {
  upsertRecipe: async (_p, { input }) => {
    const {
      restaurantId,
      menuItemId,
      servingVariants: inputServingVariants,
      ...rest
    } = input;

    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid ids");
    }

    const existing = await Recipe.findOne({ restaurantId, menuItemId });

    let patch = { ...rest };

    if (Array.isArray(inputServingVariants)) {
      const normalizedVariants = inputServingVariants
        .map((v) => {
          if (!v) return null;
          const {
            key,
            mode,
            yieldQty,
            yieldUnit,
            preparationMethodName,
            ingredients,
            name,
            ...vRest
          } = v;

          const normalizedIngredients = Array.isArray(ingredients)
            ? ingredients.map((c) => ({
                ingredientId: c.ingredientId,
                quantify: Number(c.qty) || 0,
                wastePct: Number(c.wastePct || 0) || 0,
              }))
            : [];

          return {
            ...vRest,
            key,
            mode,
            yieldQty,
            yieldUnit,
            name: preparationMethodName || name || undefined,
            Ingredients: normalizedIngredients,
          };
        })
        .filter(Boolean);

      const current = existing?.servingVariants || [];
      const map = new Map(current.map((v) => [v.key, v]));

      for (const v of normalizedVariants) {
        if (!v?.key) continue;
        map.set(v.key, v);
      }

      patch.servingVariants = Array.from(map.values());
    }

    const doc = await Recipe.findOneAndUpdate(
      { restaurantId, menuItemId },
      { $set: patch },
      { new: true, upsert: true, runValidators: true }
    ).lean({ virtuals: true });

    return doc;
  },

  deleteRecipe: async (_p, { restaurantId, menuItemId }) => {
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId))
      return false;
    const res = await Recipe.deleteOne({ restaurantId, menuItemId });
    return res.deletedCount > 0;
  },
};
