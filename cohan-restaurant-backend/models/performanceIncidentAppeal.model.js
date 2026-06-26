import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const APPEAL_STATUS = ["submitted", "under_review", "needs_more_info", "accepted", "rejected", "cancelled"];

const PerformanceIncidentAppealSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    incidentId: { type: Types.ObjectId, ref: "PerformanceIncident", required: true },
    employeeId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    submittedBy: { type: Types.ObjectId, ref: "User", required: true },
    submittedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true, trim: true },
    evidenceNote: { type: String, default: "", trim: true },
    evidenceUrls: [{ type: String, trim: true }],
    status: { type: String, enum: APPEAL_STATUS, default: "submitted", index: true },
    reviewedBy: { type: Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", trim: true },
    decisionReason: { type: String, default: "", trim: true },

    scoreReversalStatus: { type: String, enum: ["not_required", "pending", "reversed", "rejected"], default: "not_required", index: true },
    scoreReversalId: { type: Types.ObjectId, ref: "StaffPerformanceScoreReversal", default: null },
    scoreReversedBy: { type: Types.ObjectId, ref: "User", default: null },
    scoreReversedAt: { type: Date, default: null },
    scoreReversalNote: { type: String, default: "", trim: true },
    scoreReversalDelta: { type: Number, default: 0 },
  },
  { timestamps: true },
);

PerformanceIncidentAppealSchema.index({ restaurantId: 1, employeeId: 1, createdAt: -1 });
PerformanceIncidentAppealSchema.index({ incidentId: 1, status: 1 });
PerformanceIncidentAppealSchema.index(
  { incidentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["submitted", "under_review", "needs_more_info"] } },
  },
);

export default mongoose.models.PerformanceIncidentAppeal || mongoose.model("PerformanceIncidentAppeal", PerformanceIncidentAppealSchema);
