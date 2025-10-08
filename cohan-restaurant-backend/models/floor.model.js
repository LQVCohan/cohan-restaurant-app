// src/models/floor.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const FloorSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  level: { type: Number, required: true, index: true }, // tầng 1,2,3...
  description: { type: String },
  planImage: { type: String }, // ảnh sơ đồ tầng (PNG/JPG/SVG)
  isActive: { type: Boolean, default: true },
  meta: {
    width: { type: Number, default: 1920 }, // kích thước canvas FE để quy đổi tọa độ
    height: { type: Number, default: 1080 },
  },
});

// Unique: mỗi nhà hàng 1 level (tầng) duy nhất
FloorSchema.index({ restaurantId: 1, level: 1 }, { unique: true });

export default mongoose.model("Floor", FloorSchema);
