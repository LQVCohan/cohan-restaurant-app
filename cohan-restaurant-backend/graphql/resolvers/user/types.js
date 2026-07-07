// src/graphql/resolvers/types/User.js
import { Role, User } from "../../../models/index.js";
import { loadPublicRestaurantsByRecentIds } from "../restaurant/publicRestaurantAccess.js";

export default {
  User: {
    id: (p) => p.id ?? String(p._id),
    role: async (parent) => {
      if (parent.role && typeof parent.role === "object") return parent.role;
      if (parent.role) {
        return Role.findById(parent.role).lean();
      }
      return null;
    },
    roleName: (parent) =>
      (parent.role?.slug || parent.role?.name || "").toLowerCase() || null,

    refRestaurants: (parent) => {
      if (String(parent.userType || "").toUpperCase() !== "CUSTOMER" || !parent.refRestaurants?.length) return [];
      return loadPublicRestaurantsByRecentIds(parent.refRestaurants, 12);
    },
    createdBy: (parent) => {
      if (!parent.createdBy) return null;
      return User.findById(parent.createdBy).lean();
    },

    updatedBy: (parent) => {
      if (!parent.updatedBy) return null;
      return User.findById(parent.updatedBy).lean();
    },
    isOnline: (parent) => {
      const last = new Date(parent?.lastLoginAt || 0).getTime();
      if (!Number.isFinite(last) || last <= 0) return false;
      return Date.now() - last <= 5 * 60 * 1000;
    },
    loyaltyDurationScore: (parent) => {
      const created = new Date(parent?.createdAt || 0).getTime();
      if (!Number.isFinite(created) || created <= 0) return 0;
      return Math.max(
        0,
        Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)),
      );
    },
  },
};
