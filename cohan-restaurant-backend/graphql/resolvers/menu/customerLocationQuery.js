import mongoose from "mongoose";
import { Menu, MenuItem, Restaurant } from "../../../models/index.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";
import { getMenuItemInventoryAvailability } from "../../../src/services/menuItemAvailability.service.js";

const PUBLIC_BROWSABLE_STATUSES = ["available", "out_of_stock"];

const RESTAURANT_SELECT = {
  _id: 1,
  name: 1,
  address: 1,
  businessStatus: 1,
  publicationStatus: 1,
  status: 1,
  operationalStatus: 1,
  capabilities: 1,
  orderPolicy: 1,
  weeklyOpeningHours: 1,
  specialHours: 1,
  openingHours: 1,
  closingHours: 1,
  timezone: 1,
};

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getLocationPriority = (location) => {
  const trackedStock = Number(location.maxAvailable || 0) > 0;
  const untracked = location.inventoryStatus === "NOT_TRACKED";
  return (
    (location.restaurantAvailability?.canOrder ? 4 : 0) +
    (trackedStock ? 2 : untracked ? 1 : 0)
  );
};

const chooseRestaurantLocation = (current, candidate, sourceItemId) => {
  if (!current) return candidate;
  if (String(candidate.menuItemId) === String(sourceItemId)) return candidate;
  if (String(current.menuItemId) === String(sourceItemId)) return current;

  const priorityDifference =
    getLocationPriority(candidate) - getLocationPriority(current);
  if (priorityDifference !== 0) {
    return priorityDifference > 0 ? candidate : current;
  }
  return Number(candidate.maxAvailable || 0) > Number(current.maxAvailable || 0)
    ? candidate
    : current;
};

export const CustomerMenuLocationQuery = {
  customerMenuItemLocations: async (_parent, { menuItemId }) => {
    if (!mongoose.isValidObjectId(menuItemId)) return [];

    const sourceItem = await MenuItem.findOne({
      _id: menuItemId,
      status: { $in: PUBLIC_BROWSABLE_STATUSES },
    }).lean({ virtuals: true });
    if (!sourceItem) return [];

    const identityConditions = [];
    if (String(sourceItem.code || "").trim()) {
      identityConditions.push({ code: String(sourceItem.code).trim() });
    }
    if (String(sourceItem.name || "").trim()) {
      identityConditions.push({
        name: new RegExp(`^${escapeRegExp(sourceItem.name.trim())}$`, "i"),
      });
    }
    if (!identityConditions.length) return [];

    const candidateItems = await MenuItem.find({
      status: { $in: PUBLIC_BROWSABLE_STATUSES },
      $or: identityConditions,
    })
      .limit(200)
      .lean({ virtuals: true });
    if (!candidateItems.length) return [];

    const activeMenus = await Menu.find({
      _id: { $in: candidateItems.map((item) => item.menuId) },
      isActive: true,
    })
      .select({ _id: 1 })
      .lean();
    const activeMenuIds = new Set(activeMenus.map((menu) => String(menu._id)));
    const activeItems = candidateItems.filter((item) =>
      activeMenuIds.has(String(item.menuId)),
    );
    if (!activeItems.length) return [];

    const restaurants = await Restaurant.find({
      _id: { $in: activeItems.map((item) => item.restaurantId) },
    })
      .select(RESTAURANT_SELECT)
      .lean();
    const publicRestaurants = new Map();
    for (const restaurant of restaurants) {
      const availability = computeRestaurantAvailability(restaurant);
      if (
        availability.businessStatus !== "active" ||
        availability.publicationStatus !== "published"
      ) {
        continue;
      }
      publicRestaurants.set(String(restaurant._id), {
        restaurant,
        availability,
      });
    }

    const locations = (
      await Promise.all(
        activeItems.map(async (menuItem) => {
          const restaurantState = publicRestaurants.get(
            String(menuItem.restaurantId),
          );
          if (!restaurantState) return null;

          const inventory = await getMenuItemInventoryAvailability({
            restaurantId: menuItem.restaurantId,
            menuItemId: menuItem._id,
          });
          const maxAvailable = Math.max(
            0,
            Math.floor(Number(inventory.maxAvailable || 0)),
          );
          const inventoryStatus = inventory.inventoryStatus || "ERROR";
          const isAvailable =
            menuItem.status === "available" &&
            (maxAvailable > 0 || inventoryStatus === "NOT_TRACKED");

          return {
            menuItemId: menuItem._id,
            restaurantId: menuItem.restaurantId,
            menuItem,
            restaurant: restaurantState.restaurant,
            restaurantAvailability: restaurantState.availability,
            inventoryStatus,
            maxAvailable,
            stockWarnings: Array.isArray(inventory.stockWarnings)
              ? inventory.stockWarnings
              : [],
            isAvailable,
          };
        }),
      )
    ).filter(Boolean);

    const byRestaurant = new Map();
    for (const location of locations) {
      const restaurantId = String(location.restaurantId);
      byRestaurant.set(
        restaurantId,
        chooseRestaurantLocation(
          byRestaurant.get(restaurantId),
          location,
          sourceItem._id,
        ),
      );
    }

    return Array.from(byRestaurant.values()).sort((left, right) => {
      const priorityDifference =
        getLocationPriority(right) - getLocationPriority(left);
      if (priorityDifference !== 0) return priorityDifference;

      const stockDifference =
        Number(right.maxAvailable || 0) - Number(left.maxAvailable || 0);
      if (stockDifference !== 0) return stockDifference;

      return String(left.restaurant?.name || "").localeCompare(
        String(right.restaurant?.name || ""),
        "vi",
      );
    });
  },
};
