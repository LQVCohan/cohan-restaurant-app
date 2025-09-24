import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const PaymentTransactionSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    orderId: { type: Types.ObjectId, ref: "Order" },
    reservationId: { type: Types.ObjectId, ref: "Reservation" },
    method: {
      type: String,
      enum: ["cash", "card", "e_wallet", "bank_transfer"],
      required: true,
    },
    currency: { type: String, default: "VND" },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "authorized",
        "captured",
        "failed",
        "refunded",
        "cancelled",
      ],
      default: "pending",
    },
    provider: String,
    providerTxnId: String,
    meta: Schema.Types.Mixed,
  },
  baseOptions
);

PaymentTransactionSchema.index({ orderId: 1, status: 1 });

export default mongoose.model("PaymentTransaction", PaymentTransactionSchema);
