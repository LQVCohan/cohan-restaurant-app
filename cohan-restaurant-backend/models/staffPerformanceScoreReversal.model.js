import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const StaffPerformanceScoreReversalSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    incidentId: { type: Types.ObjectId, ref: "PerformanceIncident", required: true, index: true },
    appealId: { type: Types.ObjectId, ref: "PerformanceIncidentAppeal", required: true, unique: true, index: true },
    originalAdjustmentId: { type: Types.ObjectId, ref: "StaffPerformanceScoreAdjustment", required: true, index: true },
    reversalDelta: { type: Number, required: true, min: 0 },
    previousScore: { type: Number, required: true },
    newScore: { type: Number, required: true },
    reversedBy: { type: Types.ObjectId, ref: "User", required: true },
    reversedAt: { type: Date, required: true },
    reason: { type: String, default: "" },
    note: { type: String, default: "", trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.models.StaffPerformanceScoreReversal || mongoose.model("StaffPerformanceScoreReversal", StaffPerformanceScoreReversalSchema);
