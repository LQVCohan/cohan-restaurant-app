import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const AiChatMessageSchema = new Schema(
  {
    conversationId: { type: Types.ObjectId, ref: "AiChatConversation", required: true, index: true },
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", index: true, default: null },
    userId: { type: Types.ObjectId, ref: "User", index: true, default: null },
    guestId: { type: String, index: true, default: null },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    intent: { type: String, default: "" },
    confidence: { type: Number, default: null },
    isFallback: { type: Boolean, default: false },
    quickReplies: [{ type: String }],
    actions: [{ type: Schema.Types.Mixed }],
    sources: [{ type: Schema.Types.Mixed }],
    contextSummary: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

AiChatMessageSchema.index({ conversationId: 1, createdAt: 1 });
AiChatMessageSchema.index({ userId: 1, createdAt: -1 });
AiChatMessageSchema.index({ guestId: 1, createdAt: -1 });
AiChatMessageSchema.index({ restaurantId: 1, createdAt: -1 });

export default mongoose.model("AiChatMessage", AiChatMessageSchema);
