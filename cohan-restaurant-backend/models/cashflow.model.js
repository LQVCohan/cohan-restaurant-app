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
      orderIds: [{ type: Types.ObjectId }],
    },
    note: String,
    category: { type: String, default: "" },
    subcategory: { type: String, default: "" },
    meta: { type: Object, default: {} },
    occurredAt: { type: Date, default: Date.now },
  },
  {} // Options bổ sung (nếu có)
);

CashflowSchema.index({ restaurantId: 1, at: -1 });
CashflowSchema.index({ "ref.kind": 1, "ref.id": 1 }, { unique: true, sparse: true });
CashflowSchema.index({ restaurantId: 1, category: 1, subcategory: 1, occurredAt: -1 });

export default mongoose.models.Cashflow ||
  mongoose.model("Cashflow", CashflowSchema);
