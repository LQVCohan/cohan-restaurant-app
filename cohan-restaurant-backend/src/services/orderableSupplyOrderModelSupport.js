import mongoose from "mongoose";

import Order from "../../models/order.model.js";

const SUPPORT_FLAG = Symbol.for("cohan.orderableSupplyOrderModelSupport");

function configureConditionalRequirement(itemSchema, pathName) {
  const path = itemSchema.path(pathName);
  if (!path) return;
  path.required(false);
  path.required(function requireMenuReferenceForOrderItem() {
    return String(this?.itemType || "MENU_ITEM").toUpperCase() === "MENU_ITEM";
  });
}

export function ensureOrderableSupplyOrderModelSupport() {
  const itemSchema = Order.schema.path("items")?.schema;
  if (!itemSchema || itemSchema[SUPPORT_FLAG]) return Order;

  const itemTypePath = itemSchema.path("itemType");
  if (itemTypePath && !itemTypePath.enumValues.includes("SUPPLY")) {
    itemTypePath.enumValues.push("SUPPLY");
  }

  if (!itemSchema.path("supplyId")) {
    itemSchema.add({
      supplyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supply",
        required: function requireSupplyId() {
          return String(this?.itemType || "").toUpperCase() === "SUPPLY";
        },
        index: true,
      },
    });
  }

  configureConditionalRequirement(itemSchema, "dishId");
  configureConditionalRequirement(itemSchema, "menuId");
  configureConditionalRequirement(itemSchema, "categoryId");

  itemSchema[SUPPORT_FLAG] = true;
  return Order;
}

ensureOrderableSupplyOrderModelSupport();

export default Order;
