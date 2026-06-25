import mongoose from "mongoose";
import { MenuItem } from "../../models/index.js";
import {
  OrderItemHydrationError,
  hydrateCheckoutOrderItems as hydrateCoreCheckoutOrderItems,
} from "./orderItemHydration.core.js";

export { OrderItemHydrationError };

const toObjectId = (value) =>
  mongoose.isValidObjectId(String(value || ""))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

const resolveMenuItemId = (item = {}) =>
  item.dishId || item.menuItemId || item.menuId || item.id || item._id || null;

const invalidItems = (message) => {
  throw new OrderItemHydrationError(message, "INVALID_ITEMS");
};

async function assertMenuItemsAvailable({ restaurantId, items, session }) {
  const rid = toObjectId(restaurantId);
  if (!rid) invalidItems("Invalid restaurantId");

  const inputIds = (items || [])
    .map(resolveMenuItemId)
    .filter(Boolean)
    .map(String);
  const ids = [...new Set(inputIds)].map(toObjectId).filter(Boolean);

  if (!ids.length || ids.length !== new Set(inputIds).size) {
    invalidItems("One or more checkout items have an invalid menu item id");
  }

  const query = MenuItem.find({
    restaurantId: rid,
    _id: { $in: ids },
  }).select("_id name status");
  const docs = await (session ? query.session(session) : query).lean();

  if ((docs || []).length !== ids.length) {
    invalidItems("One or more checkout items are unavailable for this restaurant");
  }

  const unavailable = (docs || []).find(
    (item) => !["available", "active"].includes(String(item.status || "").toLowerCase()),
  );
  if (unavailable) {
    invalidItems(
      `Menu item is not available: ${unavailable.name || unavailable._id}`,
    );
  }
}

function assertTrustedHydrationResult(inputItems, hydratedItems) {
  if (!Array.isArray(hydratedItems) || hydratedItems.length !== inputItems.length) {
    invalidItems("Unable to hydrate all checkout items");
  }

  hydratedItems.forEach((item, index) => {
    const variant = item?.servingVariant;
    const price = Number(variant?.price);
    const sellQty = Number(variant?.sellQty || 1);

    if (!Number.isFinite(price) || price < 0) {
      invalidItems(`Invalid serving price for ${item?.name || "checkout item"}`);
    }
    if (!Number.isFinite(sellQty) || sellQty <= 0) {
      invalidItems(`Invalid serving quantity for ${item?.name || "checkout item"}`);
    }

    if (variant?.mode === "BY_WEIGHT") {
      const grams = Number(inputItems[index]?.weightGrams);
      if (!Number.isFinite(grams) || !Number.isInteger(grams) || grams <= 0) {
        invalidItems("BY_WEIGHT items require explicit positive integer weightGrams");
      }
      item.weightGrams = grams;
    }
  });
}

export async function hydrateCheckoutOrderItems({
  restaurantId,
  items = [],
  session,
}) {
  if (!Array.isArray(items) || !items.length) {
    invalidItems("No checkout items to hydrate");
  }

  await assertMenuItemsAvailable({ restaurantId, items, session });

  const hydratedItems = await hydrateCoreCheckoutOrderItems({
    restaurantId,
    items,
    session,
  });

  assertTrustedHydrationResult(items, hydratedItems);
  return hydratedItems;
}

export async function hydrateOrderItems(args = {}) {
  const hydratedItems = await hydrateCheckoutOrderItems(args);

  if (Array.isArray(args.items)) {
    args.items.splice(0, args.items.length, ...hydratedItems);
    return args.items;
  }

  return hydratedItems;
}

// Backward compatibility for legacy order mutations that still call hydrateOrderItems.
globalThis.hydrateOrderItems = hydrateOrderItems;
