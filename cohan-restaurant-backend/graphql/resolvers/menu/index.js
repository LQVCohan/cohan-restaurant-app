// src/graphql/resolvers/menu/index.js

import { MenuQuery } from "./query.js";
import { MenuMutation } from "./mutation.js";
import { CategoryMenu } from "../../../models/index.js";

export default {
  Query: {
    ...MenuQuery,
  },

  Mutation: {
    ...MenuMutation,
  },

  MenuItem: {
    servingVariants(parent) {
      console.log(
        "🔥 [MenuItem.servingVariants] id=",
        parent.id || parent._id,
        "recipe=",
        parent.recipe
      );

      return parent?.recipe?.servingVariants || [];
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
