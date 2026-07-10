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

const comparable = (value) => JSON.stringify(value ?? null);

export function isMeaningfulAuditPayload(payload = {}) {
  if (String(payload?.action || "").toLowerCase() !== "update") return true;

  const diff = payload?.diff || {
    before: payload?.before,
    after: payload?.after,
  };
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return false;

  if (Object.prototype.hasOwnProperty.call(diff, "field")) {
    return comparable(diff.before) !== comparable(diff.after);
  }

  if (
    Object.prototype.hasOwnProperty.call(diff, "before") ||
    Object.prototype.hasOwnProperty.call(diff, "after")
  ) {
    const before = diff.before;
    const after = diff.after;
    if (
      !before ||
      !after ||
      typeof before !== "object" ||
      typeof after !== "object" ||
      Array.isArray(before) ||
      Array.isArray(after)
    ) {
      return comparable(before) !== comparable(after);
    }

    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].some(
      (key) => comparable(before[key]) !== comparable(after[key]),
    );
  }

  return Object.keys(diff).some((key) => key !== "type");
}

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

const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
const originalCreate = AuditLog.create.bind(AuditLog);

AuditLog.create = function createMeaningfulAuditLogs(docs, ...args) {
  const isBatch = Array.isArray(docs);
  const meaningfulDocs = (isBatch ? docs : [docs]).filter(
    isMeaningfulAuditPayload,
  );

  if (!meaningfulDocs.length) return Promise.resolve(isBatch ? [] : null);
  return originalCreate(isBatch ? meaningfulDocs : meaningfulDocs[0], ...args);
};

export default AuditLog;
