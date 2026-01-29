import mongoose from "mongoose";
import { EventPackage } from "../../../models/index.js";

export const EventPackageMutation = {
  async createEventPackage(_, { input }) {
    const { restaurantId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    const created = await EventPackage.create(input);
    return created.toObject({ virtuals: true });
  },

  async updateEventPackage(_, { input }) {
    const { id, ...payload } = input || {};
    if (!mongoose.isValidObjectId(id)) {
      throw new Error("Invalid event package id");
    }
    const updated = await EventPackage.findByIdAndUpdate(id, payload, {
      new: true,
    }).lean({ virtuals: true });
    if (!updated) throw new Error("Event package not found");
    return updated;
  },
};
