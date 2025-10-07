// src/graphql/resolvers/category/query.js
import { Category } from "../../../models/index.js";
export const CategoryQuery = {
  categories: (_, { restaurantId, timeSlot }) =>
    Category.find({ restaurantId, timeSlot })
      .sort({ order: 1, name: 1 })
      .lean({ virtuals: true }),
};
