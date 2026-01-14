import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { PrintSetting, Restaurant } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

function notFound(message = "Resource not found") {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

async function assertRestaurantAccess(user, restaurantId) {
  requireRole(user, ["admin", "manager"]);
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw badInput("Invalid restaurantId");
  }
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) throw notFound("Restaurant not found");
  return restaurant;
}

export const Query = {
  async printSettings(_, { restaurantId }, { user }) {
    await assertRestaurantAccess(user, restaurantId);
    const doc = await PrintSetting.findOne({ restaurantId }).lean();
    return doc ? { id: String(doc._id), ...doc } : null;
  },
};

export const Mutation = {
  async upsertPrintSettings(_, { input }, { user }) {
    const { restaurantId, printers = [], stations = {} } = input || {};
    await assertRestaurantAccess(user, restaurantId);
    const doc = await PrintSetting.findOneAndUpdate(
      { restaurantId },
      {
        $set: {
          restaurantId,
          printers,
          stations,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return { id: String(doc._id), ...doc };
  },
};
