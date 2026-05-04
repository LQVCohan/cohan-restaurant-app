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
      default: ["part_time", "seasonal"],
    },
    allowFullTimeUnavailableException: { type: Boolean, default: true },
    lateChangeRequiresApproval: { type: Boolean, default: true },
    createdBy: { type: Types.ObjectId, ref: "User" },
    closedBy: { type: Types.ObjectId, ref: "User" },
    cancelledBy: { type: Types.ObjectId, ref: "User" },
    cancelReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

AvailabilityRegistrationWindowSchema.index(
  { restaurantId: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);

export default model(
  "AvailabilityRegistrationWindow",
  AvailabilityRegistrationWindowSchema,
  "availabilitywindows"
);
