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
      return Restaurant.find({ _id: { $in: parent.refRestaurants } }).lean();
    },

    createdBy: (parent) => {
      if (!parent.createdBy) return null;
      return User.findById(parent.createdBy).lean();
    },

    updatedBy: (parent) => {
      if (!parent.updatedBy) return null;
      return User.findById(parent.updatedBy).lean();
    },
  },
};
