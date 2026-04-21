import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollPeriodSchema = new Schema(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, default: "" },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["draft", "finalized", "locked", "paid"],
      default: "draft",
      index: true,
    },
    settingsSnapshot: { type: Schema.Types.Mixed, default: {} },
    statsSnapshot: { type: Schema.Types.Mixed, default: {} },
    finalizedAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

payrollPeriodSchema.index({ restaurantId: 1, startDate: 1, endDate: 1 }, { unique: true });

export default mongoose.model("PayrollPeriod", payrollPeriodSchema);
