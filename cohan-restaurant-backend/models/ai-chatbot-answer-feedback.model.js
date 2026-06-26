import mongoose from "mongoose";

const { Schema, model } = mongoose;

const schema = new Schema(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "AiChatConversation", default: null },
    messageId: { type: Schema.Types.ObjectId, ref: "AiChatMessage", default: null },
    guestId: { type: String, trim: true, maxlength: 128, default: "" },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    question: { type: String, trim: true, maxlength: 500, default: "" },
    answer: { type: String, trim: true, maxlength: 3000, default: "" },
    rating: { type: String, enum: ["helpful", "not_helpful"], required: true },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    tags: { type: [String], default: [] },
    sourceTypes: { type: [String], default: [] },
    confidence: { type: Number, default: null },
    status: { type: String, enum: ["new", "reviewed", "converted_to_suggestion", "ignored"], default: "new" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ restaurantId: 1, rating: 1 });
schema.index({ restaurantId: 1, status: 1 });
schema.index({ restaurantId: 1, createdAt: -1 });
schema.index({ conversationId: 1, messageId: 1 });

export default model("AiChatbotAnswerFeedback", schema);
