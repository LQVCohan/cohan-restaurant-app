import mongoose from "mongoose";

import Order from "./orderBase.model.js";

const SUPPORT_FLAG = Symbol.for("cohan.orderableSupplyOrderModelSupport");
const itemSchema = Order.schema.path("items")?.schema;

if (itemSchema && !itemSchema[SUPPORT_FLAG]) {
  const itemTypePath = itemSchema.path("itemType");
  if (itemTypePath && !itemTypePath.enumValues.includes("SUPPLY")) {
    itemTypePath.enum("SUPPLY");
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

  for (const pathName of ["dishId", "menuId", "categoryId"]) {
    const path = itemSchema.path(pathName);
    if (!path) continue;
    path.required(false);
    path.required(function requireMenuReferenceForOrderItem() {
      return String(this?.itemType || "MENU_ITEM").toUpperCase() === "MENU_ITEM";
    });
  }

  itemSchema[SUPPORT_FLAG] = true;
}

export default Order;
