import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const ScheduleAcknowledgementSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    schedulePublicationId: { type: Types.ObjectId, ref: "SchedulePublication", required: true, index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true, index: true },
    status: { type: String, enum: ["acknowledged", "needs_review"], default: "acknowledged" },
    acknowledgedAt: { type: Date, default: null },
    lastChangedAt: { type: Date, default: null },
    changedAfterAcknowledgement: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ScheduleAcknowledgementSchema.index(
  { restaurantId: 1, employeeId: 1, schedulePublicationId: 1 },
  { unique: true },
);

export default mongoose.model("ScheduleAcknowledgement", ScheduleAcknowledgementSchema);
