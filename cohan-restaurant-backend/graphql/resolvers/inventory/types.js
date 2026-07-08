import mongoose from "mongoose";
import {
  Ingredient,
  IngredientCategory,
  Recipe,
} from "../../../models/index.js";

const getRecipeFilter = (parent) => {
  const menuItemId = parent?._id || parent?.id;
  if (!menuItemId || !mongoose.isValidObjectId(menuItemId)) return null;

  return {
    menuItemId,
    isActive: { $ne: false },
    deletedAt: null,
    ...(parent?.restaurantId && mongoose.isValidObjectId(parent.restaurantId)
      ? { restaurantId: parent.restaurantId }
      : {}),
  };
};

export default {
  RecipeIngredientLine: {
    name: async (parent, _args, ctx) => {
      const id = parent?.ingredientId;
      if (!id || !mongoose.isValidObjectId(id)) return null;
      const document = await ctx.loaders.ingredientLoader.load(id);
      return document?.name ?? null;
    },
    baseUnit: async (parent, _args, ctx) => {
      const id = parent?.ingredientId;
      if (!id || !mongoose.isValidObjectId(id)) return null;
      const document = await ctx.loaders.ingredientLoader.load(id);
      return document?.baseUnit ?? null;
    },
    costPerBaseUnit: async (parent, _args, ctx) => {
      const id = parent?.ingredientId;
      if (!id || !mongoose.isValidObjectId(id)) return null;
      const document = await ctx.loaders.ingredientLoader.load(id);
      return document?.costPerBaseUnit ?? null;
    },
  },

  MenuItem: {
    ingredientNames: async (parent) => {
      const filter = getRecipeFilter(parent);
      if (!filter) return [];

      const recipe = await Recipe.findOne(filter)
        .select({ "servingVariants.ingredients.ingredientId": 1 })
        .lean();
      const ingredientIds = [
        ...new Set(
          (recipe?.servingVariants || [])
            .flatMap((variant) => variant?.ingredients || [])
            .map((line) => line?.ingredientId)
            .filter(Boolean)
            .map(String),
        ),
      ];
      if (!ingredientIds.length) return [];

      const ingredients = await Ingredient.find({
        _id: { $in: ingredientIds },
      })
        .select({ name: 1 })
        .sort({ name: 1 })
        .lean();

      return [
        ...new Set(
          ingredients.map((ingredient) => ingredient?.name).filter(Boolean),
        ),
      ];
    },

    servingVariants: async (parent) => {
      if (parent?.recipe && Array.isArray(parent.recipe.servingVariants)) {
        return parent.recipe.servingVariants;
      }

      const filter = getRecipeFilter(parent);
      if (!filter) return [];
      const recipe = await Recipe.findOne(filter)
        .select({ servingVariants: 1 })
        .lean();
      return recipe?.servingVariants || [];
    },
  },

  Ingredient: {
    ingredientCategory: async (parent) => {
      const id = parent?.ingredientCategoryId;
      if (!id || !mongoose.isValidObjectId(id)) return null;
      return IngredientCategory.findById(id).lean({ virtuals: true });
    },
  },
};
