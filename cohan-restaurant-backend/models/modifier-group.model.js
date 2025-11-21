// src/models/ModifierGroup.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

/* ------------ IngredientSchema giống recipe.model.js ------------ */
const IngredientSchema = new mongoose.Schema(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    quantify: { type: Number, default: 1 },
    wastePct: { type: Number, default: 0 }, // % hao hụt 0..100
  },
  { _id: true }
);

/* ------------ Recipe cho từng ModifierOption ------------ */
const ModifierOptionRecipeSchema = new mongoose.Schema(
  {
    // Danh sách nguyên liệu cấu thành option (VD: Cơm thêm -> gạo, nước...)
    Ingredients: { type: [IngredientSchema], default: [] },
    yieldQty: { type: Number, default: 1 }, // sản lượng (1 option)
    yieldUnit: { type: String, default: "portion" }, // "portion", "g", "ml", ...
    notes: { type: String },
  },
  { _id: false }
);

/* ------------ Option ------------ */
const ModifierOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // “Cơm thêm”, “Rau thêm”, “Không hành”
    priceDelta: { type: Number, required: true, default: 0 }, // cộng/trừ tiền (âm được)
    isDefault: { type: Boolean, default: false },

    // ✅ Recipe riêng cho từng option
    recipe: { type: ModifierOptionRecipeSchema, default: undefined },
  },
  { _id: true } // cần _id để chọn option
);

// Virtual id cho FE
ModifierOptionSchema.virtual("id").get(function () {
  return this._id ? String(this._id) : null;
});

/* ------------ ModifierGroup ------------ */
const modifierGroupSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  name: { type: String, required: true, trim: true }, // “Tuỳ chọn thêm”, “Tuỳ chọn gia giảm”, ...
  selectionType: {
    type: String,
    enum: ["single", "multiple"],
    default: "multiple",
  },
  required: { type: Boolean, default: false }, // nếu true và single => bắt buộc chọn 1
  appliesTo: { type: String, enum: ["item"], default: "item" },

  options: [ModifierOptionSchema],
  isActive: { type: Boolean, default: true },
});

modifierGroupSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export const ModifierGroup =
  mongoose.models.ModifierGroup ||
  mongoose.model("ModifierGroup", modifierGroupSchema);
export default ModifierGroup;
