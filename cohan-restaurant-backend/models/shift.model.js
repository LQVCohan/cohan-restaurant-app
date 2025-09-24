import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const ShiftSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    roleAtShift: {
      type: String,
      enum: ["manager", "cashier", "waiter", "chef", "barista", "other"],
      default: "other",
    },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "checked_in", "checked_out", "cancelled"],
      default: "scheduled",
    },
  },
  baseOptions
);

ShiftSchema.index({ restaurantId: 1, start: -1 });

export default mongoose.model("Shift", ShiftSchema);
