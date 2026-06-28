import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const NotificationSchema = new Schema(
  {
    toUserId: { type: Types.ObjectId, ref: "User" },
    toRole: String,
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    type: { type: String, required: true },
    uniqueKey: String,
    payload: Schema.Types.Mixed,
    readAt: Date,
    dismissedByUserIds: [{ type: Types.ObjectId, ref: "User" }],
  },
  baseOptions
);

NotificationSchema.index({ toUserId: 1, createdAt: -1 });
NotificationSchema.index({ toUserId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ toRole: 1, restaurantId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ dismissedByUserIds: 1 });
NotificationSchema.index({ uniqueKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("Notification", NotificationSchema);
