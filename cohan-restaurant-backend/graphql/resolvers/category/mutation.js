// src/graphql/resolvers/category/mutation.js
import { GraphQLError } from "graphql";
import { Category, MenuItem } from "../../../models/index.js";

export const CategoryMutation = {
  createCategory: async (_, { input }) => {
    const { restaurantId, timeSlot, name, order = 0 } = input;
    const doc = await Category.create({
      restaurantId,
      timeSlot,
      name,
      order,
      isActive: true,
    });
    return doc.toObject();
  },

  updateCategory: async (_, { input }) => {
    const c = await Category.findById(input.id);
    if (!c) throw new GraphQLError("Category not found");
    if (input.name !== undefined) c.name = input.name;
    if (input.order !== undefined) c.order = input.order;
    if (input.isActive !== undefined) c.isActive = !!input.isActive;
    await c.save();
    return c.toObject();
  },

  deleteCategory: async (_, { id }) => {
    const used = await MenuItem.exists({ categoryId: id });
    if (used)
      throw new GraphQLError("Cannot delete: category is in use by menu items");
    await Category.findByIdAndDelete(id);
    return true;
  },
};
