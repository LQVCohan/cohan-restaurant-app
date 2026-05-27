import mongoose from "mongoose";

const TRIGGER_TYPES = ["fallback", "low_confidence", "handoff", "no_knowledge_match"];
const STATUSES = ["pending", "approved", "dismissed"];

const suggestionSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    question: { type: String, required: true, trim: true, maxlength: 500 },
    normalizedQuestion: { type: String, trim: true, maxlength: 500, index: true },
    suggestedTitle: { type: String, trim: true, maxlength: 160, default: "" },
    suggestedContent: { type: String, trim: true, maxlength: 3000, default: "" },
    category: { type: String, trim: true, maxlength: 80, default: "" },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    sourceConversationId: { type: mongoose.Schema.Types.ObjectId, ref: "AiChatConversation", default: null },
    sourceMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "AiChatMessage", default: null },
    triggerType: { type: String, enum: TRIGGER_TYPES, required: true },
    confidence: { type: Number, default: null },
    status: { type: String, enum: STATUSES, default: "pending" },
    occurrenceCount: { type: Number, default: 1 },
    lastAskedAt: { type: Date, default: Date.now },
    approvedKnowledgeItemId: { type: mongoose.Schema.Types.ObjectId, ref: "AiChatbotKnowledgeItem", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

suggestionSchema.index({ restaurantId: 1, status: 1 });
suggestionSchema.index({ restaurantId: 1, normalizedQuestion: 1 });
suggestionSchema.index({ restaurantId: 1, lastAskedAt: -1 });
suggestionSchema.index({ restaurantId: 1, occurrenceCount: -1 });

export default mongoose.models.AiChatbotKnowledgeSuggestion || mongoose.model("AiChatbotKnowledgeSuggestion", suggestionSchema);
