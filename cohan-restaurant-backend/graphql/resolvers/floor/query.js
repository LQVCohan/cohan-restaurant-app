import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { requireRestaurantAccess } from "../../guards.js";
import Floor from "../../../models/floor.model.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";

const getRestaurantModel = async () => {
  const module = await import("../../../models/restaurant.model.js");
  return module.default || module.Restaurant;
};

async function requirePublicRestaurant(restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new GraphQLError("Invalid restaurantId", { extensions: { code: "BAD_USER_INPUT" } });
  }

  const Restaurant = await getRestaurantModel();
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    businessStatus: "active",
    publicationStatus: "published",
  }).lean();

  if (!restaurant) {
    throw new GraphQLError("Restaurant is not public", { extensions: { code: "NOT_FOUND" } });
  }

  const availability = computeRestaurantAvailability(restaurant || {});
  if (availability.canView === false) {
    throw new GraphQLError("Restaurant is not available for public viewing", {
      extensions: { code: "RESTAURANT_NOT_VIEWABLE" },
    });
  }

  return restaurant;
}

export default {
  // Lấy danh sách tất cả tầng của nhà hàng
  floors: async (_parent, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    await requireRestaurantAccess(ctx, restaurantId);

    // Trả về danh sách tầng (kèm theo layout nếu cần)
    return Floor.find({ restaurantId })
      .sort({ level: 1 })
      .lean({ virtuals: true });
  },

  publicFloors: async (_parent, { restaurantId }) => {
    await requirePublicRestaurant(restaurantId);
    return Floor.find({ restaurantId, isActive: { $ne: false } })
      .sort({ level: 1 })
      .lean({ virtuals: true });
  },

  // Lấy tầng theo level (Tầng 1, Tầng 2...)
  floorByLevel: async (_p, { restaurantId, level }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;

    await requireRestaurantAccess(ctx, restaurantId);

    return Floor.findOne({ restaurantId, level }).lean({ virtuals: true });
  },

  // ✅ BỔ SUNG: Lấy chi tiết tầng theo ID (Dùng cho trang Designer để load data)
  floor: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return null;

    const existing = await Floor.findById(id)
      .select({ restaurantId: 1 })
      .lean();
    if (!existing) return null;

    await requireRestaurantAccess(ctx, existing.restaurantId);

    return Floor.findById(id).lean({ virtuals: true });
  },
};
