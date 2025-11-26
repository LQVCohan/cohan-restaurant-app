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

  // Review content
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String, default: "" },
  content: { type: String, required: true },

  images: [{ type: String }],

  // Thông tin thêm
  location: { type: String, default: "" },
  verifiedPurchase: { type: Boolean, default: false },
  tags: [{ type: String }],

  // Trạng thái moderation
  status: {
    type: String,
    enum: ["published", "pending", "hidden", "reported", "rejected"],
    default: "published",
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

export default mongoose.model("Review", ReviewSchema);
