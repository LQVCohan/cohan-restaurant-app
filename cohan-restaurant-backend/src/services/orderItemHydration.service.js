import mongoose from "mongoose";
import { MenuItem } from "../../models/index.js";
import {
  getOrderableSupplyCatalogItem,
  isSupplyCatalogItem,
} from "./orderableSupplyCatalog.service.js";
import {
  OrderItemHydrationError,
  hydrateCheckoutOrderItems as hydrateCoreCheckoutOrderItems,
} from "./orderItemHydration.core.js";

export { OrderItemHydrationError };

const PREP_STATIONS = new Set(["kitchen", "bar"]);

const toObjectId = (value) =>
  mongoose.isValidObjectId(String(value || ""))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

const resolveMenuItemId = (item = {}) =>
  item.dishId || item.menuItemId || item.menuId || item.id || item._id || null;

const resolveSupplyId = (item = {}) =>
  item.supplyId ||
  (String(item.itemType || "").toUpperCase() === "SUPPLY"
    ? item.dishId || item.menuItemId || item.id || item._id
    : null);

const invalidItems = (message) => {
  throw new OrderItemHydrationError(message, "INVALID_ITEMS");
};

async function loadAvailableMenuItems({ restaurantId, items, session }) {
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
  }).select("_id name status prepStation");
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

  const missingStation = (docs || []).find(
    (item) => !PREP_STATIONS.has(String(item.prepStation || "").toLowerCase()),
  );
  if (missingStation) {
    invalidItems(
      `Menu item preparation station is not configured: ${missingStation.name || missingStation._id}`,
    );
  }

  return new Map((docs || []).map((item) => [String(item._id), item]));
}

async function classifyCheckoutEntries({ restaurantId, items, session }) {
  const indexedItems = items.map((item, index) => ({ item, index }));
  const explicitSupplies = indexedItems.filter(({ item }) =>
    isSupplyCatalogItem(item),
  );
  const unresolved = indexedItems.filter(
    ({ item }) => !isSupplyCatalogItem(item),
  );
  if (!unresolved.length) {
    return { menuEntries: [], supplyEntries: explicitSupplies };
  }

  const candidateIds = unresolved
    .map(({ item }) => resolveMenuItemId(item))
    .map(toObjectId)
    .filter(Boolean);
  let query = MenuItem.find({
    restaurantId: toObjectId(restaurantId),
    _id: { $in: candidateIds },
  }).select({ _id: 1 });
  if (session) query = query.session(session);
  const knownMenuItems = await query.lean();
  const knownMenuItemIds = new Set(
    knownMenuItems.map((item) => String(item._id)),
  );

  const menuEntries = [];
  const inferredSupplies = [];
  for (const entry of unresolved) {
    const candidateId = resolveMenuItemId(entry.item);
    if (candidateId && knownMenuItemIds.has(String(candidateId))) {
      menuEntries.push(entry);
      continue;
    }
    inferredSupplies.push({
      ...entry,
      item: {
        ...entry.item,
        itemType: "SUPPLY",
        supplyId: candidateId,
      },
    });
  }

  return {
    menuEntries,
    supplyEntries: [...explicitSupplies, ...inferredSupplies],
  };
}

function applyPrepStationSnapshots(hydratedItems, menuItemById) {
  for (const item of hydratedItems || []) {
    const menuItemId = resolveMenuItemId(item);
    const menuItem = menuItemById.get(String(menuItemId || ""));
    if (!menuItem) invalidItems("Unable to resolve menu item preparation station");
    item.prepStation = String(menuItem.prepStation).toLowerCase();
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

async function hydrateSupplyOrderItem({ restaurantId, item, session }) {
  const supplyId = resolveSupplyId(item);
  if (!toObjectId(supplyId)) invalidItems("Invalid supply id");

  if (Array.isArray(item?.selectedModifiers) && item.selectedModifiers.length) {
    invalidItems("Supply items do not support modifiers");
  }

  const catalogItem = await getOrderableSupplyCatalogItem({
    restaurantId,
    supplyId,
    includeOutOfStock: true,
    session,
  });
  if (!catalogItem) invalidItems("Supply is not available for this restaurant");
  if (catalogItem.status !== "available") {
    throw new OrderItemHydrationError(
      `${catalogItem.name || "Supply"} đã hết hàng.`,
      "OUT_OF_STOCK",
    );
  }

  const quantity = Number(item?.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    invalidItems("Supply quantity must be greater than zero");
  }
  if (quantity > Number(catalogItem.maxAvailable || 0)) {
    throw new OrderItemHydrationError(
      `${catalogItem.name || "Supply"} không đủ tồn kho.`,
      "OUT_OF_STOCK",
    );
  }

  const variant = catalogItem.servingVariants[0];
  const unitPrice = Number(variant.price || catalogItem.basePrice || 0);
  const normalizedSupplyId = toObjectId(catalogItem.supplyId);
  return {
    ...item,
    itemType: "SUPPLY",
    supplyId: normalizedSupplyId,
    // Legacy order/inventory callers still forward dishId as menuItemId.
    // The inventory router resolves this id against Supply when no MenuItem exists.
    dishId: normalizedSupplyId,
    menuId: null,
    categoryId: null,
    prepStation: "bar",
    name: catalogItem.name,
    unit: variant.sellUnit || "unit",
    image: catalogItem.thumbImage || null,
    servingKey: variant.key || "unit",
    servingVariant: {
      key: variant.key || "unit",
      name: variant.name || catalogItem.servingUnit || "Đơn vị",
      mode: "PORTION",
      price: unitPrice,
      sellQty: 1,
      sellUnit: variant.sellUnit || "unit",
    },
    quantity,
    weightGrams: null,
    modifiers: [],
    selectedModifiers: [],
    ingredientsSnapshot: [],
    baseUnitPrice: unitPrice,
    unitPrice,
    modifiersPricePerUnit: 0,
    modifiersPrice: 0,
    lineSubtotal: Math.round(unitPrice * quantity),
    status: String(item?.status || "pending"),
  };
}

export async function hydrateCheckoutOrderItems({
  restaurantId,
  items = [],
  session,
}) {
  if (!Array.isArray(items) || !items.length) {
    invalidItems("No checkout items to hydrate");
  }

  const { menuEntries, supplyEntries } = await classifyCheckoutEntries({
    restaurantId,
    items,
    session,
  });
  const result = new Array(items.length);

  if (menuEntries.length) {
    const menuInputItems = menuEntries.map(({ item }) => item);
    const menuItemById = await loadAvailableMenuItems({
      restaurantId,
      items: menuInputItems,
      session,
    });
    const hydratedMenuItems = await hydrateCoreCheckoutOrderItems({
      restaurantId,
      items: menuInputItems,
      session,
    });
    applyPrepStationSnapshots(hydratedMenuItems, menuItemById);
    menuEntries.forEach(({ index }, entryIndex) => {
      result[index] = hydratedMenuItems[entryIndex];
    });
  }

  if (supplyEntries.length) {
    const hydratedSupplies = await Promise.all(
      supplyEntries.map(({ item }) =>
        hydrateSupplyOrderItem({ restaurantId, item, session }),
      ),
    );
    supplyEntries.forEach(({ index }, entryIndex) => {
      result[index] = hydratedSupplies[entryIndex];
    });
  }

  assertTrustedHydrationResult(items, result);
  return result;
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
