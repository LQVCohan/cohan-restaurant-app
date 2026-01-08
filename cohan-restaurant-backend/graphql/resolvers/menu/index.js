// src/graphql/resolvers/menu/index.js

import mongoose from "mongoose";
import { MenuQuery } from "./query.js";
import { MenuMutation } from "./mutation.js";
import { CategoryMenu, Recipe } from "../../../models/index.js";

export default {
  Query: {
    ...MenuQuery,
  },

  Mutation: {
    ...MenuMutation,
  },

  MenuItem: {
    async servingVariants(parent) {
      if (parent?.recipe && Array.isArray(parent.recipe.servingVariants)) {
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

      const recipe = await Recipe.findOne(filter)
        .select({ servingVariants: 1 })
        .lean();

      return recipe?.servingVariants || [];
    },
  },

  Menu: {
    async categoryMenu(parent) {
      console.log(
        "🔥 [Menu.categoryMenu] id=",
        parent.id || parent._id,
        "categoryMenuId=",
        parent.categoryMenuId
      );
      const id = parent.categoryMenuId;
      if (!id) return null;
      return CategoryMenu.findById(id).lean({ virtuals: true });
    },
  },
};
