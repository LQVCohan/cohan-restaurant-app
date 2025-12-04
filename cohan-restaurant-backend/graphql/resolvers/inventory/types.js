import mongoose from "mongoose";
import { Recipe } from "../../../models/index.js";

export default {
  IngredientsComponent: {
    name: async (parent, _args, ctx) => {
      const id = parent.ingredientId;
      if (!id || !mongoose.isValidObjectId(id)) return null;
      const doc = await ctx.loaders.ingredientLoader.load(id);
      return doc?.name ?? null;
    },
    baseUnit: async (parent, _args, ctx) => {
      const id = parent.ingredientId;
      if (!id || !mongoose.isValidObjectId(id)) return null;
      const doc = await ctx.loaders.ingredientLoader.load(id);
      return doc?.baseUnit ?? null;
    },
    costPerBaseUnit: async (parent, _args, ctx) => {
      const id = parent.ingredientId;
      if (!id || !mongoose.isValidObjectId(id)) return null;
      const doc = await ctx.loaders.ingredientLoader.load(id);
      return doc?.costPerBaseUnit ?? null;
    },
  },

  MenuItem: {
    servingVariants: async (parent, _args, _ctx) => {
      if (
        parent &&
        parent.recipe &&
        Array.isArray(parent.recipe.servingVariants)
      ) {
        return parent.recipe.servingVariants;
      }

      const menuItemId = parent._id || parent.id;
      if (!menuItemId || !mongoose.isValidObjectId(menuItemId)) return [];

      const filter = { menuItemId };
      if (
        parent.restaurantId &&
        mongoose.isValidObjectId(parent.restaurantId)
      ) {
        filter.restaurantId = parent.restaurantId;
      }

      const recipe = await Recipe.findOne(filter).lean();
      return recipe?.servingVariants || [];
    },
  },
};
