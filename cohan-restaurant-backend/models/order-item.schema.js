// models/order-item.schema.js (ESM)
import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const AppliedModifierSchema = new Schema(
  {
    groupId: { type: Types.ObjectId, ref: "ModifierGroup" },
    optionId: { type: Types.ObjectId, ref: "ModifierOption" },
    name: String,
    priceDelta: Number,
  },
  { _id: false }
);

const OrderItemSchema = new Schema(
  {
    menuItemId: { type: Types.ObjectId, ref: "MenuItem", required: true },
    nameSnapshot: String,
    priceSnapshot: Number,
    qty: { type: Number, default: 1 },
    modifiers: [AppliedModifierSchema],
    note: String,
    subtotal: Number,
  },
  { _id: false }
);

export default OrderItemSchema;
