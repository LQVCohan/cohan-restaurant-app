import { User, Table, Category, Review, Brand, BrandMembership } from "../../../models/index.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";

export default {
  Restaurant: {
    id: (p) => p.id ?? String(p._id),
    manager: async (parent) => {
      const restaurantId = parent.id || parent._id;
      if (!restaurantId || !parent.brandId || typeof BrandMembership?.findOne !== "function") return null;
      const membership = await BrandMembership.findOne({
        brandId: parent.brandId,
        status: "active",
        role: "manager",
        restaurantIds: restaurantId,
      }).select("userId").lean();
      return membership?.userId ? User.findById(membership.userId).lean() : null;
    },
    brandId: (parent) => parent.brandId ? String(parent.brandId) : null,
    brand: (parent) => parent.brandId ? Brand.findById(parent.brandId).lean() : null,
    tables: (parent) => Table.find({ restaurantId: parent.id || parent._id }).lean(),
    categories: (parent) => Category.find({ restaurantId: parent.id || parent._id }).lean(),
    reviewCount: async (parent) => {
      if (typeof parent.reviewCount === "number") return parent.reviewCount;
      return Review.countDocuments({ targetType: "restaurant", targetId: String(parent._id || parent.id), status: "published" });
    },
    ...Object.fromEntries(
      [
        "businessStatus",
        "publicationStatus",
        "operationalStatus",
        "openingStatus",
        "openingStatusReason",
        "nextOpeningTime",
        "canView",
        "canReserve",
        "canOrder",
        "canTableOrder",
        "canDelivery",
        "canPickup",
      ].map((key) => [
        key,
        (parent) =>
          parent?._availabilityAt?.[key] ??
          computeRestaurantAvailability(parent)[key],
      ]),
    ),
  },
  RestaurantCategoryIndex: {
    id: (parent) => parent.id ?? String(parent._id),
  },
};
