import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const WarehouseSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  address: { type: String },
  isActive: { type: Boolean, default: true, index: true },
});
WarehouseSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export default mongoose.model("Warehouse", WarehouseSchema);
