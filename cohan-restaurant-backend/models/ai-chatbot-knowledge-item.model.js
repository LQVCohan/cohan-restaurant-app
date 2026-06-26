import mongoose from "mongoose";

const SOURCE_TYPES = ["manual", "faq", "policy", "suggestion"];

const knowledgeSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, required: true, trim: true, maxlength: 3000 },
    category: { type: String, trim: true, maxlength: 80, default: "" },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
    sourceType: { type: String, enum: SOURCE_TYPES, default: "manual" },
    embedding: [{ type: Number }],
    embeddingModel: { type: String, trim: true, maxlength: 80, default: "" },
    embeddingUpdatedAt: { type: Date, default: null },
    embeddingContentHash: { type: String, trim: true, maxlength: 128, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

knowledgeSchema.index({ restaurantId: 1, enabled: 1 });
knowledgeSchema.index({ restaurantId: 1, category: 1 });
knowledgeSchema.index({ restaurantId: 1, priority: -1 });
knowledgeSchema.index({ restaurantId: 1, enabled: 1, embeddingModel: 1 });
knowledgeSchema.index({ title: "text", content: "text", tags: "text" });

export default mongoose.models.AiChatbotKnowledgeItem || mongoose.model("AiChatbotKnowledgeItem", knowledgeSchema);
