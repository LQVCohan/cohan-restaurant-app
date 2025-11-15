// graphql/resolvers/order/helper/orderUtils.js
import mongoose from "mongoose";

export const toId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

export function normalizeItem(i) {
  const qty = parseFloat(i.quantity ?? 1);
  const price = Number(i.price || 0);
  const modifiersPrice = Number(i.modifiersPrice || 0);
  const lineSubtotal = Math.round(price * qty + modifiersPrice * qty);

  return {
    dishId: i.dishId ?? i.id,
    menuId: i.menuId,
    categoryId: i.categoryId,
    name: i.name,
    unit: i.unit || "portion",
    price,
    modifiersPrice,
    method: i.method || i.cookingMethod || "",
    methodDelta: Number(i.methodDelta || 0),
    note: i.description || "",
    quantity: qty,
    modifiers: (i.modifiers || []).map((m) => ({
      optionId: m.optionId,
      optionName: m.optionName,
      groupId: m.groupId,
      price: Number(m.price || 0),
    })),
    lineSubtotal,
    status: i.status || "pending",
  };
}

export function computeTotals(items) {
  let subtotal = 0;
  for (const it of items) {
    const line =
      it.lineSubtotal != null
        ? Number(it.lineSubtotal)
        : Number(it.price || 0) * Number(it.quantity || 0);
    subtotal += line;
  }
  const tax = Math.round(subtotal * 0.1);
  const service = Math.round(subtotal * 0.05);
  const discount = 0;
  const grandTotal = subtotal + tax + service - discount;
  return { subtotal, discount, tax, service, grandTotal };
}
