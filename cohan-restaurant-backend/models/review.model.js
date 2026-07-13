// src/models/Review.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const ReactionSummarySchema = new mongoose.Schema(
  {
    like: { type: Number, default: 0 },
    love: { type: Number, default: 0 },
    care: { type: Number, default: 0 },
    haha: { type: Number, default: 0 },
    wow: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    angry: { type: Number, default: 0 },
  },
  { _id: false }
);

const ReviewSchema = BaseSchemaModel({
  // Đối tượng được đánh giá (giống "post object" của FB)
  targetType: {
    type: String,
    enum: ["restaurant", "food", "service"],
    required: true,
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  targetName: {
    type: String,
    default: "",
  },

  // Nhà hàng mà review thuộc về
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  restaurantName: {
    type: String,
    default: "",
  },

  // Khách hàng (tương tự author của post/comment)
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerAvatar: {
    type: String,
    default: "",
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  staffName: {
    type: String,
    default: "",
  },

  // Review content
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String, default: "" },
  content: { type: String, required: true },

  images: [{ type: String }],

  // Thông tin thêm
  location: { type: String, default: "" },
  verifiedPurchase: { type: Boolean, default: false },
  verifiedSource: { type: String, enum: ["order", "reservation", "payment", "manual", "none"], default: "none" },
  verifiedSourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  visitedAt: { type: Date, default: null },
  orderCompletedAt: { type: Date, default: null },
  reliabilityScore: { type: Number, min: 0, max: 100, default: 35, index: true },
  reliabilityLevel: { type: String, enum: ["high", "medium", "low"], default: "low", index: true },
  reliabilitySignals: [{ type: String }],
  sentiment: { type: String, enum: ["positive", "neutral", "negative"], default: "neutral", index: true },
  topicTags: [{ type: String }],
  moderationReason: { type: String, default: "" },
  moderationNote: { type: String, default: "" },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  moderatedAt: { type: Date, default: null },
  firstOfficialReplyAt: { type: Date, default: null },
  tags: [{ type: String }],

  // Trạng thái moderation
  status: {
    type: String,
    enum: ["published", "pending", "hidden", "reported", "rejected"],
    default: "pending",
  },

  // Các counter giống FB (không lưu list user, chỉ tổng)
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  helpfulCount: { type: Number, default: 0 },
  reportsCount: { type: Number, default: 0 },

  // Reaction chi tiết như Facebook
  reactions: {
    type: ReactionSummarySchema,
    default: () => ({}),
  },
});

ReviewSchema.pre("validate", function enforceGroundedVerification(next) {
  if (!this.verifiedPurchase) return next();

  const source = String(this.verifiedSource || "none").toLowerCase();
  const evidenceDate = this.orderCompletedAt || this.visitedAt;
  const evidenceTime = evidenceDate ? new Date(evidenceDate).getTime() : NaN;
  const hasTransactionalEvidence =
    ["order", "payment"].includes(source) &&
    Boolean(this.verifiedSourceId) &&
    Number.isFinite(evidenceTime) &&
    evidenceTime <= Date.now() + 5 * 60 * 1000;

  if (!hasTransactionalEvidence) {
    this.verifiedPurchase = false;
    this.verifiedSource = "none";
    this.verifiedSourceId = null;
    this.visitedAt = null;
    this.orderCompletedAt = null;
    this.reliabilityScore = 35;
    this.reliabilityLevel = "low";
    this.reliabilitySignals = ["unverified_experience", "source:none"];
  }

  return next();
});

ReviewSchema.index({ customerId: 1, restaurantId: 1, targetType: 1, targetId: 1, createdAt: -1 });
ReviewSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });

export default mongoose.models.Review || mongoose.model("Review", ReviewSchema);
