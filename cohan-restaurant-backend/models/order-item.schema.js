// src/models/order-item.schema.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const OrderModifierSchema = new Schema(
  {
    optionId: { type: String },
    optionName: { type: String, required: true },
    groupId: { type: String },
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const OrderItemSchema = new Schema(
  {
    dishId: String,
    menuId: String,
    categoryId: String,
    name: { type: String, required: true },
    unit: { type: String, default: "phần" },
    image: String,
    price: { type: Number, required: true },
    modifiersPrice: { type: Number, default: 0 },
    method: String,
    methodDelta: { type: Number, default: 0 },
    description: String,
    quantity: { type: Number, required: true, min: 1 },
    modifiers: { type: [OrderModifierSchema], default: [] },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

OrderItemSchema.virtual("lineSubtotal").get(function () {
  const p = Number(this.price || 0) + Number(this.modifiersPrice || 0);
  return Math.max(0, p * Number(this.quantity || 0));
});

export default OrderItemSchema;
