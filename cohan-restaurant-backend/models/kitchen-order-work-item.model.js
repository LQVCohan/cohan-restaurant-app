import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const KitchenOrderWorkItemSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    orderId: { type: Types.ObjectId, ref: "Order", required: true, index: true },
    orderCode: { type: String, index: true },
    orderItemId: { type: Types.ObjectId, required: true, index: true },
    dishId: { type: Types.ObjectId, ref: "MenuItem" },
    menuId: { type: Types.ObjectId, ref: "Menu" },
    categoryId: { type: Types.ObjectId, ref: "Category" },
    dishName: String,
    quantity: Number,
    station: { type: String, enum: ["kitchen", "bar"], required: true },
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "served", "cancelled", "returned"],
      default: "pending",
      index: true,
    },
    kitchenEnteredAt: Date,
    preparingAt: Date,
    readyAt: Date,
    servedAt: Date,
    cancelledAt: Date,
    returnedAt: Date,
    rosterSnapshotId: { type: Types.ObjectId, ref: "KitchenShiftRosterSnapshot" },
    schedulePublicationId: { type: Types.ObjectId, ref: "SchedulePublication" },
    shiftId: { type: Types.ObjectId, ref: "Shift" },
    shiftType: String,
    headChefId: { type: Types.ObjectId, ref: "User" },
    assistantChefIds: [{ type: Types.ObjectId, ref: "User" }],
    teamEmployeeIds: [{ type: Types.ObjectId, ref: "User" }],
    barLeadId: { type: Types.ObjectId, ref: "User" },
    barStaffIds: [{ type: Types.ObjectId, ref: "User" }],
    unaccepted: { type: Boolean, default: false, index: true },
    unacceptedAt: Date,
    unacceptedAfterMinutes: Number,
    unacceptedResponsibleEmployeeIds: [{ type: Types.ObjectId, ref: "User" }],
    unacceptedReason: String,
    noRoster: { type: Boolean, default: false },
    noRosterReason: String,
    actualPrepMinutes: Number,
    targetPrepMinutes: Number,
    timeLevel: { type: String, enum: ["on_time", "late", "very_late", null], default: null },
    lastStatusChangedAt: Date,
    createdBy: { type: Types.ObjectId, ref: "User" },
    updatedBy: { type: Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

KitchenOrderWorkItemSchema.index({ orderId: 1, orderItemId: 1 }, { unique: true });
KitchenOrderWorkItemSchema.index({ restaurantId: 1, station: 1, kitchenEnteredAt: 1 });
KitchenOrderWorkItemSchema.index({ restaurantId: 1, status: 1, updatedAt: 1 });
KitchenOrderWorkItemSchema.index({ restaurantId: 1, status: 1, unaccepted: 1, kitchenEnteredAt: 1 });
KitchenOrderWorkItemSchema.index({ headChefId: 1, kitchenEnteredAt: 1 });
KitchenOrderWorkItemSchema.index({ assistantChefIds: 1, kitchenEnteredAt: 1 });
KitchenOrderWorkItemSchema.index({ teamEmployeeIds: 1, kitchenEnteredAt: 1 });
KitchenOrderWorkItemSchema.index({ unacceptedResponsibleEmployeeIds: 1, kitchenEnteredAt: 1 });
KitchenOrderWorkItemSchema.index({ rosterSnapshotId: 1 });

export default mongoose.model("KitchenOrderWorkItem", KitchenOrderWorkItemSchema);
