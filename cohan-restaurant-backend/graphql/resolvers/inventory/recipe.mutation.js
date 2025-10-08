// src/graphql/resolvers/inventory/recipe.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Recipe } from "../../../models/index.js";

export default {
  upsertRecipe: async (_p, { input }) => {
    const { restaurantId, menuItemId, servingVariants, ...rest } = input;
    if (![restaurantId, menuItemId].every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid ids");
    }

    // Lấy doc hiện tại để merge servingVariants by key
    const existing = await Recipe.findOne({ restaurantId, menuItemId });

    let patch = { ...rest };
    if (Array.isArray(servingVariants)) {
      const current = existing?.servingVariants || [];
      const map = new Map(current.map((v) => [v.key, v]));
      for (const v of servingVariants) {
        map.set(v.key, v); // override theo key
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
