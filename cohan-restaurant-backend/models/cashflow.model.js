import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js"; // Giả định
const { Types } = mongoose;

const CashflowSchema = BaseSchemaModel(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    type: { type: String, enum: ["INFLOW", "OUTFLOW"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "VND" },
    ref: {
      kind: String,
      id: { type: Types.ObjectId }, // e.g., kind: 'Invoice', id: ...
    },
    note: String,
    at: { type: Date, default: Date.now },
  },
  {} // Options bổ sung (nếu có)
);

CashflowSchema.index({ restaurantId: 1, at: -1 });

export default mongoose.models.Cashflow ||
  mongoose.model("Cashflow", CashflowSchema);
