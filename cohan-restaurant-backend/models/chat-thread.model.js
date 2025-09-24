import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const MessageSchema = new Schema(
  {
    senderId: { type: Types.ObjectId, ref: "User" },
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },
    content: String,
    attachments: [{ type: Types.ObjectId, ref: "MediaAsset" }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChatThreadSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    participants: [{ type: Types.ObjectId, ref: "User" }],
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },
    channel: {
      type: String,
      enum: ["support", "order", "reservation", "other"],
      default: "support",
    },
    messages: [MessageSchema],
    status: { type: String, enum: ["open", "closed"], default: "open" },
  },
  baseOptions
);

ChatThreadSchema.index({ restaurantId: 1, status: 1, updatedAt: -1 });

export default mongoose.model("ChatThread", ChatThreadSchema);
