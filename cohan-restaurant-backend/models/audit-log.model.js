import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const AuditLogSchema = new Schema(
  {
    entity: { type: String, required: true },
    entityId: { type: Types.ObjectId, required: true },
    action: {
      type: String,
      enum: ["create", "update", "delete"],
      required: true,
    },
    byUserId: { type: Types.ObjectId, ref: "User" },
    diff: Schema.Types.Mixed,
  },
  baseOptions
);

AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export default mongoose.model("AuditLog", AuditLogSchema);
