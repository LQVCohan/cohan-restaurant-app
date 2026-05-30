// src/models/ReviewComment.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

const ReactionSummarySchema = new Schema(
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

const ReviewCommentSchema = BaseSchemaModel({
  // Thuộc về review nào
  reviewId: {
    type: Types.ObjectId,
    ref: "Review",
    required: true,
    index: true,
  },

  // Thuộc về nhà hàng nào (để lọc nhanh theo restaurant)
  restaurantId: {
    type: Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },

  // Comment gốc hay reply
  parentId: {
    type: Types.ObjectId,
    ref: "ReviewComment",
    default: null,
    index: true,
  },

  // Tác giả
  authorUserId: {
    type: Types.ObjectId,
    ref: "User",
    default: null,
  },
  authorName: {
    type: String,
    required: true,
  },
  authorAvatar: {
    type: String,
    default: "",
  },
  authorRole: { type: String, default: "customer" },
  authorType: { type: String, enum: ["customer", "staff", "manager", "admin", "system"], default: "customer" },
  officialReply: { type: Boolean, default: false, index: true },
  replyByRestaurantId: { type: Types.ObjectId, ref: "Restaurant", default: null },

  // Nội dung
  content: {
    type: String,
    required: true,
  },

  status: {
    type: String,
    enum: ["published", "pending", "hidden", "deleted"],
    default: "published",
    index: true,
  },

  // Counters
  likesCount: { type: Number, default: 0 },
  repliesCount: { type: Number, default: 0 },

  // Reactions summary như review
  reactions: {
    type: ReactionSummarySchema,
    default: () => ({}),
  },

  isEdited: { type: Boolean, default: false },
});

// Guard khi reload
const ReviewComment =
  mongoose.models.ReviewComment ||
  mongoose.model("ReviewComment", ReviewCommentSchema);

export default ReviewComment;
