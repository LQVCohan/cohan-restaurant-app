// src/graphql/resolvers/menu/index.js

import { MenuQuery } from "./query.js";
import { MenuMutation } from "./mutation.js";

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
};
