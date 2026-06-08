import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

const SupplierPayableAuditSchema = new Schema(
  {
    action: { type: String, required: true },
    actorId: { type: Types.ObjectId, ref: "User" },
    previousStatus: String,
    nextStatus: String,
    amount: Number,
    note: String,
    reason: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const SupplierPayableSchema = BaseSchemaModel({
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
  supplierName: { type: String, required: true },
  supplierId: { type: Types.ObjectId, ref: "Supplier" },
  sourceKind: { type: String, enum: ["inventory", "manual", "supplier_invoice", "other"], default: "manual", index: true },
  sourceId: { type: Types.ObjectId },
  amount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  remainingAmount: { type: Number, default: 0, min: 0 },
  dueDate: { type: Date, index: true },
  status: { type: String, enum: ["unpaid", "partial", "paid", "overdue", "voided"], default: "unpaid", index: true },
  note: String,
  createdBy: { type: Types.ObjectId, ref: "User" },
  paidBy: { type: Types.ObjectId, ref: "User" },
  paidAt: Date,
  cashflowIds: [{ type: Types.ObjectId, ref: "Cashflow" }],
  auditTrail: { type: [SupplierPayableAuditSchema], default: [] },
});

SupplierPayableSchema.pre("validate", function fillRemainingAndStatus(next) {
  const amount = Number(this.amount || 0);
  const paidAmount = Number(this.paidAmount || 0);
  this.remainingAmount = Math.max(amount - paidAmount, 0);
  if (this.status !== "voided") {
    if (this.remainingAmount <= 0) this.status = "paid";
    else if (paidAmount > 0) this.status = "partial";
    else this.status = this.dueDate && new Date(this.dueDate).getTime() < Date.now() ? "overdue" : "unpaid";
  }
  next();
});

SupplierPayableSchema.index({ restaurantId: 1, status: 1, dueDate: 1 });
SupplierPayableSchema.index({ restaurantId: 1, supplierId: 1 });

export default mongoose.models.SupplierPayable ||
  mongoose.model("SupplierPayable", SupplierPayableSchema);
