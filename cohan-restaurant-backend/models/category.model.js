// src/models/Category.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const categorySchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: false,
  },
  name: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  menuItemCount: { type: Number, default: 0, min: 0 },
});

// Category theo từng nhà hàng (cho phép trùng tên giữa các nhà hàng)
categorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });
categorySchema.index({ restaurantId: 1 });

export const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);
export default Category;
