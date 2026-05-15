// src/graphql/resolvers/menu/index.js

import mongoose from "mongoose";
import { MenuQuery } from "./query.js";
import { MenuMutation } from "./mutation.js";
import { CopyMenuMutation } from "./copyMutation.js";
import { DeleteMenuMutation } from "./deleteMutation.js";
import { CategoryMenu, Recipe, MenuItem, Order } from "../../../models/index.js";

const BILLABLE_ORDER_STATUSES = ["served", "completed"];
const BILLABLE_ITEM_STATUSES = ["served", "ready", "preparing", "pending"];

const getMenuId = (parent) => parent?._id || parent?.id;

async function getMenuOrderStats(parent) {
  const menuId = getMenuId(parent);
  const restaurantId = parent?.restaurantId;

  if (!menuId || !mongoose.isValidObjectId(menuId)) {
    return { revenue: 0, orderCount: 0, soldItemCount: 0 };
  }

  const match = {
    "items.menuId": new mongoose.Types.ObjectId(menuId),
    currentStatus: { $in: BILLABLE_ORDER_STATUSES },
  };

  if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
    match.restaurantId = new mongoose.Types.ObjectId(restaurantId);
  }

  const result = await Order.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $match: {
        "items.menuId": new mongoose.Types.ObjectId(menuId),
        "items.status": { $in: BILLABLE_ITEM_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: { $ifNull: ["$items.lineSubtotal", 0] } },
        orderIds: { $addToSet: "$_id" },
        soldItemCount: { $sum: { $ifNull: ["$items.quantity", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        revenue: { $round: ["$revenue", 0] },
        orderCount: { $size: "$orderIds" },
        soldItemCount: { $round: ["$soldItemCount", 2] },
      },
    },
  ]);

  return result[0] || { revenue: 0, orderCount: 0, soldItemCount: 0 };
}

async function getMenuRating(parent) {
  const menuId = getMenuId(parent);
  if (!menuId || !mongoose.isValidObjectId(menuId)) return null;

  const result = await MenuItem.aggregate([
    { $match: { menuId: new mongoose.Types.ObjectId(menuId), rate: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        rating: { $avg: "$rate" },
      },
    },
    {
      $project: {
        _id: 0,
        rating: { $round: ["$rating", 1] },
      },
    },
  ]);

  return result[0]?.rating ?? null;
}

export default {
  Query: {
    ...MenuQuery,
  },

  Mutation: {
    ...MenuMutation,
    ...CopyMenuMutation,
    ...DeleteMenuMutation,
  },

  MenuItem: {
    async servingVariants(parent) {
      if (parent?.recipe && Array.isArray(parent.recipe.servingVariants)) {
        return parent.recipe.servingVariants;
      }

      const menuItemId = parent._id || parent.id;
      if (!menuItemId || !mongoose.isValidObjectId(menuItemId)) return [];

      const filter = { menuItemId };
      if (
        parent.restaurantId &&
        mongoose.isValidObjectId(parent.restaurantId)
      ) {
        filter.restaurantId = parent.restaurantId;
      }

      const recipe = await Recipe.findOne(filter)
        .select({ servingVariants: 1 })
        .lean();

      return recipe?.servingVariants || [];
    },
  },

  Menu: {
    async categoryMenu(parent) {
      const id = parent.categoryMenuId;
      if (!id) return null;
      return CategoryMenu.findById(id).lean({ virtuals: true });
    },
    async itemCount(parent) {
      const id = getMenuId(parent);
      if (!id || !mongoose.isValidObjectId(id)) return 0;
      return MenuItem.countDocuments({ menuId: id });
    },
    async revenue(parent) {
      return getMenuOrderStats(parent).then((stats) => stats.revenue || 0);
    },
    async orderCount(parent) {
      return getMenuOrderStats(parent).then((stats) => stats.orderCount || 0);
    },
    async soldItemCount(parent) {
      return getMenuOrderStats(parent).then((stats) => stats.soldItemCount || 0);
    },
    async rating(parent) {
      return getMenuRating(parent);
    },
  },
};
