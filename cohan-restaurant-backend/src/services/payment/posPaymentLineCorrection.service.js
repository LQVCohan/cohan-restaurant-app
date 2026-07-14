const EXCLUDED_ITEM_STATUSES = new Set(["cancelled", "returned"]);

const toFiniteNumber = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const nonNegative = (value, fallback = 0) =>
  Math.max(0, toFiniteNumber(value, fallback) ?? fallback);

const normalizeModifierLine = (modifier = {}) => ({
  optionId: modifier.optionId,
  optionName: modifier.optionName,
  groupId: modifier.groupId,
  price: nonNegative(modifier.price ?? modifier.priceRule?.amount),
});

export function normalizeAuthoritativeInvoiceLine(item = {}) {
  const quantity = nonNegative(item.quantity);
  if (!(quantity > 0)) return null;

  const storedLineSubtotal = toFiniteNumber(item.lineSubtotal);
  const storedFinalUnitPrice = toFiniteNumber(item.unitPrice ?? item.price);
  const fallbackFinalUnitPrice =
    storedFinalUnitPrice ??
    nonNegative(
      item.baseUnitPrice ?? item.basePrice ?? item.servingVariant?.price,
    ) +
      nonNegative(item.modifiersPricePerUnit ?? item.modifiersPrice);
  const lineSubtotal = Math.max(
    0,
    storedLineSubtotal ?? fallbackFinalUnitPrice * quantity,
  );
  const finalUnitPrice = quantity > 0 ? lineSubtotal / quantity : 0;

  const storedModifiersPrice = nonNegative(
    item.modifiersPricePerUnit ?? item.modifiersPrice,
  );
  const storedBasePrice = toFiniteNumber(
    item.baseUnitPrice ?? item.basePrice ?? item.servingVariant?.price,
  );
  let basePrice =
    storedBasePrice == null
      ? Math.max(0, finalUnitPrice - storedModifiersPrice)
      : Math.max(0, storedBasePrice);
  let modifiersPrice = storedModifiersPrice;

  if (Math.abs(basePrice + modifiersPrice - finalUnitPrice) > 1) {
    if (basePrice <= finalUnitPrice) {
      modifiersPrice = finalUnitPrice - basePrice;
    } else {
      basePrice = finalUnitPrice;
      modifiersPrice = 0;
    }
  }

  const modifiers = (item.modifiers || []).map(normalizeModifierLine);
  const key = JSON.stringify({
    dishId: String(item.dishId || ""),
    menuId: String(item.menuId || ""),
    categoryId: String(item.categoryId || ""),
    name: String(item.name || ""),
    unit: String(item.unit || ""),
    price: basePrice,
    modifiersPrice,
    servingKey: String(item.servingKey || ""),
    modifiers: modifiers.map((modifier) => ({
      optionId: String(modifier.optionId || ""),
      groupId: String(modifier.groupId || ""),
      price: modifier.price,
    })),
  });

  return {
    key,
    subtotal: lineSubtotal,
    line: {
      dishId: String(item.dishId || ""),
      menuId: String(item.menuId || ""),
      categoryId: String(item.categoryId || ""),
      name: item.name,
      unit: item.unit,
      price: basePrice,
      modifiersPrice,
      quantity,
      totals: lineSubtotal,
      modifiers,
    },
  };
}

const mergeInvoiceLines = (normalizedLines = []) => {
  const lineMap = new Map();

  for (const normalized of normalizedLines) {
    if (!normalized) continue;
    const current = lineMap.get(normalized.key);
    if (!current) {
      lineMap.set(normalized.key, { ...normalized.line });
      continue;
    }
    current.quantity += normalized.line.quantity;
    current.totals += normalized.line.totals;
  }

  return [...lineMap.values()];
};

export function buildAuthoritativeInvoiceSnapshot(orders = []) {
  const normalizedLines = [];
  const totals = {
    subtotal: 0,
    discount: 0,
    tax: 0,
    service: 0,
    shippingFee: 0,
    grandTotal: 0,
  };
  let discountReason;
  let voucherCode;
  let promotionId;

  for (const order of orders || []) {
    const activeItems = (order?.items || []).filter(
      (item) =>
        !EXCLUDED_ITEM_STATUSES.has(String(item?.status || "").toLowerCase()),
    );
    const orderLines = activeItems
      .map(normalizeAuthoritativeInvoiceLine)
      .filter(Boolean);
    const authoritativeSubtotal = orderLines.reduce(
      (sum, line) => sum + line.subtotal,
      0,
    );
    const storedSubtotal = activeItems.reduce(
      (sum, item) => sum + nonNegative(item?.lineSubtotal),
      0,
    );
    const ratio = storedSubtotal > 0 ? authoritativeSubtotal / storedSubtotal : 1;
    const orderTotals = order?.totals || {};

    normalizedLines.push(...orderLines);
    totals.subtotal += authoritativeSubtotal;
    totals.discount += nonNegative(orderTotals.discount) * ratio;
    totals.tax += nonNegative(orderTotals.tax) * ratio;
    totals.service += nonNegative(orderTotals.service) * ratio;
    totals.shippingFee += nonNegative(orderTotals.shippingFee) * ratio;
    discountReason ||= orderTotals.discountReason || undefined;
    voucherCode ||= orderTotals.voucherCode || undefined;
    promotionId ||= orderTotals.promotionId || undefined;
  }

  for (const key of [
    "subtotal",
    "discount",
    "tax",
    "service",
    "shippingFee",
  ]) {
    totals[key] = Math.round(totals[key]);
  }
  totals.grandTotal = Math.max(
    0,
    Math.round(
      totals.subtotal -
        totals.discount +
        totals.tax +
        totals.service +
        totals.shippingFee,
    ),
  );

  return {
    lines: mergeInvoiceLines(normalizedLines),
    totals: {
      ...totals,
      ...(discountReason ? { discountReason } : {}),
      ...(voucherCode ? { voucherCode } : {}),
      ...(promotionId ? { promotionId } : {}),
    },
  };
}

export function hasRuntimePaymentDiscount(input = {}) {
  return Boolean(
    String(input?.pricing?.voucherCode || "").trim() ||
      (Array.isArray(input?.promotionIds) && input.promotionIds.length > 0),
  );
}
