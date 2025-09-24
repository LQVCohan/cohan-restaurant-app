import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const LiveSessionSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    staffId: { type: Types.ObjectId, ref: "User" },
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },
    channel: String,
    status: {
      type: String,
      enum: ["initiated", "ongoing", "ended", "failed"],
      default: "initiated",
    },
    startedAt: Date,
    endedAt: Date,
  },
  baseOptions
);

export default mongoose.model("LiveSession", LiveSessionSchema);
