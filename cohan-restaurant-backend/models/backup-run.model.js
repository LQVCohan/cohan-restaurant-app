import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const BackupRunSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    status: {
      type: String,
      enum: ["planned", "checklist_completed", "cancelled"],
      default: "planned",
      index: true,
    },
    checklist: {
      reportsChecked: { type: Boolean, default: false },
      transactionsReconciled: { type: Boolean, default: false },
      settingsReviewed: { type: Boolean, default: false },
      exportPrepared: { type: Boolean, default: false },
      safeCopyStored: { type: Boolean, default: false },
      operatorRecorded: { type: Boolean, default: false },
    },
    scope: {
      ordersAndPayments: { type: Boolean, default: false },
      tablesAndFloorPlan: { type: Boolean, default: true },
      menuAndPricing: { type: Boolean, default: true },
      inventory: { type: Boolean, default: true },
      staffAndPermissions: { type: Boolean, default: false },
      schedules: { type: Boolean, default: true },
      customersAndPromotions: { type: Boolean, default: true },
      reportsAndReconciliation: { type: Boolean, default: false },
    },
    note: { type: String, default: "", maxlength: 1000 },
    createdBy: { type: Types.ObjectId, ref: "User" },
    completedBy: { type: Types.ObjectId, ref: "User" },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.BackupRun || mongoose.model("BackupRun", BackupRunSchema);