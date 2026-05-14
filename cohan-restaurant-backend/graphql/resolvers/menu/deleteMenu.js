import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Menu, MenuItem } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

export const DeleteMenuMutation = {
  deleteMenu: async (_, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    const menu = await Menu.findById(id).lean();
    if (!menu) return true;

    await requireRestaurantPermission(ctx, menu.restaurantId, PERMISSIONS.MENU_WRITE);

    const itemCount = await MenuItem.countDocuments({ menuId: menu._id || id });
    if (itemCount > 0) {
      throw new GraphQLError("MENU_HAS_ITEMS", {
        extensions: { code: "MENU_HAS_ITEMS" },
      });
    }

    await Menu.deleteOne({ _id: id });
    return true;
  },
};
