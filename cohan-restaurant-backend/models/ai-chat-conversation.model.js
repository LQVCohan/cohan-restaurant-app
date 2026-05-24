import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const AiChatConversationSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", index: true, default: null },
    userId: { type: Types.ObjectId, ref: "User", index: true, default: null },
    guestId: { type: String, index: true, default: null },
    channel: { type: String, default: "web_widget" },
    status: {
      type: String,
      enum: ["open", "closed", "handoff_requested"],
      default: "open",
      index: true,
    },
    title: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, default: "" },
    messageCount: { type: Number, default: 0 },
    lastIntent: { type: String, default: "" },
    source: { type: String, default: "ai_chatbot" },
    chatThreadId: { type: Types.ObjectId, ref: "ChatThread", index: true, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

AiChatConversationSchema.index({ userId: 1, restaurantId: 1, status: 1, updatedAt: -1 });
AiChatConversationSchema.index({ guestId: 1, restaurantId: 1, status: 1, updatedAt: -1 });
AiChatConversationSchema.index({ restaurantId: 1, updatedAt: -1 });

export default mongoose.model("AiChatConversation", AiChatConversationSchema);
