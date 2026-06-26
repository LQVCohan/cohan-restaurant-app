import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const restaurantCategoryIndexSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  timeSlot: {
    type: String,
    enum: ["breakfast", "lunch", "dinner", "late_night"],
    required: true,
    index: true,
  },
  categoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    index: true,
  }],
  categories: [
    {
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
      },
      menuItemCount: { type: Number, default: 0, min: 0 },
    },
  ],
  distinctCategoryCount: { type: Number, default: 0, min: 0 },
  orderCount: { type: Number, default: 0, min: 0 },
  reservationCount: { type: Number, default: 0, min: 0 },
  tableParticipationCount: { type: Number, default: 0, min: 0 },
});

restaurantCategoryIndexSchema.index({ restaurantId: 1, timeSlot: 1 }, { unique: true });
restaurantCategoryIndexSchema.index({ timeSlot: 1, categoryIds: 1 });
restaurantCategoryIndexSchema.index({ timeSlot: 1, distinctCategoryCount: -1 });

export const RestaurantCategoryIndex =
  mongoose.models.RestaurantCategoryIndex ||
  mongoose.model("RestaurantCategoryIndex", restaurantCategoryIndexSchema);

export default RestaurantCategoryIndex;
