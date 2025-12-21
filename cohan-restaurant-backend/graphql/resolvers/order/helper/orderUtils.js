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
  // JS integer check
  if (!Number.isInteger(x)) {
    throw new Error(
      `${field} must be an integer in standard unit. Conversion failed (expected grams as integer).`
    );
  }
  return x;
}

function normalizeServingKey(raw) {
  const k = raw == null ? "" : String(raw).trim();
  return k || null;
}

export function normalizeItem(input) {
  if (!input) throw new Error("Invalid item");

  // ✅ servingKey is REQUIRED (no servingVariantId anymore)
  const servingKey =
    normalizeServingKey(input.servingKey) ||
    normalizeServingKey(input.servingVariantKey);

  if (!servingKey) {
    throw new Error(
      "servingKey is required. Conversion failed (missing servingKey for stable serving variant)."
    );
  }

  const servingVariant = input.servingVariant || null;
  const basePrice = input.basePrice != null ? Number(input.basePrice) : null;

  if (!servingVariant && basePrice == null) {
    throw new Error("Item must have basePrice or servingVariant");
  }

  // servingVariant snapshot validation (nếu có)
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

  // quantity / weightGrams rule
  let quantity = Number(input.quantity ?? 1);
  const weightGramsRaw = input.weightGrams;

  if (mode === "BY_WEIGHT") {
    // ✅ must be integer grams
    const grams = assertInteger(weightGramsRaw, "weightGrams");
    if (!(grams > 0)) {
      throw new Error(
        "weightGrams must be > 0. Conversion failed (expected integer grams)."
      );
    }

    // quantity chỉ để UI/đếm line
    quantity = 1;

    // set back normalized
    input.weightGrams = grams;
  } else {
    // PORTION hoặc fallback basePrice
    if (!(Number.isFinite(quantity) && quantity > 0)) {
      throw new Error("quantity must be > 0");
    }

    // weightGrams optional; nếu truyền thì cũng phải là integer grams để thống nhất chuẩn
    if (weightGramsRaw != null) {
      const grams = assertInteger(weightGramsRaw, "weightGrams");
      if (!(grams > 0)) {
        throw new Error(
          "weightGrams must be > 0 when provided. Conversion failed (expected integer grams)."
        );
      }
      input.weightGrams = grams;
    }
  }

  const modifiers = Array.isArray(input.modifiers)
    ? input.modifiers.map((m) => ({
        optionId: m.optionId,
        optionName: m.optionName,
        groupId: m.groupId,
        price: Number(m.price || 0),
      }))
    : [];

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

    // ✅ new stable key
    servingKey,

    basePrice,

    // ❌ remove servingVariantId usage (keep field if your Order model still has it, but should be null)
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

    modifiers,
    note: input.note || null,
    status: input.status || "pending",
  };
}

export function computeTotals(items = []) {
  let subtotal = 0;

  for (const item of items) {
    const modifiersPrice = (item.modifiers || []).reduce(
      (s, m) => s + (m.price || 0),
      0
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
          `weightGrams missing/invalid for BY_WEIGHT item ${item.name}`
        );
      }
      const kg = grams / 1000;
      lineSubtotal = Math.round(unitPrice * kg + modifiersPrice);
    } else {
      const q = assertPositive(item.quantity, "quantity");
      lineSubtotal = Math.round(unitPrice * q + modifiersPrice);
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
