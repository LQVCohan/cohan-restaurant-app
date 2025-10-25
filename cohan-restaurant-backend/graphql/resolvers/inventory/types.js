// src/graphql/resolvers/types.js
import mongoose from "mongoose";

export default {
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
};
