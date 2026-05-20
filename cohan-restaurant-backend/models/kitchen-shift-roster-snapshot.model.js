import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const KitchenShiftRosterSnapshotSchema = new Schema(
  {
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    schedulePublicationId: {
      type: Types.ObjectId,
      ref: "SchedulePublication",
      required: true,
      index: true,
    },
    shiftId: {
      type: Types.ObjectId,
      ref: "Shift",
      required: true,
      index: true,
    },
    employeeId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    employeeName: String,
    employeeCode: String,
    department: String,
    positionTitle: String,
    roleName: String,
    roleSlug: String,
    shiftType: String,
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    station: {
      type: String,
      enum: ["kitchen", "bar"],
      required: true,
    },
    kitchenDutyRole: {
      type: String,
      enum: [
        "head_chef",
        "cook",
        "assistant_chef",
        "helper",
        "bar_lead",
        "bar_staff",
        "team",
      ],
      default: "team",
    },
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["active", "superseded"],
      default: "active",
      index: true,
    },
    source: {
      type: String,
      enum: ["schedule_publish", "schedule_republish"],
      required: true,
    },
    supersededAt: Date,
    createdBy: {
      type: Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

KitchenShiftRosterSnapshotSchema.index({
  restaurantId: 1,
  station: 1,
  startTime: 1,
  endTime: 1,
  status: 1,
});

KitchenShiftRosterSnapshotSchema.index({
  restaurantId: 1,
  schedulePublicationId: 1,
  status: 1,
});

KitchenShiftRosterSnapshotSchema.index({
  shiftId: 1,
  employeeId: 1,
  status: 1,
});

export default mongoose.model(
  "KitchenShiftRosterSnapshot",
  KitchenShiftRosterSnapshotSchema,
);
