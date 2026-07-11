import { calculateDiscountBreakdown } from "./discountCalculation.service.js";
import { hydrateCheckoutOrderItems } from "./orderItemHydration.service.js";

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundVnd = (value) => Math.max(0, Math.round(toNumber(value, 0)));

const toPlainObject = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : value || {};

const normalizeSelectedModifiers = (item = {}) => {
  if (Array.isArray(item.selectedModifiers)) {
    return item.selectedModifiers
      .map((modifier) => ({
        groupId: modifier?.groupId,
        optionId: modifier?.optionId,
      }))
      .filter((modifier) => modifier.groupId && modifier.optionId);
  }

  return (item.modifiers || [])
    .map((modifier) => ({
      groupId: modifier?.groupId,
      optionId: modifier?.optionId,
    }))
    .filter((modifier) => modifier.groupId && modifier.optionId);
};

const resolveMenuItemId = (item = {}) =>
  item.menuItemId || item.dishId || item.menuId || item.id || item._id || null;

const normalizeRegularInput = (source) => {
  const item = toPlainObject(source);
  const menuItemId = resolveMenuItemId(item);

  return {
    dishId: menuItemId,
    menuId: menuItemId,
    categoryId: item.categoryId || null,
    name: item.name || "",
    unit: item.unit || "portion",
    image: item.image || item.thumbImage || "",
    servingKey: item.servingKey || item.servingVariantKey || "portion",
    servingVariant: item.servingVariant || undefined,
    quantity: Math.max(0, toNumber(item.quantity, 0)),
    weightGrams: item.weightGrams || null,
    selectedModifiers: normalizeSelectedModifiers(item),
    note: item.note || "",
    priority: item.priority || "MEDIUM",
    status: item.status || "pending",
  };
};

const normalizeComboLine = (source) => {
  const item = toPlainObject(source);
  const quantity = Math.max(0, toNumber(item.quantity, 0));
  const comboPrice = roundVnd(
    item.comboSnapshot?.comboPrice ?? item.price ?? item.basePrice ?? 0,
  );

  return {
    itemType: "COMBO",
    comboId: item.comboId || null,
    dishId: resolveMenuItemId(item) || item.comboId || null,
    menuId: item.menuId || resolveMenuItemId(item) || item.comboId || null,
    categoryId: item.categoryId || null,
    name: item.name || item.comboSnapshot?.name || "Combo",
    quantity,
    unitPrice: comboPrice,
    baseUnitPrice: comboPrice,
    lineSubtotal: roundVnd(comboPrice * quantity),
    status: item.status || "pending",
    comboSnapshot: item.comboSnapshot || null,
  };
};

export async function buildCustomerPromotionPricingItems({
  restaurantId,
  items = [],
  session,
}) {
  const sourceItems = Array.isArray(items) ? items.map(toPlainObject) : [];
  const comboItems = sourceItems.filter(
    (item) => String(item.itemType || "MENU_ITEM").toUpperCase() === "COMBO",
  );
  const regularInputs = sourceItems
    .filter(
      (item) => String(item.itemType || "MENU_ITEM").toUpperCase() !== "COMBO",
    )
    .map(normalizeRegularInput)
    .filter((item) => item.dishId && item.quantity > 0);

  const hydratedRegularItems = regularInputs.length
    ? await hydrateCheckoutOrderItems({
        restaurantId,
        items: regularInputs,
        session,
      })
    : [];

  return [
    ...hydratedRegularItems,
    ...comboItems.map(normalizeComboLine).filter((item) => item.quantity > 0),
  ];
}

export async function calculateCustomerPromotionPricing({
  restaurantId,
  items = [],
  pricing = {},
  promotionIds = [],
  userId,
  orderType = "dine_in",
  paymentMethod,
  customerRank,
  customerRanks,
  session,
  now = new Date(),
}) {
  const pricingItems = await buildCustomerPromotionPricingItems({
    restaurantId,
    items,
    session,
  });

  if (!pricingItems.length) {
    return {
      items: [],
      breakdown: {
        subtotal: 0,
        eligibleSubtotal: 0,
        promotionDiscount: 0,
        voucherDiscount: 0,
        couponDiscount: 0,
        shippingDiscount: 0,
        totalDiscount: 0,
        discount: 0,
        promotionLines: [],
        service: 0,
        tax: 0,
        shippingFee: 0,
        finalTotal: 0,
        grandTotal: 0,
        appliedPromotions: [],
        appliedCoupons: [],
      },
    };
  }

  const breakdown = await calculateDiscountBreakdown({
    restaurantId,
    items: pricingItems,
    pricing,
    promotionIds,
    userId,
    orderType,
    paymentMethod,
    customerRank,
    customerRanks,
    session,
    now,
  });

  return { items: pricingItems, breakdown };
}
