// src/models/MenuItem.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const menuItemSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  menuId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Menu",
    required: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },

  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  basePrice: { type: Number, default: 0, min: 0 },

  byWeight: { type: Boolean, default: false },

  thumbImage: { type: String, trim: true },
  mediaAssetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" }],
  modifierGroupIds: [
    { type: mongoose.Schema.Types.ObjectId, ref: "ModifierGroup" },
  ],

  status: {
    type: String,
    enum: ["available", "unavailable", "out_of_stock"],
    default: "available",
  },
  avgPrepTimeMin: { type: Number, default: 10, min: 0 },
  point: { type: Number, default: 0, min: 0 },

  notes: { type: String, trim: true },
});

// Tên món duy nhất trong cùng (restaurantId, menuId, categoryId)
menuItemSchema.index(
  { restaurantId: 1, menuId: 1, categoryId: 1, name: 1 },
  { unique: true }
);

/** 🔍 TEXT INDEX cho search món ăn */
menuItemSchema.index({
  name: "text",
  description: "text",
  notes: "text",
});

/* ============================
 * VIRTUAL: recipe (map sang Recipe)
 * ============================ */
menuItemSchema.virtual("recipe", {
  ref: "Recipe",
  localField: "_id",
  foreignField: "menuItemId",
  justOne: true,
});

function autoPopulateRecipe(next) {
  this.populate({
    path: "recipe",
    select: "servingVariants isActive notes",
  });
  next();
}

menuItemSchema.pre("find", autoPopulateRecipe);
menuItemSchema.pre("findOne", autoPopulateRecipe);
menuItemSchema.pre("findOneAndUpdate", autoPopulateRecipe);

export const MenuItem =
  mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema);
export default MenuItem;
