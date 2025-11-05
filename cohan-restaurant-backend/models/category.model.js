// src/models/Category.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const categorySchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  timeSlot: {
    type: String,
    enum: ["breakfast", "lunch", "dinner", "late_night"],
    required: true,
  },
  name: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

// Tên category duy nhất trong cùng (restaurantId, timeSlot)
categorySchema.index({ restaurantId: 1, timeSlot: 1 }, { unique: true });

export const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);
export default Category;
