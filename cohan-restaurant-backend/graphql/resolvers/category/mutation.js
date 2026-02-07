// src/graphql/resolvers/category/mutation.js
import { GraphQLError } from "graphql";
import { Category, MenuItem, CategoryMenu } from "../../../models/index.js";

export const CategoryMutation = {
  createCategory: async (_, { input }) => {
    const { restaurantId, name, order = 0 } = input;

    const doc = await Category.findOneAndUpdate(
      {
        name: { $regex: new RegExp(`^${String(name).trim()}$`, "i") },
      },
      {
        $setOnInsert: {
          restaurantId: restaurantId || null,
          name,
          order,
          isActive: true,
        },
      },
      { new: true, upsert: true }
    );

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

  createCategoryMenu: async (_, { input }) => {
    const {
      restaurantId,
      name,
      description,
      coverImage,
      isActive = true,
    } = input;

    const doc = await CategoryMenu.create({
      restaurantId,
      name,
      description,
      coverImage,
      isActive,
    });

    return doc.toObject();
  },

  updateCategoryMenu: async (_, { input }) => {
    const cm = await CategoryMenu.findById(input.id);
    if (!cm) throw new GraphQLError("CategoryMenu not found");

    if (input.name !== undefined) cm.name = input.name;
    if (input.description !== undefined) cm.description = input.description;
    if (input.coverImage !== undefined) cm.coverImage = input.coverImage;
    if (input.isActive !== undefined) cm.isActive = !!input.isActive;

    await cm.save();
    return cm.toObject();
  },

  deleteCategoryMenu: async (_, { id }) => {
    await CategoryMenu.findByIdAndDelete(id);
    return true;
  },
};
