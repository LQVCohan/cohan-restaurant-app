import mongoose from "mongoose";
import { MenuItem } from "../../models/index.js";

const toNum = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundVnd = (value) => Math.max(0, Math.round(toNum(value, 0)));

const toObjId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

const resolveMenuItemId = (item = {}) =>
  item?.dishId || item?.menuItemId || item?.id || item?._id || item?.menuId || null;

const resolveServingPrice = (
  menuItem,
  inputServingKey,
  inputServingVariant,
) => {
  const servingKey = String(
    inputServingKey || inputServingVariant?.key || "default",
  );

  const variants = Array.isArray(menuItem?.servingVariants)
    ? menuItem.servingVariants
    : [];

  const matchedVariant =
    variants.find((variant) => String(variant.key || "") === servingKey) ||
    null;

  if (matchedVariant) {
    return {
      servingKey,
      servingVariant: {
        key: matchedVariant.key || servingKey,
        name: matchedVariant.name || inputServingVariant?.name || "",
        mode: matchedVariant.mode || inputServingVariant?.mode || "PORTION",
        price: roundVnd(matchedVariant.price),
        sellQty: matchedVariant.sellQty ?? inputServingVariant?.sellQty ?? null,
        sellUnit:
          matchedVariant.sellUnit ?? inputServingVariant?.sellUnit ?? null,
      },
      basePrice: roundVnd(matchedVariant.price),
    };
  }

  const fallbackPrice = roundVnd(
    menuItem?.price ?? menuItem?.basePrice ?? inputServingVariant?.price ?? 0,
  );

  return {
    servingKey,
    servingVariant: {
      key: servingKey,
      name: inputServingVariant?.name || "Default",
      mode: inputServingVariant?.mode || "PORTION",
      price: fallbackPrice,
      sellQty: inputServingVariant?.sellQty ?? null,
      sellUnit: inputServingVariant?.sellUnit ?? null,
    },
    basePrice: fallbackPrice,
  };
};

export async function buildPricedOrderItems({
  restaurantId,
  items = [],
  session,
}) {
  const rid = toObjId(restaurantId);
  if (!rid) {
    throw new Error("Invalid restaurantId");
  }

  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return [];

  const menuItemIds = [
    ...new Set(
      safeItems
        .map(resolveMenuItemId)
        .filter(Boolean)
        .map(String),
    ),
  ];

  const menuDocs = menuItemIds.length
    ? await MenuItem.find({
        _id: { $in: menuItemIds.map(toObjId).filter(Boolean) },
        restaurantId: rid,
      })
        .session?.(session)
        ?.lean?.()
    : [];

  const menuById = new Map(
    (menuDocs || []).map((item) => [String(item._id), item]),
  );

  return safeItems
    .map((input) => {
      const menuItemId = resolveMenuItemId(input);
      const menu = menuItemId ? menuById.get(String(menuItemId)) : null;

      if (!menu) {
        throw new Error("Invalid order item: menu item not found");
      }

      const quantity = Math.max(0, toNum(input.quantity, 0));
      if (quantity <= 0) return null;

      const pricing = resolveServingPrice(
        menu,
        input.servingKey,
        input.servingVariant,
      );

      const modifiersPrice = 0;
      const unitPrice = roundVnd(pricing.basePrice + modifiersPrice);
      const lineSubtotal = roundVnd(unitPrice * quantity);

      return {
        dishId: menu._id,
        menuId: menu._id,
        categoryId: menu.categoryId || input.categoryId || null,
        name: menu.name || input.name || "",
        unit: menu.unit || input.unit || "",
        image: menu.image || input.image || "",
        proofImages: Array.isArray(input.proofImages) ? input.proofImages : [],
        basePrice: pricing.basePrice,
        servingKey: pricing.servingKey,
        servingVariant: pricing.servingVariant,
        quantity,
        weightGrams: input.weightGrams || null,
        modifiers: [],
        modifiersPrice,
        unitPrice,
        lineSubtotal,
        ingredientsSnapshot: [],
        note: input.note || "",
        priority: input.priority || "MEDIUM",
        status: input.status || "pending",
      };
    })
    .filter(Boolean);
}
