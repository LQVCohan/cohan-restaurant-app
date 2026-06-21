// graphql/resolvers/order/helper/orderUtils.js
import mongoose from "mongoose";

export const toId = (id) => {
  if (!id) return null;
  const sid = String(id);
  return mongoose.isValidObjectId(sid)
    ? new mongoose.Types.ObjectId(sid)
    : null;
};

function assertNumber(n, field) {
  const x = Number(n);
  if (!Number.isFinite(x)) {
    throw new Error(`${field} must be a valid number`);
  }
  return x;
}

function assertPositive(n, field) {
  const x = assertNumber(n, field);
  if (!(x > 0)) throw new Error(`${field} must be > 0`);
  return x;
}

function assertInteger(n, field) {
  const x = assertNumber(n, field);
  if (!Number.isInteger(x)) {
    throw new Error(
      `${field} must be an integer in standard unit. Conversion failed (expected grams as integer).`,
    );
  }
  return x;
}

function normalizePriority(value) {
  const key = String(value || "").toUpperCase();
  if (["LOW", "MEDIUM", "HIGH"].includes(key)) return key;
  return "MEDIUM";
}

function normalizeServingKey(raw) {
  const k = raw == null ? "" : String(raw).trim();
  return k || null;
}

export function normalizeItem(input) {
  if (!input) throw new Error("Invalid item");

  const servingKey =
    normalizeServingKey(input.servingKey) ||
    normalizeServingKey(input.servingVariantKey);

  if (!servingKey) {
    throw new Error(
      "servingKey is required. Conversion failed (missing servingKey for stable serving variant).",
    );
  }

  const servingVariant = input.servingVariant || null;
  const basePrice = input.basePrice != null ? Number(input.basePrice) : null;

  if (!servingVariant && basePrice == null) {
    throw new Error("Item must have basePrice or servingVariant");
  }

  if (servingVariant) {
    const nameOk = typeof servingVariant.name === "string";
    const priceNum = Number(servingVariant.price);
    const mode = servingVariant.mode;

    if (!nameOk || !Number.isFinite(priceNum) || !mode) {
      throw new Error("Invalid servingVariant snapshot");
    }
    if (!["PORTION", "BY_WEIGHT"].includes(mode)) {
      throw new Error("Invalid servingVariant.mode");
    }
  }

  const mode = servingVariant?.mode ?? null;
  let quantity = Number(input.quantity ?? 1);
  const weightGramsRaw = input.weightGrams;

  if (mode === "BY_WEIGHT") {
    const grams = assertInteger(weightGramsRaw, "weightGrams");
    if (!(grams > 0)) {
      throw new Error(
        "weightGrams must be > 0. Conversion failed (expected integer grams).",
      );
    }
    quantity = 1;
    input.weightGrams = grams;
  } else {
    if (!(Number.isFinite(quantity) && quantity > 0)) {
      throw new Error("quantity must be > 0");
    }

    if (weightGramsRaw != null) {
      const grams = assertInteger(weightGramsRaw, "weightGrams");
      if (!(grams > 0)) {
        throw new Error(
          "weightGrams must be > 0 when provided. Conversion failed (expected integer grams).",
        );
      }
      input.weightGrams = grams;
    }
  }

  const modifierSource = Array.isArray(input.selectedModifiers)
    ? input.selectedModifiers
    : Array.isArray(input.modifiers)
      ? input.modifiers
      : [];

  const selectedModifiers = modifierSource.map((modifier) => ({
    groupId: modifier.groupId,
    optionId: modifier.optionId,
  }));

  const modifiers = modifierSource.map((modifier) => ({
    optionId: modifier.optionId,
    optionName: modifier.optionName,
    groupId: modifier.groupId,
    price: Number(modifier.price || 0),
  }));

  return {
    dishId: input.dishId || input.id,
    menuId: input.menuId,
    categoryId: input.categoryId,

    name: input.name,
    unit: input.unit || "portion",
    image: input.image || null,
    proofImages: Array.isArray(input.proofImages)
      ? input.proofImages.filter(Boolean)
      : [],

    servingKey,
    basePrice,
    servingVariantId: null,
    servingVariant: servingVariant
      ? {
          name: servingVariant.name,
          price: Number(servingVariant.price),
          mode: servingVariant.mode,
        }
      : null,

    quantity,
    weightGrams:
      mode === "BY_WEIGHT"
        ? assertInteger(input.weightGrams, "weightGrams")
        : input.weightGrams != null
          ? assertInteger(input.weightGrams, "weightGrams")
          : null,

    selectedModifiers,
    modifiers,
    note: input.note || null,
    priority: normalizePriority(input.priority),
    status: input.status || "pending",
  };
}

export function computeTotals(items = []) {
  let subtotal = 0;

  for (const item of items) {
    const modifiersPrice = (item.modifiers || []).reduce(
      (sum, modifier) => sum + (modifier.price || 0),
      0,
    );

    const unitPrice = item.servingVariant?.price ?? item.basePrice ?? 0;
    if (!(Number.isFinite(unitPrice) && unitPrice >= 0)) {
      throw new Error(`Invalid unit price for ${item.name}`);
    }

    let lineSubtotal = 0;

    if (item.servingVariant?.mode === "BY_WEIGHT") {
      const grams = assertInteger(item.weightGrams, "weightGrams");
      if (!(grams > 0)) {
        throw new Error(
          `weightGrams missing/invalid for BY_WEIGHT item ${item.name}`,
        );
      }
      const kg = grams / 1000;
      lineSubtotal = Math.round(unitPrice * kg + modifiersPrice);
    } else {
      const quantityValue = assertPositive(item.quantity, "quantity");
      lineSubtotal = Math.round(unitPrice * quantityValue + modifiersPrice);
    }

    item.modifiersPrice = modifiersPrice;
    item.lineSubtotal = lineSubtotal;

    if (!["cancelled", "returned"].includes(item.status)) {
      subtotal += lineSubtotal;
    }
  }

  return {
    subtotal,
    discount: 0,
    tax: 0,
    service: 0,
    grandTotal: subtotal,
  };
}
