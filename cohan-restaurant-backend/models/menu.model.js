// src/models/Menu.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const menuSchema = BaseSchemaModel({
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
  name: { type: String, default: "Menu", trim: true },
  description: { type: String, trim: true },
  coverImage: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  categoryMenuId: { type: mongoose.Schema.Types.ObjectId, ref: "CategoryMenu" },
});

// timeSlot chỉ là khung phục vụ; một khung giờ có thể có nhiều menu khác nhau.
menuSchema.index({ restaurantId: 1, timeSlot: 1, isActive: 1 });

export const Menu = mongoose.models.Menu || mongoose.model("Menu", menuSchema);
export default Menu;
