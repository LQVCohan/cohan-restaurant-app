import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const menuItemSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  menuId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Menu",
    required: true,
    index: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    index: true,
  },
  sourceType: {
    type: String,
    enum: ["menu", "supply"],
    default: "menu",
    index: true,
  },
  supplyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supply",
    default: null,
    index: true,
  },

  code: { type: String, trim: true, uppercase: true },

  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },

  sortOrder: { type: Number, default: 1000 },
  labels: [{ type: String }],
  foodType: {
    type: String,
    enum: [
      "VEGETARIAN",
      "NON_VEGETARIAN",
      "VEGAN",
      "MIXED",
      "UNKNOWN",
    ],
    default: "UNKNOWN",
    index: true,
  },
  meatTypes: [
    {
      type: String,
      enum: [
        "BEEF",
        "PORK",
        "CHICKEN",
        "DUCK",
        "SEAFOOD",
        "FISH",
        "LAMB",
        "OTHER",
      ],
    },
  ],
  dietTags: [
    {
      type: String,
      enum: ["vegan", "keto", "halal"],
    },
  ],
  allergenTags: [
    {
      type: String,
      enum: ["seafood", "peanut", "milk", "egg", "gluten"],
    },
  ],
  tasteProfile: {
    containsOnion: { type: Boolean, default: false },
    containsCilantro: { type: Boolean, default: false },
    sugar: {
      type: Number,
      enum: [0, 30, 50, 70, 100],
      default: 100,
    },
    spice: {
      type: String,
      enum: ["Không", "Vừa", "Nồng", "Rất cay"],
      default: "Vừa",
    },
  },

  // cache để list món nhanh (sync từ Recipe: min price)
  basePrice: { type: Number, default: 0, min: 0 },

  // cache để FE add món nhanh (sync từ Recipe: variant isDefault)
  defaultServingKey: { type: String, trim: true },

  // optional cache (sync từ Recipe: tồn tại variant BY_WEIGHT)
  hasByWeightVariant: { type: Boolean, default: false },

  taxRate: { type: Number },

  // UI meta
  servingPortion: { type: Number, default: 1 },
  servingUnit: { type: String, default: "người" },

  prepStation: {
    type: String,
    enum: ["kitchen", "bar"],
    required: true,
    default: "kitchen",
  },
  printStationId: { type: mongoose.Schema.Types.ObjectId, ref: "PrintStation" },

  thumbImage: { type: String, trim: true },
  mediaAssetIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" }],

  status: {
    type: String,
    enum: ["available", "unavailable", "out_of_stock", "hidden"],
    default: "available",
    index: true,
  },

  avgPrepTimeMin: { type: Number, default: 10, min: 0 },
  point: { type: Number, default: 0, min: 0 },
  rate: { type: Number, default: 0, min: 0, max: 5, index: true },
  orderCounter: { type: Number, default: 0, min: 0, index: true },

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

menuItemSchema.index(
  { restaurantId: 1, menuId: 1, supplyId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sourceType: "supply",
      supplyId: { $type: "objectId" },
    },
  },
);
menuItemSchema.index({ restaurantId: 1, status: 1, sortOrder: 1 });
menuItemSchema.index({ rate: -1, orderCounter: -1, _id: 1 });
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
