// src/graphql/resolvers/types/User.js
import { Role, Restaurant, User } from "../../../models/index.js";

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
      if (!parent.refRestaurants?.length) return [];
      return Restaurant.find({ _id: { $in: parent.refRestaurants } }).lean().then((rows) => {
        const byId = new Map(rows.map((row) => [String(row._id), row]));
        return parent.refRestaurants.map((id) => byId.get(String(id))).filter(Boolean);
      });
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
