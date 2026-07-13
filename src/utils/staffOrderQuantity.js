export const STAFF_ORDER_MAX_PORTIONS = 99;
export const STAFF_ORDER_MAX_WEIGHT_KG = 100;

export const isWeightServingVariant = (variant) =>
  String(variant?.mode || "").trim().toUpperCase() === "BY_WEIGHT";

export const parsePortionQuantity = (value) => {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) return null;

  const quantity = Number(normalized);
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > STAFF_ORDER_MAX_PORTIONS
  ) {
    return null;
  }

  return quantity;
};

export const parseWeightKg = (value) => {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized)) return null;

  const weightKg = Number(normalized);
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    weightKg > STAFF_ORDER_MAX_WEIGHT_KG
  ) {
    return null;
  }

  return weightKg;
};

export const weightKgToGrams = (value) => {
  const weightKg = parseWeightKg(value);
  return weightKg == null ? null : Math.round(weightKg * 1000);
};

export const formatWeightKgFromGrams = (grams) => {
  const numericGrams = Number(grams);
  if (!Number.isFinite(numericGrams) || numericGrams <= 0) return "";

  return Number((numericGrams / 1000).toFixed(3)).toLocaleString("vi-VN", {
    maximumFractionDigits: 3,
  });
};

export const getStaffOrderSelectionTotal = ({
  price,
  variant,
  portionQuantity,
  weightKg,
} = {}) => {
  const unitPrice = Number(price || 0);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return 0;

  if (isWeightServingVariant(variant)) {
    const parsedWeightKg = parseWeightKg(weightKg);
    if (parsedWeightKg == null) return 0;

    const sellQty = Number(variant?.sellQty || 1);
    const safeSellQty = Number.isFinite(sellQty) && sellQty > 0 ? sellQty : 1;
    const sellUnit = String(variant?.sellUnit || "kg").toLowerCase();
    const soldAmount = sellUnit === "g" ? parsedWeightKg * 1000 : parsedWeightKg;

    return Math.round(unitPrice * (soldAmount / safeSellQty));
  }

  const quantity = parsePortionQuantity(portionQuantity);
  return quantity == null ? 0 : Math.round(unitPrice * quantity);
};
