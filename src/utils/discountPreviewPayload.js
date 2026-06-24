export const normalizeCouponCode = (value) => {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  return code || null;
};

export const mapDeliveryMethodToOrderType = (deliveryMethod) => {
  if (deliveryMethod === "dinein" || deliveryMethod === "dine_in") {
    return "dine_in";
  }

  if (deliveryMethod === "pickup" || deliveryMethod === "takeaway") {
    return "takeaway";
  }

  return "delivery";
};

export const getShippingFeeForDiscountPreview = ({
  deliveryMethod,
  shippingFee,
}) => {
  if (deliveryMethod !== "delivery") return 0;

  const fee = Number(shippingFee || 0);
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
};

export const mapCartItemToOrderItemInput = (
  item = {},
  { includeCartHoldRef = false } = {},
) => {
  const isCombo = item.itemType === "COMBO" || item.comboId;
  const comboSnapshot = item.comboSnapshot || {};
  const firstComboItemId = comboSnapshot.items?.[0]?.menuItemId;
  const servingKey =
    item.servingKey ||
    item.servingVariantKey ||
    item.variantKey ||
    item.servingVariant?.key ||
    item.selectedServingKey ||
    "portion";

  const unitPrice = Number(
    item.price ??
      item.unitPrice ??
      item.basePrice ??
      item.servingVariant?.price ??
      0,
  );

  const payload = {
    itemType: isCombo ? "COMBO" : "MENU_ITEM",
    comboId: isCombo ? (item.comboId || comboSnapshot.comboId || item.id) : undefined,
    comboSnapshot: isCombo ? comboSnapshot : undefined,
    dishId: isCombo ? firstComboItemId : (item.dishId || item.menuId || item.id),
    menuId: isCombo ? firstComboItemId : (item.menuId || item.dishId || item.id),
    categoryId: item.categoryId || null,
    name: item.name || "",
    unit: item.unit || "phần",
    image: typeof item.image === "string" ? item.image : undefined,
    servingKey,
    quantity: Number(item.quantity || 1),
    selectedModifiers: (item.selectedModifiers || item.modifiers || []).map(
      (modifier) => ({
        groupId: modifier.groupId,
        optionId: modifier.optionId,
      }),
    ),
    note: item.note || item.description || undefined,
    priority: item.priority || "MEDIUM",
  };

  const weightGrams = Number(item.weightGrams);
  if (item.weightGrams != null && Number.isFinite(weightGrams) && weightGrams > 0) {
    payload.weightGrams = Math.round(weightGrams);
  }

  if (!includeCartHoldRef) {
    payload.basePrice = Number.isFinite(unitPrice) ? unitPrice : 0;
    payload.servingVariant = {
      key: servingKey,
      name: item.servingVariant?.name || item.servingName || "Phần",
      mode: item.servingVariant?.mode || item.servingMode || "PORTION",
      price: Number.isFinite(unitPrice) ? unitPrice : 0,
      sellQty: item.servingVariant?.sellQty || 1,
      sellUnit: item.servingVariant?.sellUnit || "portion",
    };
  }

  if (includeCartHoldRef) {
    const cartId = item.backendCartId || item.cartId;
    const cartItemId = item.backendCartItemId || item.cartItemId;

    if (cartId) payload.cartId = cartId;
    if (cartItemId) payload.cartItemId = cartItemId;
  }

  return payload;
};

export const buildDiscountPricingInput = ({
  taxRate = 0,
  serviceRate = 0,
  shippingFee = 0,
  couponCode = "",
}) => ({
  taxRate: Number(taxRate || 0),
  serviceRate: Number(serviceRate || 0),
  shippingFee: Number(shippingFee || 0),
  voucherCode: normalizeCouponCode(couponCode),
});

export const buildOrderDiscountPreviewInput = ({
  restaurantId,
  orderType,
  items = [],
  taxRate = 0,
  serviceRate = 0,
  shippingFee = 0,
  couponCode = "",
  promotionIds = [],
}) => ({
  restaurantId,
  orderType,
  items: items.map(mapCartItemToOrderItemInput),
  pricing: buildDiscountPricingInput({
    taxRate,
    serviceRate,
    shippingFee,
    couponCode,
  }),
  promotionIds: Array.isArray(promotionIds) ? promotionIds : [],
});

export const getDiscountBreakdownTotal = (breakdown, fallback = 0) =>
  Number(breakdown?.grandTotal ?? breakdown?.finalTotal ?? fallback ?? 0);
