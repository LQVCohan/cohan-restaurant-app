import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const CashflowSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    type: { type: String, enum: ["INCOME", "EXPENSE"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "VND" },
    ref: {
      kind: String,
      id: { type: Types.ObjectId },
    },
    note: String,
    at: { type: Date, default: Date.now },
  },
  baseOptions
);

CashflowSchema.index({ restaurantId: 1, at: -1 });

export default mongoose.model("Cashflow", CashflowSchema);
