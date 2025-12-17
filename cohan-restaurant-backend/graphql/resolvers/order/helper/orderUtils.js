// graphql/resolvers/order/helper/orderUtils.js
import mongoose from "mongoose";

export const toId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

export function normalizeItem(input) {
  if (!input) throw new Error("Invalid item");

  const servingVariant = input.servingVariant || null;
  const basePrice = input.basePrice != null ? Number(input.basePrice) : null;

  if (!servingVariant && basePrice == null) {
    throw new Error("Item must have basePrice or servingVariant");
  }

  // servingVariant snapshot validation
  if (servingVariant) {
    if (
      typeof servingVariant.name !== "string" ||
      servingVariant.price == null ||
      typeof Number(servingVariant.price) !== "number" ||
      !servingVariant.mode
    ) {
      throw new Error("Invalid servingVariant snapshot");
    }
    if (!["PORTION", "BY_WEIGHT"].includes(servingVariant.mode)) {
      throw new Error("Invalid servingVariant.mode");
    }
  }

  // quantity / weightGrams rule
  let quantity = Number(input.quantity ?? 1);
  const weightGramsRaw = input.weightGrams;
  const weightGrams = weightGramsRaw == null ? null : Number(weightGramsRaw);

  const mode = servingVariant?.mode ?? null;

  if (mode === "BY_WEIGHT") {
    if (!(weightGrams > 0)) {
      throw new Error("weightGrams is required (>0) for BY_WEIGHT item");
    }
    // quantity chỉ để UI/đếm line
    quantity = 1;
  } else {
    // PORTION hoặc không có servingVariant (fallback basePrice)
    if (!(quantity > 0)) throw new Error("quantity must be > 0");
    // weightGrams không bắt buộc, nhưng nếu truyền phải hợp lệ
    if (weightGrams != null && !(weightGrams > 0)) {
      throw new Error("weightGrams must be > 0 when provided");
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

    basePrice,
    servingVariantId: input.servingVariantId || null,
    servingVariant: servingVariant
      ? {
          name: servingVariant.name,
          price: Number(servingVariant.price),
          mode: servingVariant.mode,
        }
      : null,

    quantity,
    weightGrams: mode === "BY_WEIGHT" ? weightGrams : weightGrams ?? null,

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
    if (!(unitPrice >= 0))
      throw new Error(`Invalid unit price for ${item.name}`);

    let lineSubtotal = 0;

    if (item.servingVariant?.mode === "BY_WEIGHT") {
      if (!(item.weightGrams > 0)) {
        throw new Error(`weightGrams missing for BY_WEIGHT item ${item.name}`);
      }
      const kg = item.weightGrams / 1000;
      lineSubtotal = Math.round(unitPrice * kg + modifiersPrice);
    } else {
      if (!(item.quantity > 0)) {
        throw new Error(`quantity missing for PORTION item ${item.name}`);
      }
      lineSubtotal = Math.round(unitPrice * item.quantity + modifiersPrice);
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
