import mongoose from "mongoose";
import { EventPackage } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

export const EventPackageMutation = {
  async createEventPackage(_, { input }, ctx) {
    const { restaurantId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    await requireRestaurantAccess(ctx, restaurantId);
    const created = await EventPackage.create(input);
    return created.toObject({ virtuals: true });
  },

  async updateEventPackage(_, { input }, ctx) {
    const { id, ...payload } = input || {};
    if (!mongoose.isValidObjectId(id)) {
      throw new Error("Invalid event package id");
    }
    const existing = await EventPackage.findById(id).select({ restaurantId: 1 }).lean();
    if (!existing) throw new Error("Event package not found");
    await requireRestaurantAccess(ctx, existing.restaurantId);
    delete payload.restaurantId;
    const updated = await EventPackage.findByIdAndUpdate(id, payload, {
      new: true,
    }).lean({ virtuals: true });
    if (!updated) throw new Error("Event package not found");
    return updated;
  },
};
