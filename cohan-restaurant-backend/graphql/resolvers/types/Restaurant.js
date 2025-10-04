// src/graphql/resolvers/types/Restaurant.js
import { Table, Category, User } from "../../../models/index.js";

export default {
  tables: (parent) => Table.find({ restaurantId: parent._id }),
  categories: (parent) => Category.find({ restaurantId: parent._id }),
  manager: (parent, _, { loaders }) => {
    // dùng DataLoader nếu đã có, rẻ hơn:
    return loaders?.userById
      ? loaders.userById.load(String(parent.managerId))
      : User.findById(parent.managerId);
  },
};
