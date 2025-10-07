// src/graphql/resolvers/menu/mutation.js
import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Menu, MenuItem, Restaurant } from "../../../models/index.js";

export const MenuMutation = {
  ensureMenu: async (_, { input }) => {
    const { restaurantId, timeSlot, name, description, coverImage } = input;
    const rest = await Restaurant.findById(restaurantId).lean();
    if (!rest) throw new GraphQLError("Restaurant not found");

    const doc = await Menu.findOneAndUpdate(
      { restaurantId, timeSlot },
      {
        $setOnInsert: {
          restaurantId,
          timeSlot,
          name: name || "Menu",
          description,
          coverImage,
          isActive: true,
        },
      },
      { new: true, upsert: true }
    ).lean({ virtuals: true });

    return doc;
  },

  createMenuItem: async (_, { input }) => {
    const { restaurantId, timeSlot, categoryId, ...rest } = input;

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(categoryId)
    ) {
      throw new GraphQLError("Invalid restaurantId or categoryId");
    }

    const menu = await Menu.findOneAndUpdate(
      { restaurantId, timeSlot },
      {
        $setOnInsert: { restaurantId, timeSlot, name: "Menu", isActive: true },
      },
      { new: true, upsert: true }
    ).lean(); // ở đây .lean() OK vì bạn chỉ cần _id

    const created = await MenuItem.create({
      restaurantId,
      menuId: menu._id,
      categoryId,
      ...rest,
    });

    // đọc lại dạng plain object kèm virtuals
    const doc = await MenuItem.findById(created._id).lean({
      virtuals: true,
      getters: true,
    });

    // bảo đảm không null cho field dạng non-null list
    if (!Array.isArray(doc.preparationMethods)) doc.preparationMethods = [];

    return doc; // plain object (lean)
  },

  updateMenuItem: async (_, { input }) => {
    const item = await MenuItem.findById(input.id);
    if (!item) throw new GraphQLError("MenuItem not found");
    const fields = [
      "name",
      "description",
      "basePrice",
      "preparationMethods",
      "thumbImage",
      "mediaAssetIds",
      "modifierGroupIds",
      "status",
      "avgPrepTimeMin",
      "recipe",
      "notes",
    ];
    for (const f of fields) if (input[f] !== undefined) item[f] = input[f];
    await item.save();
    return item.toObject();
  },

  deleteMenuItem: async (_, { id }) => {
    await MenuItem.findByIdAndDelete(id);
    return true;
  },

  toggleMenuItemStatus: async (_, { id, status }) => {
    const item = await MenuItem.findById(id);
    if (!item) throw new GraphQLError("MenuItem not found");
    item.status = status;
    await item.save();
    return item.toObject();
  },
};
