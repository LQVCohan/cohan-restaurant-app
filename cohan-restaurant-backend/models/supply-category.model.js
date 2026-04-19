import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const SupplyCategorySchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  source: {
    type: String,
    enum: ["manual", "ai", "sync"],
    default: "manual",
  },
  usageCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

SupplyCategorySchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
SupplyCategorySchema.index({ restaurantId: 1, name: 1 });

export default mongoose.model("SupplyCategory", SupplyCategorySchema);
