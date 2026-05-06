import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const ShiftAcknowledgementSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    publicationId: { type: Types.ObjectId, ref: "SchedulePublication", index: true },
    shiftId: { type: Types.ObjectId, ref: "Shift", required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "expired", "cancelled"],
      default: "pending",
      index: true,
    },
    reason: { type: String, default: "" },
    reasonCategory: {
      type: String,
      enum: ["sick", "personal", "emergency", "schedule_conflict", "transportation", "no_reason", "other"],
      default: "no_reason",
    },
    declineClassification: {
      type: String,
      enum: ["valid", "invalid", "late", "unknown"],
      default: "unknown",
    },
    respondedAt: { type: Date, default: null },
    deadlineAt: { type: Date, required: true },
    createdFrom: {
      type: String,
      enum: ["publish", "published_change", "manager_assign"],
      required: true,
      default: "publish",
    },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

ShiftAcknowledgementSchema.index({ shiftId: 1, employeeId: 1 }, { unique: true });

export default mongoose.model("ShiftAcknowledgement", ShiftAcknowledgementSchema);
