import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const RecipeLineSchema = new Schema(
  {
    ingredientId: { type: Types.ObjectId, ref: "Ingredient", required: true },
    qtyPerPortion: { type: Number, required: true },
    unit: String,
  },
  { _id: false }
);

const RecipeSchema = new Schema(
  {
    menuItemId: { type: Types.ObjectId, ref: "MenuItem", required: true },
    lines: [RecipeLineSchema],
  },
  baseOptions
);

RecipeSchema.index({ menuItemId: 1 }, { unique: true });

export default mongoose.model("Recipe", RecipeSchema);
