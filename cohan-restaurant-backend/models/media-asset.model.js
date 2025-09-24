import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const MediaAssetSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    url: { type: String, required: true },
    type: {
      type: String,
      enum: ["image", "video", "vr", "other"],
      default: "image",
    },
    ownerRef: {
      kind: String,
      itemId: { type: Types.ObjectId },
    },
    meta: Schema.Types.Mixed,
  },
  baseOptions
);

export default mongoose.model("MediaAsset", MediaAssetSchema);
