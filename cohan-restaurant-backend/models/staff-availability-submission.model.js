import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const SlotSchema = new Schema(
  {
    date: { type: Date, required: true },
    shiftType: { type: String, required: true, trim: true },
    status: { type: String, enum: ["available", "unavailable"], required: true },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const StaffAvailabilitySubmissionSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    availabilityWindowId: { type: Types.ObjectId, ref: "AvailabilityRegistrationWindow", required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: "Staff", required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    employmentType: { type: String, enum: ["full_time", "part_time", "probation", "seasonal", "contract"], required: true },
    submissionType: { type: String, enum: ["weekly_availability", "unavailable_exception"], required: true },
    pendingSubmissionType: { type: String, enum: ["weekly_availability", "unavailable_exception"], default: null },
    slots: { type: [SlotSchema], default: [] },
    pendingSlots: { type: [SlotSchema], default: [] },
    submittedAt: { type: Date },
    pendingSubmittedAt: { type: Date, default: null },
    lockedAt: { type: Date },
    status: { type: String, enum: ["draft", "submitted", "locked", "late_change_requested", "approved", "rejected", "cancelled"], default: "draft", index: true },
    previousStatusBeforeLateChange: { type: String, enum: ["draft", "submitted", "locked", "approved", "rejected", "cancelled"], default: null },
    reviewedBy: { type: Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, default: "" },
    source: { type: String, enum: ["employee", "manager", "system"], default: "employee" },
    pendingSource: { type: String, enum: ["employee", "manager", "system"], default: null },
    pendingNote: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

StaffAvailabilitySubmissionSchema.index(
  { availabilityWindowId: 1, employeeId: 1 },
  { unique: true },
);

export default model("StaffAvailabilitySubmission", StaffAvailabilitySubmissionSchema);
