import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

export const CASHIER_RECONCILIATION_STATUSES = Object.freeze([
  "OPEN",
  "SUBMITTED",
  "APPROVED",
  "WAIVED",
  "REJECTED",
]);

export const CASHIER_MOVEMENT_TYPES = Object.freeze(["CASH_IN", "CASH_OUT"]);

const CashMovementSchema = new Schema(
  {
    type: { type: String, enum: CASHIER_MOVEMENT_TYPES, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    occurredAt: { type: Date, required: true, default: Date.now },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { _id: true },
);

const ReconciliationAuditSchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    actorId: { type: Types.ObjectId, ref: "User" },
    previousStatus: String,
    nextStatus: String,
    note: { type: String, trim: true, maxlength: 1000 },
    metadata: Schema.Types.Mixed,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const CashierShiftReconciliationSchema = BaseSchemaModel({
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
  cashierId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  shiftId: { type: Types.ObjectId, ref: "Shift", default: null, index: true },
  timesheetId: { type: Types.ObjectId, ref: "Timesheet", default: null, index: true },
  registerCode: { type: String, trim: true, uppercase: true, default: "MAIN", maxlength: 80 },
  activeKey: { type: String, default: null },

  status: {
    type: String,
    enum: CASHIER_RECONCILIATION_STATUSES,
    default: "OPEN",
    required: true,
    index: true,
  },

  openedAt: { type: Date, required: true, default: Date.now },
  closedAt: { type: Date, default: null },
  submittedAt: { type: Date, default: null },
  reviewedAt: { type: Date, default: null },
  lockedAt: { type: Date, default: null },

  openingCash: { type: Number, required: true, min: 0, default: 0 },
  actualCash: { type: Number, min: 0, default: null },
  cashSalesAmount: { type: Number, min: 0, default: 0 },
  cashRefundAmount: { type: Number, min: 0, default: 0 },
  movementNetAmount: { type: Number, default: 0 },
  managerAdjustmentAmount: { type: Number, default: 0 },
  expectedCash: { type: Number, default: 0 },
  varianceAmount: { type: Number, default: 0 },
  varianceRate: { type: Number, min: 0, default: 0 },

  attributableToCashier: { type: Boolean, default: false },
  cashierNote: { type: String, trim: true, maxlength: 1000, default: "" },
  reviewNote: { type: String, trim: true, maxlength: 1000, default: "" },
  evidenceAttachments: [{ type: String, trim: true }],

  movements: { type: [CashMovementSchema], default: [] },
  transactionIds: [{ type: Types.ObjectId, ref: "Transaction" }],
  refundIds: [{ type: Types.ObjectId, ref: "PaymentRefund" }],
  calculatedAt: { type: Date, default: null },

  openedBy: { type: Types.ObjectId, ref: "User", required: true },
  submittedBy: { type: Types.ObjectId, ref: "User", default: null },
  reviewedBy: { type: Types.ObjectId, ref: "User", default: null },
  auditTrail: { type: [ReconciliationAuditSchema], default: [] },
});

CashierShiftReconciliationSchema.index(
  { activeKey: 1 },
  { unique: true, sparse: true },
);
CashierShiftReconciliationSchema.index({ restaurantId: 1, cashierId: 1, openedAt: -1 });
CashierShiftReconciliationSchema.index({ restaurantId: 1, status: 1, openedAt: -1 });
CashierShiftReconciliationSchema.index({ cashierId: 1, status: 1, closedAt: -1 });

export default mongoose.models.CashierShiftReconciliation ||
  mongoose.model("CashierShiftReconciliation", CashierShiftReconciliationSchema);
