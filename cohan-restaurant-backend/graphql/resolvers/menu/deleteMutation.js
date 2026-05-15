import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { Menu, MenuItem, Recipe, AuditLog } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

function getActorId(ctx) {
  return ctx?.user?.id || ctx?.user?._id || null;
}

export const DeleteMenuMutation = {
  deleteMenu: async (_, { id, force = false }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return true;

    const existingMenu = await Menu.findById(id).lean();
    if (!existingMenu) return true;

    await requireRestaurantAccess(ctx, existingMenu.restaurantId);

    const itemCount = await MenuItem.countDocuments({
      restaurantId: existingMenu.restaurantId,
      menuId: existingMenu._id,
    });

    if (itemCount > 0 && !force) {
      throw new GraphQLError(
        `Cannot delete menu: this menu still has ${itemCount} menu item(s). Use force=true to delete menu with items.`,
        {
          extensions: {
            code: "MENU_HAS_ITEMS",
            itemCount,
          },
        },
      );
    }

    const session = await mongoose.startSession();

    try {
      let deletedRecipeCount = 0;
      let deletedItemCount = 0;

      await session.withTransaction(async () => {
        const menuItems = await MenuItem.find({
          restaurantId: existingMenu.restaurantId,
          menuId: existingMenu._id,
        })
          .select({ _id: 1 })
          .session(session)
          .lean();

        const menuItemIds = menuItems.map((item) => item._id);

        if (menuItemIds.length) {
          const recipeDeleteResult = await Recipe.deleteMany({
            restaurantId: existingMenu.restaurantId,
            menuItemId: { $in: menuItemIds },
          }).session(session);
          deletedRecipeCount = recipeDeleteResult.deletedCount || 0;

          const itemDeleteResult = await MenuItem.deleteMany({
            restaurantId: existingMenu.restaurantId,
            menuId: existingMenu._id,
          }).session(session);
          deletedItemCount = itemDeleteResult.deletedCount || 0;
        }

        await Menu.deleteOne({
          _id: existingMenu._id,
          restaurantId: existingMenu.restaurantId,
        }).session(session);

        await AuditLog.create(
          [
            {
              restaurantId: existingMenu.restaurantId,
              entity: "Menu",
              entityId: existingMenu._id,
              action: "delete",
              byUserId: getActorId(ctx),
              diff: {
                type: "delete_menu",
                force: !!force,
                menu: {
                  name: existingMenu.name,
                  timeSlot: existingMenu.timeSlot,
                  description: existingMenu.description,
                  coverImage: existingMenu.coverImage,
                  isActive: existingMenu.isActive,
                  categoryMenuId: existingMenu.categoryMenuId,
                },
                deletedItemCount,
                deletedRecipeCount,
              },
            },
          ],
          { session },
        );
      });

      return true;
    } catch (error) {
      throw new GraphQLError(error?.message || "deleteMenu failed", {
        extensions: error?.extensions || { code: "DELETE_MENU_FAILED" },
      });
    } finally {
      await session.endSession();
    }
  },
};
