import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Menu, MenuItem, Recipe } from "../../../models/index.js";
import {
  recordMenuPriceChange,
  restoreMenuItemPrices,
} from "../../../src/services/menuPriceHistory.service.js";
import { MENU_PERMISSION, requireMenuPermission } from "./menuPermission.js";

const validIds = (values = []) =>
  [...new Set((Array.isArray(values) ? values : []).map(String))].filter(
    mongoose.isValidObjectId,
  );

async function resolveTargetItemIds(input = {}) {
  const { restaurantId, timeSlot, target = {} } = input;
  const directIds = validIds(target.menuItemIds);
  if (directIds.length) return directIds;

  const query = { restaurantId };
  if (target.categoryId) query.categoryId = target.categoryId;
  if (timeSlot) {
    const menu = await Menu.findOne({ restaurantId, timeSlot })
      .select({ _id: 1 })
      .lean();
    if (!menu) return [];
    query.menuId = menu._id;
  }

  const items = await MenuItem.find(query).select({ _id: 1 }).lean();
  return items.map((item) => String(item._id));
}

const recipeMap = async (restaurantId, menuItemIds) => {
  const recipes = await Recipe.find({
    restaurantId,
    menuItemId: { $in: menuItemIds },
  })
    .select({ menuItemId: 1, servingVariants: 1 })
    .lean();
  return new Map(recipes.map((recipe) => [String(recipe.menuItemId), recipe]));
};

export function createMenuPriceHistoryMutations(baseMenuMutations) {
  return {
    bulkUpdateMenuItemPrices: async (parent, args, ctx, info) => {
      const input = args?.input || {};
      const targetIds = await resolveTargetItemIds(input);
      const beforeByItemId = targetIds.length
        ? await recipeMap(input.restaurantId, targetIds)
        : new Map();

      const result = await baseMenuMutations.bulkUpdateMenuItemPrices(
        parent,
        args,
        ctx,
        info,
      );

      const updatedIds = validIds(
        (result?.items || []).map((item) => item?.id || item?._id),
      );
      if (!updatedIds.length) return result;

      const afterByItemId = await recipeMap(input.restaurantId, updatedIds);
      await Promise.all(
        updatedIds.map((menuItemId) => {
          const before = beforeByItemId.get(menuItemId);
          const after = afterByItemId.get(menuItemId);
          if (!before || !after) return null;
          return recordMenuPriceChange({
            restaurantId: input.restaurantId,
            menuItemId,
            beforeVariants: before.servingVariants,
            afterVariants: after.servingVariants,
            ctx,
            source: "bulk",
          });
        }),
      );

      return result;
    },

    restoreMenuItemPrices: async (_, { input }, ctx) => {
      const restaurantId = input?.restaurantId;
      const menuItemIds = validIds(input?.menuItemIds);
      if (!mongoose.isValidObjectId(restaurantId)) {
        throw new GraphQLError("Invalid restaurantId");
      }
      if (!menuItemIds.length) {
        throw new GraphQLError("Select at least one menu item to restore");
      }

      await requireMenuPermission(
        ctx,
        restaurantId,
        MENU_PERMISSION.UPDATE_PRICE,
      );

      return restoreMenuItemPrices({
        restaurantId,
        menuItemIds,
        ctx,
        reason: "manual",
      });
    },
  };
}
