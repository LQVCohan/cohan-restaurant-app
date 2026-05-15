// src/graphql/resolvers/category/mutation.js
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Category, MenuItem, CategoryMenu } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

export const CategoryMutation = {
  createCategory: async (_, { input }, ctx) => {
    const { restaurantId, name, icon = "🍽️", order = 0 } = input;
    if (restaurantId == null) throw new GraphQLError("restaurantId is required");
    if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    await requireRestaurantAccess(ctx, restaurantId);

    const normalizedName = String(name || "").trim();
    const normalizedIcon = String(icon || "🍽️").trim() || "🍽️";

    const doc = await Category.findOneAndUpdate(
      {
        restaurantId: restaurantId || null,
        name: { $regex: new RegExp(`^${normalizedName}$`, "i") },
      },
      {
        $setOnInsert: {
          restaurantId: restaurantId || null,
          name: normalizedName,
          icon: normalizedIcon,
          order,
          isActive: true,
        },
      },
      { new: true, upsert: true }
    );

    return doc.toObject();
  },

  updateCategory: async (_, { input }, ctx) => {
    if (!mongoose.isValidObjectId(input?.id)) throw new GraphQLError("Invalid id");
    const c = await Category.findById(input.id);
    if (!c) throw new GraphQLError("Category not found");
    await requireRestaurantAccess(ctx, c.restaurantId);

    if (input.name !== undefined) c.name = input.name;
    if (input.icon !== undefined) c.icon = String(input.icon || "🍽️").trim() || "🍽️";
    if (input.order !== undefined) c.order = input.order;
    if (input.isActive !== undefined) c.isActive = !!input.isActive;

    await c.save();
    return c.toObject();
  },

  deleteCategory: async (_, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return true;
    const existing = await Category.findById(id).select({ restaurantId: 1 }).lean();
    if (!existing) return true;
    await requireRestaurantAccess(ctx, existing.restaurantId);
    const used = await MenuItem.exists({ categoryId: id, restaurantId: existing.restaurantId });
    if (used)
      throw new GraphQLError("Cannot delete: category is in use by menu items");

    await Category.findByIdAndDelete(id);
    return true;
  },

  createCategoryMenu: async (_, { input }, ctx) => {
    const {
      restaurantId,
      name,
      icon = "🍽️",
      description,
      coverImage,
      isActive = true,
    } = input;

    if (!mongoose.isValidObjectId(restaurantId)) throw new GraphQLError("Invalid restaurantId");
    await requireRestaurantAccess(ctx, restaurantId);
    const doc = await CategoryMenu.create({
      restaurantId,
      name,
      icon: String(icon || "🍽️").trim() || "🍽️",
      description,
      coverImage,
      isActive,
    });

    return doc.toObject();
  },

  updateCategoryMenu: async (_, { input }, ctx) => {
    const cm = await CategoryMenu.findById(input.id);
    if (!cm) throw new GraphQLError("CategoryMenu not found");
    await requireRestaurantAccess(ctx, cm.restaurantId);

    if (input.name !== undefined) cm.name = input.name;
    if (input.icon !== undefined) cm.icon = String(input.icon || "🍽️").trim() || "🍽️";
    if (input.description !== undefined) cm.description = input.description;
    if (input.coverImage !== undefined) cm.coverImage = input.coverImage;
    if (input.isActive !== undefined) cm.isActive = !!input.isActive;

    await cm.save();
    return cm.toObject();
  },

  deleteCategoryMenu: async (_, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return true;
    const existing = await CategoryMenu.findById(id).select({ restaurantId: 1 }).lean();
    if (!existing) return true;
    await requireRestaurantAccess(ctx, existing.restaurantId);
    await CategoryMenu.findByIdAndDelete(id);
    return true;
  },
};