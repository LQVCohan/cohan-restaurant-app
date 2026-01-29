import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const EventPackageItemSchema = new mongoose.Schema(
  {
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    menuId: { type: mongoose.Schema.Types.ObjectId, ref: "Menu" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    image: { type: String, trim: true },
    servingKey: { type: String, required: true, trim: true },
    unitPrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 1 },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const EventPackageSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  promotionId: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion" },
  promotionCode: { type: String, trim: true },
  price: { type: Number, default: 0 },
  items: { type: [EventPackageItemSchema], default: [] },
  isActive: { type: Boolean, default: true },
});

EventPackageSchema.index({ restaurantId: 1, isActive: 1 });

export default mongoose.model("EventPackage", EventPackageSchema);
