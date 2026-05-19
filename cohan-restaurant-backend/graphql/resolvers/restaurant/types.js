import { User, Table, Category, Review } from "../../../models/index.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";

export default {
  Restaurant: {
    id: (p) => p.id ?? String(p._id),
    manager: (parent) => {
      if (!parent.managerId) return null;
      return User.findById(parent.managerId).lean();
    },
    tables: (parent) => Table.find({ restaurantId: parent.id || parent._id }).lean(),
    categories: (parent) => Category.find({ restaurantId: parent.id || parent._id }).lean(),
    reviewCount: async (parent) => {
      if (typeof parent.reviewCount === "number") return parent.reviewCount;
      return Review.countDocuments({ targetType: "restaurant", targetId: String(parent._id || parent.id), status: "published" });
    },
    ...Object.fromEntries(["businessStatus","publicationStatus","operationalStatus","openingStatus","openingStatusReason","nextOpeningTime","canView","canReserve","canOrder","canTableOrder","canDelivery","canPickup"].map((k)=>[k,(p)=>computeRestaurantAvailability(p)[k]])),
  },
};
