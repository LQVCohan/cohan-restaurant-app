import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const StockMovementSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    ingredientId: { type: Types.ObjectId, ref: "Ingredient", required: true },
    type: { type: String, enum: ["IN", "OUT", "ADJ"], required: true },
    qty: { type: Number, required: true },
    unit: String,
    refOrderId: { type: Types.ObjectId, ref: "Order" },
    note: String,
    byUserId: { type: Types.ObjectId, ref: "User" },
  },
  baseOptions
);

StockMovementSchema.index({ restaurantId: 1, ingredientId: 1, createdAt: -1 });

export default mongoose.model("StockMovement", StockMovementSchema);
