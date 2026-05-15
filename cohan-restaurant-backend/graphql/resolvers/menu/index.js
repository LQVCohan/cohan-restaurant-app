// src/graphql/resolvers/menu/index.js

import mongoose from "mongoose";
import { MenuQuery } from "./query.js";
import { MenuMutation } from "./mutation.js";
import { CopyMenuMutation } from "./copyMutation.js";
import { DeleteMenuMutation } from "./deleteMutation.js";
import { CategoryMenu, Recipe, MenuItem } from "../../../models/index.js";

export default {
  Query: {
    ...MenuQuery,
  },

  Mutation: {
    ...MenuMutation,
    ...CopyMenuMutation,
    ...DeleteMenuMutation,
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
      const id = parent.categoryMenuId;
      if (!id) return null;
      return CategoryMenu.findById(id).lean({ virtuals: true });
    },
    async itemCount(parent) {
      const id = parent._id || parent.id;
      if (!id || !mongoose.isValidObjectId(id)) return 0;
      return MenuItem.countDocuments({ menuId: id });
    },
  },
};
