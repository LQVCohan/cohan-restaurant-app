import mongoose from "mongoose";
const { Schema, Types } = mongoose;
import BaseSchemaModel from "./baseSchemaModel.js";

const AuditLogSchema = BaseSchemaModel({
  entity: { type: String, index: true },
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", index: true },
  entityId: { type: Types.ObjectId, index: true },
  action: { type: String, required: true, index: true },
  byUserId: { type: Types.ObjectId, ref: "User", index: true },
  diff: Schema.Types.Mixed,
  actorId: { type: Types.ObjectId, ref: "User", index: true },
  actorName: { type: String },
  actorRole: { type: String },
  module: { type: String, index: true },
  targetType: { type: String, index: true },
  targetId: { type: Types.ObjectId, index: true },
  targetName: { type: String },
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  metadata: Schema.Types.Mixed,
  ipAddress: { type: String },
  userAgent: { type: String },
});

AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
AuditLogSchema.index({ restaurantId: 1, createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ byUserId: 1, createdAt: -1 });
AuditLogSchema.index({
  restaurantId: 1,
  module: 1,
  entityId: 1,
  "metadata.status": 1,
  createdAt: -1,
});

AuditLogSchema.pre("validate", function fillCompatFields(next) {
  if (!this.entity && this.targetType) this.entity = this.targetType;
  if (!this.entityId && this.targetId) this.entityId = this.targetId;
  if (!this.targetType && this.entity) this.targetType = this.entity;
  if (!this.targetId && this.entityId) this.targetId = this.entityId;
  if (!this.byUserId && this.actorId) this.byUserId = this.actorId;
  if (!this.actorId && this.byUserId) this.actorId = this.byUserId;
  if (!this.diff && (this.before !== undefined || this.after !== undefined)) {
    this.diff = { before: this.before ?? null, after: this.after ?? null };
  }
  next();
});

export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
