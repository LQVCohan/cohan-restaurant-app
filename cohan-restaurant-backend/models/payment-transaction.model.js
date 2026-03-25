import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
const { Types } = mongoose;

const TransactionSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    orderId: { type: Types.ObjectId, ref: "Order" },
    orderIds: [{ type: Types.ObjectId, ref: "Order" }],
    invoiceId: { type: Types.ObjectId, ref: "Invoice" },
    userId: { type: Types.ObjectId, ref: "User" },
    method: {
      type: String,
      enum: ["cash", "card", "transfer", "bank_transfer", "e_wallet", "momo", "vnpay", "other"],
      required: true,
    },
    paidAmount: { type: Number, required: true },
    changeAmount: { type: Number, default: 0 },
    currency: { type: String, default: "VND" },
    status: {
      type: String,
      enum: ["SUCCESS", "PENDING", "FAILED", "CANCELED"],
      default: "SUCCESS",
    },
    txnRef: { type: String }, // Mã giao dịch từ bên thứ 3 (VD: VNPay)
    paidAt: { type: Date, default: Date.now },
  },
  {}
);

TransactionSchema.index({ restaurantId: 1, orderId: 1 });
TransactionSchema.index({ restaurantId: 1, orderIds: 1 });
TransactionSchema.index({ paidAt: -1 });

export default mongoose.models.Transaction ||
  mongoose.model("Transaction", TransactionSchema);
