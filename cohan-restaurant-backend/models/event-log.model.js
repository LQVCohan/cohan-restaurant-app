import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const EventLogSchema = new Schema(
  {
    actorUserId: { type: Types.ObjectId, ref: "User" },
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },
    verb: { type: String, required: true },
    object: {
      kind: String,
      id: { type: Types.ObjectId },
    },
    meta: Schema.Types.Mixed,
    at: { type: Date, default: Date.now },
  },
  baseOptions
);

EventLogSchema.index({ verb: 1, at: -1 });

export default mongoose.model("EventLog", EventLogSchema);
