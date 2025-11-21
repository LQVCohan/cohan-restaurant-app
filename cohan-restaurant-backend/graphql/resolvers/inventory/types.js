// src/graphql/resolvers/types.js
import mongoose from "mongoose";
import Recipe from "../../models/recipe.model.js";

export default {
  // ====== TYPE: RecipeComponent ======
  RecipeComponent: {
    ingredientName: async (parent, _args, ctx) => {
      console.log(
        "--------------------------------------------------------------"
      );
      const id = parent.ingredientId;
      if (!id || !mongoose.isValidObjectId(id)) return null;
      const doc = await ctx.loaders.ingredientLoader.load(id);

      return doc?.name ?? null;
    },
  },

  // ====== TYPE: MenuItem ======
  MenuItem: {
    /**
     * Cho phép FE chỉ cần gọi: item.servingVariants
     * Không cần thao tác gì ở file Query.
     */
    servingVariants: async (parent, _args, _ctx) => {
      // 1) Nếu MenuItem đã được auto-populate recipe (theo model chị gửi trước)
      if (
        parent &&
        parent.recipe &&
        Array.isArray(parent.recipe.servingVariants)
      ) {
        return parent.recipe.servingVariants;
      }

      // 2) Fallback: tự đi lấy Recipe nếu vì lý do gì đó chưa populate
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
