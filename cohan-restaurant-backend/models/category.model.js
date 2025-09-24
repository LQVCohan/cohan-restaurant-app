import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const CategorySchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    name: { type: String, required: true },
    parentId: { type: Types.ObjectId, ref: "Category" },
    order: { type: Number, default: 0 },
  },
  baseOptions
);

CategorySchema.index(
  { restaurantId: 1, name: 1 },
  { unique: true, partialFilterExpression: { restaurantId: { $exists: true } } }
);

export default mongoose.model("Category", CategorySchema);
