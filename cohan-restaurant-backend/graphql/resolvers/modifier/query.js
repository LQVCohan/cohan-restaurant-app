// src/graphql/resolvers/modifier/query.js
import { ModifierGroup } from "../../../models/index.js";

export const ModifierQuery = {
  modifierGroups: async (_, { restaurantId, search }) => {
    const q = { restaurantId };
    if (search) q.name = new RegExp(search, "i");
    return ModifierGroup.find(q).sort({ name: 1 }).lean({ virtuals: true });
  },

  modifierGroup: async (_, { id }) => {
    return ModifierGroup.findById(id).lean({ virtuals: true });
  },
};
