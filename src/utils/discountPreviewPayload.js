export const normalizeVoucherCode = (value) => {
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
    dishId: item.dishId || item.menuId || item.id,
    menuId: item.menuId || item.dishId || item.id,
    categoryId: item.categoryId || null,
    name: item.name || "",
    unit: item.unit || "phần",
    image: typeof item.image === "string" ? item.image : undefined,
    basePrice: Number.isFinite(unitPrice) ? unitPrice : 0,
    servingKey,
    servingVariant: {
      key: servingKey,
      name: item.servingVariant?.name || item.servingName || "Phần",
      mode: item.servingVariant?.mode || item.servingMode || "PORTION",
      price: Number.isFinite(unitPrice) ? unitPrice : 0,
      sellQty: item.servingVariant?.sellQty || 1,
      sellUnit: item.servingVariant?.sellUnit || "portion",
    },
    quantity: Number(item.quantity || 1),
    selectedModifiers: (item.modifiers || item.selectedModifiers || []).map(
      (modifier) => ({
        groupId: modifier.groupId,
        optionId: modifier.optionId,
      }),
    ),
    note: item.note || item.description || undefined,
    priority: item.priority || "MEDIUM",
  };

  if (includeCartHoldRef) {
    payload.cartId = item.cartId || item.backendCartId || undefined;
    payload.cartItemId =
      item.cartItemId || item.backendCartItemId || undefined;
  }

  return payload;
};

export const buildDiscountPricingInput = ({
  taxRate = 0,
  serviceRate = 0,
  shippingFee = 0,
  voucherCode = "",
}) => ({
  taxRate: Number(taxRate || 0),
  serviceRate: Number(serviceRate || 0),
  shippingFee: Number(shippingFee || 0),
  voucherCode: normalizeVoucherCode(voucherCode),
});

export const buildOrderDiscountPreviewInput = ({
  restaurantId,
  orderType,
  items = [],
  taxRate = 0,
  serviceRate = 0,
  shippingFee = 0,
  voucherCode = "",
  promotionIds = [],
}) => ({
  restaurantId,
  orderType,
  items: items.map((item) => mapCartItemToOrderItemInput(item)),
  pricing: buildDiscountPricingInput({
    taxRate,
    serviceRate,
    shippingFee,
    voucherCode,
  }),
  promotionIds: Array.isArray(promotionIds) ? promotionIds : [],
});

export const getDiscountBreakdownTotal = (breakdown, fallback = 0) =>
  Number(breakdown?.grandTotal ?? breakdown?.finalTotal ?? fallback ?? 0);
