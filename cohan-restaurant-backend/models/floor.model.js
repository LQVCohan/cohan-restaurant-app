import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const FloorSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  name: { type: String, required: true, trim: true },
  level: { type: Number, required: true }, // tầng 1,2,3...
  description: { type: String },
  planImage: { type: String }, // ảnh sơ đồ tầng (nếu dùng ảnh nền tĩnh)
  isActive: { type: Boolean, default: true },

  layout: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },

  meta: {
    width: { type: Number, default: 2000 }, // Kích thước canvas mặc định
    height: { type: Number, default: 2000 },
  },
});

// Unique: mỗi nhà hàng 1 level (tầng) duy nhất
FloorSchema.index({ restaurantId: 1, level: 1 }, { unique: true });

export default mongoose.model("Floor", FloorSchema);
