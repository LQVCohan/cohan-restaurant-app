import mongoose from "mongoose";
import Floor from "../../../models/floor.model.js";

export default {
  floors: async (_parent, { restaurantId }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    return Floor.find({ restaurantId })
      .sort({ level: 1 })
      .lean({ virtuals: true });
  },

  floorByLevel: async (_p, { restaurantId, level }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;
    return Floor.findOne({ restaurantId, level }).lean({ virtuals: true });
  },
};
