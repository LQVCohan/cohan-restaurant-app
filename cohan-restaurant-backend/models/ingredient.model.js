import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const IngredientSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    name: { type: String, required: true },
    unit: { type: String, required: true },
    safetyStock: { type: Number, default: 0 },
    supplierIds: [{ type: Types.ObjectId, ref: "Supplier" }],
  },
  baseOptions
);

IngredientSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

export default mongoose.model("Ingredient", IngredientSchema);
