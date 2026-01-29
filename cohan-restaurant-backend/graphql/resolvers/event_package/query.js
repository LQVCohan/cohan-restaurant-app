import mongoose from "mongoose";
import { EventPackage } from "../../../models/index.js";

export const EventPackageQuery = {
  async eventPackagesByRestaurant(_, { restaurantId, activeOnly = true }) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }

    const query = {
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
    };
    if (activeOnly) query.isActive = true;

    return EventPackage.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .lean({ virtuals: true });
  },
};
