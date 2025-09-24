import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const NotificationSchema = new Schema(
  {
    toUserId: { type: Types.ObjectId, ref: "User" },
    toRole: String,
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    type: { type: String, required: true },
    payload: Schema.Types.Mixed,
    readAt: Date,
  },
  baseOptions
);

NotificationSchema.index({ toUserId: 1, createdAt: -1 });

export default mongoose.model("Notification", NotificationSchema);
