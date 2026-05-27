import mongoose, { Schema } from "mongoose";

const AiChatbotEvaluationCaseSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  question: { type: String, required: true, trim: true, maxlength: 500 },
  expectedBehavior: { type: String, trim: true, maxlength: 1000, default: "" },
  category: { type: String, trim: true, maxlength: 80, default: "" },
  tags: { type: [String], default: [] },
  enabled: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

AiChatbotEvaluationCaseSchema.index({ restaurantId: 1, enabled: 1, updatedAt: -1 });

export default mongoose.model("AiChatbotEvaluationCase", AiChatbotEvaluationCaseSchema);
