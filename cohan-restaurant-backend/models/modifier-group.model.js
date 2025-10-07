// src/models/ModifierGroup.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const ModifierOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // “Cơm thêm”, “Rau thêm”, “Không hành”
    priceDelta: { type: Number, required: true, default: 0 }, // cộng/trừ tiền (âm được)
    isDefault: { type: Boolean, default: false },
  },
  { _id: true } // cần _id để chọn option
);
ModifierOptionSchema.virtual("id").get(function () {
  return this._id ? String(this._id) : null;
});
const modifierGroupSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true }, // “Tuỳ chọn thêm”, “Tuỳ chọn gia giảm”, ...
  selectionType: {
    type: String,
    enum: ["single", "multiple"],
    default: "multiple",
  },
  required: { type: Boolean, default: false }, // nếu true và single => bắt buộc chọn 1
  appliesTo: { type: String, enum: ["item", "preparation"], default: "item" },

  options: [ModifierOptionSchema],
  isActive: { type: Boolean, default: true },
});

modifierGroupSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export const ModifierGroup =
  mongoose.models.ModifierGroup ||
  mongoose.model("ModifierGroup", modifierGroupSchema);
export default ModifierGroup;
