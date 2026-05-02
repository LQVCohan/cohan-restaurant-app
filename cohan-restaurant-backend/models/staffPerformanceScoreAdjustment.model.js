import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const StaffPerformanceScoreAdjustmentSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
    employeeId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    incidentId: { type: Types.ObjectId, ref: "PerformanceIncident", required: true, unique: true, index: true },
    sourceType: { type: String, default: "performance_incident", index: true },
    scoreDelta: { type: Number, required: true },
    previousScore: { type: Number, required: true },
    newScore: { type: Number, required: true },
    appliedBy: { type: Types.ObjectId, ref: "User", required: true },
    appliedAt: { type: Date, required: true },
    reason: { type: String, default: "" },
    note: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export default mongoose.models.StaffPerformanceScoreAdjustment || mongoose.model("StaffPerformanceScoreAdjustment", StaffPerformanceScoreAdjustmentSchema);
