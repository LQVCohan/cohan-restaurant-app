import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Menu, MenuItem } from "../../../models/index.js";
import { MenuMutation } from "./mutation.js";
import { createMenuPriceHistoryMutations } from "./priceHistoryMutation.js";

const priceHistoryMutations = createMenuPriceHistoryMutations(MenuMutation);

export const MenuMultiSlotPriceMutation = {
  bulkUpdateMenuItemPrices: async (parent, args, ctx, info) => {
    const input = args?.input || {};
    if (!input.menuId) {
      return priceHistoryMutations.bulkUpdateMenuItemPrices(
        parent,
        args,
        ctx,
        info,
      );
    }

    if (
      !mongoose.isValidObjectId(input.restaurantId) ||
      !mongoose.isValidObjectId(input.menuId)
    ) {
      throw new GraphQLError("Invalid restaurantId or menuId");
    }

    const menu = await Menu.findOne({
      _id: input.menuId,
      restaurantId: input.restaurantId,
    })
      .select({ _id: 1, timeSlot: 1 })
      .lean();
    if (!menu) throw new GraphQLError("Menu not found");
    if (input.timeSlot && input.timeSlot !== menu.timeSlot) {
      throw new GraphQLError("Menu does not belong to the selected time slot");
    }

    const itemQuery = {
      restaurantId: input.restaurantId,
      menuId: menu._id,
    };
    if (input.target?.categoryId) {
      itemQuery.categoryId = input.target.categoryId;
    }
    if (Array.isArray(input.target?.menuItemIds) && input.target.menuItemIds.length) {
      const ids = input.target.menuItemIds.filter(mongoose.isValidObjectId);
      if (!ids.length) return { updatedCount: 0, items: [] };
      itemQuery._id = { $in: ids };
    }

    const itemIds = await MenuItem.find(itemQuery)
      .select({ _id: 1 })
      .lean()
      .then((items) => items.map((item) => String(item._id)));
    if (!itemIds.length) return { updatedCount: 0, items: [] };

    return priceHistoryMutations.bulkUpdateMenuItemPrices(
      parent,
      {
        ...args,
        input: {
          ...input,
          timeSlot: null,
          target: { menuItemIds: itemIds },
        },
      },
      ctx,
      info,
    );
  },
};
