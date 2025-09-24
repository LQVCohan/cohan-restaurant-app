import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const AvailabilityLockSchema = new Schema(
  {
    scope: { type: String, enum: ["TABLE", "INGREDIENT"], required: true },
    tableId: { type: Types.ObjectId, ref: "Table" },
    ingredientId: { type: Types.ObjectId, ref: "Ingredient" },
    qty: Number,
    refId: { type: String },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  baseOptions
);

AvailabilityLockSchema.index({ scope: 1, tableId: 1, ingredientId: 1 });

export default mongoose.model("AvailabilityLock", AvailabilityLockSchema);
