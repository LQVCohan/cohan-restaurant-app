import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;
import BaseSchemaModel from "./baseSchemaModel.js";

const AuditLogSchema = BaseSchemaModel({
  entity: { type: String, required: true },
  entityId: { type: Types.ObjectId, required: true },
  action: {
    type: String,
    enum: ["create", "update", "delete"],
    required: true,
  },
  byUserId: { type: Types.ObjectId, ref: "User" },
  diff: Schema.Types.Mixed,
});

AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", AuditLogSchema);
