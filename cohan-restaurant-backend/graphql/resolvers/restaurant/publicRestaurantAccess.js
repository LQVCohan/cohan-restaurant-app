import mongoose from "mongoose";
import { Restaurant } from "../../../models/index.js";

export function buildPublicRestaurantFilter(extra = {}) {
  return {
    ...extra,
    $or: [
      { businessStatus: "active", publicationStatus: "published" },
      {
        businessStatus: { $exists: false },
        publicationStatus: { $exists: false },
        status: "active",
      },
    ],
  };
}

export async function loadPublicRestaurantsByRecentIds(refRestaurants = [], limit = 12) {
  const ids = [...new Set((refRestaurants || [])
    .map((x) => (mongoose.isValidObjectId(x) ? String(x) : null))
    .filter(Boolean))].slice(0, 12);
  if (!ids.length) return [];
  const restaurants = await Restaurant.find(buildPublicRestaurantFilter({
    _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
  })).lean();
  const byId = new Map(restaurants.map((item) => [String(item._id), item]));
  return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, Math.max(1, Math.min(Number(limit) || 12, 12)));
}
