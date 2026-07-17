import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const AvailabilityRegistrationWindowSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    openAt: { type: Date, required: true },
    closeAt: { type: Date, required: true },
    registrationModeSnapshot: { type: String, enum: ["auto", "manual"], default: "manual" },
    workspaceType: {
      type: String,
      enum: ["full_time", "part_time", "rotating"],
      default: "full_time",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "open", "closed", "used_for_schedule", "cancelled"],
      default: "draft",
      index: true,
    },
    targetEmploymentTypes: {
      type: [
        {
          type: String,
          enum: ["full_time", "part_time", "probation", "seasonal", "contract"],
        },
      ],
      default: ["full_time"],
    },
    allowFullTimeUnavailableException: { type: Boolean, default: true },
    lateChangeRequiresApproval: { type: Boolean, default: true },
    createdBy: { type: Types.ObjectId, ref: "User" },
    closedBy: { type: Types.ObjectId, ref: "User" },
    closedAt: { type: Date, default: null },
    usedForScheduleAt: { type: Date, default: null },
    usedForScheduleBy: { type: Types.ObjectId, ref: "User", default: null },
    cancelledBy: { type: Types.ObjectId, ref: "User" },
    cancelReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

AvailabilityRegistrationWindowSchema.index(
  { restaurantId: 1, periodStart: 1, periodEnd: 1, workspaceType: 1 },
  { unique: true },
);

export default model(
  "AvailabilityRegistrationWindow",
  AvailabilityRegistrationWindowSchema,
  "availabilitywindows"
);
