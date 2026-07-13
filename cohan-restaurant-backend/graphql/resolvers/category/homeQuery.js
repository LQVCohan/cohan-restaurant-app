import {
  Category,
  Menu,
  MenuItem,
  Restaurant,
} from "../../../models/index.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";
import { buildPublicRestaurantFilter } from "../restaurant/publicRestaurantAccess.js";
import { aggregateGlobalHomeCategories } from "./homeCategoryAggregation.js";

async function topGlobalCategoriesByMenuItemCount(
  _,
  { timeSlot, limit = 6 },
) {
  const publicRestaurants = await Restaurant.find(
    buildPublicRestaurantFilter(),
  ).lean();
  const restaurantIds = publicRestaurants
    .filter(
      (restaurant) =>
        computeRestaurantAvailability(restaurant).canOrder === true,
    )
    .map((restaurant) => restaurant._id);

  if (!restaurantIds.length) return [];

  const menus = await Menu.find({
    restaurantId: { $in: restaurantIds },
    isActive: true,
    ...(timeSlot ? { timeSlot } : {}),
  })
    .select({ _id: 1 })
    .lean();

  if (!menus.length) return [];

  const countRows = await MenuItem.aggregate([
    {
      $match: {
        menuId: { $in: menus.map((menu) => menu._id) },
        status: "available",
        categoryId: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$categoryId",
        menuItemCount: { $sum: 1 },
      },
    },
  ]);

  if (!countRows.length) return [];

  const categories = await Category.find({
    _id: { $in: countRows.map((row) => row._id) },
    isActive: { $ne: false },
  })
    .select({
      _id: 1,
      restaurantId: 1,
      name: 1,
      icon: 1,
      order: 1,
      isActive: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .lean();

  return aggregateGlobalHomeCategories({
    countRows,
    categories,
    limit,
  });
}

export const HomeCategoryQuery = {
  topGlobalCategoriesByMenuItemCount,
};
