import mongoose from "mongoose";

const { Schema } = mongoose;

const aiChatbotSafetyRuleSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
  ruleType: { type: String, enum: ["blocked_topic", "required_disclaimer", "handoff_topic", "allowed_scope"], required: true, trim: true },
  pattern: { type: String, required: true, trim: true, maxlength: 300 },
  responseMessage: { type: String, trim: true, maxlength: 1000, default: "" },
  enabled: { type: Boolean, default: true },
  priority: { type: Number, default: 0, min: 0, max: 100 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

aiChatbotSafetyRuleSchema.index({ restaurantId: 1, enabled: 1 });
aiChatbotSafetyRuleSchema.index({ restaurantId: 1, ruleType: 1 });
aiChatbotSafetyRuleSchema.index({ restaurantId: 1, priority: -1 });

export default mongoose.models.AiChatbotSafetyRule || mongoose.model("AiChatbotSafetyRule", aiChatbotSafetyRuleSchema);
