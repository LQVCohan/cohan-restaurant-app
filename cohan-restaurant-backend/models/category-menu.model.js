// src/models/CategoryMenu.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const categoryMenuSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },

  // Tên loại menu: VIP, Ý, Việt, Hải sản, Chay, Buffet...
  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    trim: true,
  },

  // Dùng để sắp xếp các nhóm menu
  order: {
    type: Number,
    default: 0,
  },

  // Bật/tắt
  isActive: {
    type: Boolean,
    default: true,
  },
  coverImage: { type: String, trim: true },
});

// Mỗi nhà hàng có thể có nhiều loại menu,
// nhưng không được trùng tên trong 1 nhà hàng.
categoryMenuSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export const CategoryMenu =
  mongoose.models.CategoryMenu ||
  mongoose.model("CategoryMenu", categoryMenuSchema);

export default CategoryMenu;
