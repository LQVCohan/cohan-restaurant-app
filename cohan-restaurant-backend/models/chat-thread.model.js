import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const baseOptions = { timestamps: true };

const MessageSchema = new Schema(
  {
    senderId: { type: Types.ObjectId, ref: "User" },
    customerProfileId: { type: Types.ObjectId, ref: "CustomerProfile" },
    senderRole: { type: String },
    senderName: { type: String },
    messageType: { type: String, enum: ["text"], default: "text" },
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
    sourceConversationId: {
      type: Types.ObjectId,
      ref: "AiChatConversation",
      default: null,
    },
    channel: {
      type: String,
      enum: ["support", "order", "reservation", "other"],
      default: "support",
    },
    kind: {
      type: String,
      enum: ["standard", "ai_chatbot_handoff"],
      default: "standard",
    },
    subject: { type: String, default: "" },
    targetRole: { type: String, default: null },
    messages: [MessageSchema],
    status: { type: String, enum: ["open", "closed"], default: "open" },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
    unreadBy: [{ type: Types.ObjectId, ref: "User" }],
  },
  baseOptions
);

ChatThreadSchema.index({ restaurantId: 1, status: 1, updatedAt: -1 });
ChatThreadSchema.index({ restaurantId: 1, kind: 1, status: 1, updatedAt: -1 });
ChatThreadSchema.index({ participants: 1, updatedAt: -1 });
ChatThreadSchema.index(
  { sourceConversationId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      sourceConversationId: { $exists: true, $ne: null },
    },
  },
);

export default mongoose.model("ChatThread", ChatThreadSchema);
