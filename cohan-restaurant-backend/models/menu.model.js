// src/models/Menu.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const menuSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  timeSlot: {
    type: String,
    enum: ["breakfast", "lunch", "dinner", "late_night"],
    required: true,
    index: true,
  },
  name: { type: String, default: "Menu", trim: true },
  description: { type: String, trim: true },
  coverImage: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
});

// Mỗi (restaurantId, timeSlot) duy nhất
menuSchema.index({ restaurantId: 1, timeSlot: 1 }, { unique: true });

export const Menu = mongoose.models.Menu || mongoose.model("Menu", menuSchema);
export default Menu;
