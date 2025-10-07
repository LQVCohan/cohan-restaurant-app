// src/graphql/resolvers/types/Restaurant.js
import { User, Table, Category } from "../../../models/index.js";

export default {
  Restaurant: {
    id: (p) => p.id ?? String(p._id),
    manager: (parent) => {
      if (!parent.managerId) return null;
      return User.findById(parent.managerId).lean();
    },

    tables: (parent) => Table.find({ restaurantId: parent.id }).lean(),
    categories: (parent) => Category.find({ restaurantId: parent.id }).lean(),
  },
};
