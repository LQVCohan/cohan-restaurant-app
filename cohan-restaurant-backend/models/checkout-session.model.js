import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema } = mongoose;

const CheckoutSessionSchema = BaseSchemaModel({
  checkoutCode: { type: String, required: true, index: true },
  idempotencyKey: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  customer: {
    fullName: String,
    phone: String,
    email: String,
  },
  orderIds: [{ type: Schema.Types.ObjectId, ref: "Order" }],
  restaurantIds: [{ type: Schema.Types.ObjectId, ref: "Restaurant" }],
  payment: {
    method: { type: String, default: "cash" },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  },
  totals: {
    subtotal: { type: Number, default: 0 },
    promotionDiscount: { type: Number, default: 0 },
    voucherDiscount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
  },
});

CheckoutSessionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default
  mongoose.models.CheckoutSession ||
  mongoose.model("CheckoutSession", CheckoutSessionSchema);
