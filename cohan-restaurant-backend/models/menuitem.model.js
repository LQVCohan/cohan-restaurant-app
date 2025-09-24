import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const PriceSetSchema = new Schema(
  {
    label: String,
    price: { type: Number, required: true },
  },
  { _id: false }
);

const MenuItemSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    categoryId: { type: Types.ObjectId, ref: "Category", required: true },
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    priceSet: [PriceSetSchema],
    mediaAssetIds: [{ type: Types.ObjectId, ref: "MediaAsset" }],
    modifierGroupIds: [{ type: Types.ObjectId, ref: "ModifierGroup" }],
    isAvailable: { type: Boolean, default: true },
  },
  baseOptions
);

MenuItemSchema.index({ restaurantId: 1, name: 1 });

export default mongoose.model("MenuItem", MenuItemSchema);
