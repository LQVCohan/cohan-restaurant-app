import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const RecommendationItemSchema = new Schema(
  {
    itemId: { type: Types.ObjectId, ref: "MenuItem" },
    score: Number,
  },
  { _id: false }
);

const RecommendationSchema = new Schema(
  {
    key: { type: String, required: true },
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    items: [RecommendationItemSchema],
    modelVersion: String,
    expiresAt: Date,
  },
  baseOptions
);

RecommendationSchema.index(
  { key: 1, restaurantId: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model("Recommendation", RecommendationSchema);
