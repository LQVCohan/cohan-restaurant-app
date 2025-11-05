// src/models/MenuItem.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const PreparationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // “Nướng”, “Chiên”, …
    price: { type: Number, required: true, min: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

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
  preparationMethods: [PreparationSchema], // >=1 hoặc basePrice > 0
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

menuItemSchema.pre("validate", function (next) {
  const hasPrep =
    Array.isArray(this.preparationMethods) &&
    this.preparationMethods.length > 0;
  const hasAnyPrice =
    (this.basePrice && this.basePrice > 0) ||
    (hasPrep &&
      this.preparationMethods.some(
        (p) => typeof p.price === "number" && p.price >= 0
      ));
  if (!hasAnyPrice)
    return next(
      new Error(
        "MenuItem needs a basePrice > 0 or at least one preparation with price."
      )
    );

  if (hasPrep) {
    const defaults = this.preparationMethods.filter((p) => !!p.isDefault);
    if (defaults.length > 1)
      return next(
        new Error("Only one preparation method can be isDefault=true.")
      );
  }
  next();
});

export const MenuItem =
  mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema);
export default MenuItem;
