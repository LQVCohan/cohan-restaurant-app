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

  code: { type: String, trim: true, uppercase: true },

  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  sortOrder: { type: Number, default: 1000 },

  labels: [{ type: String }],

  basePrice: { type: Number, default: 0, min: 0 },

  taxRate: { type: Number },

  servingPortion: { type: Number, default: 1 },
  servingUnit: { type: String, default: "người" },

  printStationId: { type: mongoose.Schema.Types.ObjectId, ref: "PrintStation" },

  byWeight: { type: Boolean, default: false },

  thumbImage: { type: String, trim: true },
  mediaAssetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" }],

  modifierGroupIds: [
    { type: mongoose.Schema.Types.ObjectId, ref: "ModifierGroup" },
  ],

  status: {
    type: String,
    enum: ["available", "unavailable", "out_of_stock", "hidden"],
    default: "available",
  },

  avgPrepTimeMin: { type: Number, default: 10, min: 0 },
  point: { type: Number, default: 0, min: 0 },

  notes: { type: String, trim: true },
});

menuItemSchema.index(
  { restaurantId: 1, menuId: 1, categoryId: 1, name: 1 },
  { unique: true }
);

menuItemSchema.index(
  { restaurantId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $exists: true, $ne: "" } },
  }
);

menuItemSchema.index({ restaurantId: 1, sortOrder: 1 });

menuItemSchema.index({
  name: "text",
  code: "text",
  description: "text",
  labels: "text",
});

menuItemSchema.virtual("recipe", {
  ref: "Recipe",
  localField: "_id",
  foreignField: "menuItemId",
  justOne: true,
});

export const MenuItem =
  mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema);
export default MenuItem;
