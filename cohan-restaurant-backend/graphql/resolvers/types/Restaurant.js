// src/graphql/resolvers/types/Restaurant.js
import { Table, Category } from "../../../models/index.js";

export default {
  tables: (parent) => Table.find({ restaurantId: parent._id }),
  categories: (parent) => Category.find({ restaurantId: parent._id }),
};
