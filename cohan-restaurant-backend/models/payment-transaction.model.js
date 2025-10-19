import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Types, model } = mongoose;

const PaymentTransactionSchema = BaseSchemaModel({
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", index: true },
  orderId: { type: Types.ObjectId, ref: "Order", index: true },
  reservationId: { type: Types.ObjectId, ref: "Reservation" },

  method: {
    type: String,
    enum: ["cash", "card", "e_wallet", "bank_transfer", "transfer"],
    required: true,
  },

  currency: { type: String, default: "VND" },
  amount: { type: Number, required: true, min: 0 },

  status: {
    type: String,
    enum: [
      "pending",
      "authorized",
      "captured",
      "succeeded",
      "failed",
      "refunded",
      "cancelled",
    ],
    default: "pending",
    index: true,
  },

  provider: String,
  providerTxnId: String,
  message: String,
  meta: Object,
  paidAt: Date,
});

PaymentTransactionSchema.index({ orderId: 1, status: 1 });
PaymentTransactionSchema.index({ restaurantId: 1, createdAt: -1 });

export default model("PaymentTransaction", PaymentTransactionSchema);
