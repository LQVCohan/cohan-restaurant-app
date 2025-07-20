import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  type: { type: String, enum: ["ingredient", "supply"], required: true },
  unit: { type: String, default: "unit" },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  lastUpdated: { type: Date, default: Date.now },
});

export default mongoose.model("Inventory", inventorySchema);
