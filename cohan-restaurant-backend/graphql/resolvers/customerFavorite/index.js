import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { CustomerFavorite, Restaurant, MenuItem } from "../../../models/index.js";

const SUPPORTED_TYPES = new Set(["restaurant", "food"]);

function authError() {
  return new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
}

function requireAuthUser(ctx) {
  const uid = ctx?.user?.id || ctx?.user?._id;
  if (!uid || !mongoose.isValidObjectId(uid)) throw authError();
  return uid;
}

function normalizeType(type) {
  const value = String(type || "").trim().toLowerCase();
  if (!SUPPORTED_TYPES.has(value)) throw new GraphQLError("Favorite type is not supported");
  return value;
}

function assertObjectId(value, field = "id") {
  if (!value || !mongoose.isValidObjectId(value)) throw new GraphQLError(`Invalid ${field}`);
  return value;
}

async function assertTargetExists(type, targetId) {
  const Model = type === "restaurant" ? Restaurant : MenuItem;
  const exists = await Model.exists({ _id: targetId });
  if (!exists) throw new GraphQLError("Favorite target not found");
}

export default {
  Query: {
    async myFavorites(_, { type }, ctx) {
      const userId = requireAuthUser(ctx);
      const filter = { userId };
      if (type && String(type).trim().toLowerCase() !== "all") {
        filter.targetType = normalizeType(type);
      }
      return CustomerFavorite.find(filter).sort({ createdAt: -1, _id: -1 }).lean({ virtuals: true });
    },
  },

  Mutation: {
    async toggleFavorite(_, { input }, ctx) {
      const userId = requireAuthUser(ctx);
      const targetType = normalizeType(input?.type);
      const targetId = assertObjectId(input?.targetId, "targetId");
      await assertTargetExists(targetType, targetId);

      const existing = await CustomerFavorite.findOne({ userId, targetType, targetId });
      if (existing) {
        await existing.deleteOne();
        return null;
      }

      return CustomerFavorite.create({ userId, targetType, targetId });
    },

    async removeFavorite(_, { id }, ctx) {
      const userId = requireAuthUser(ctx);
      assertObjectId(id);
      const result = await CustomerFavorite.deleteOne({ _id: id, userId });
      return result.deletedCount > 0;
    },
  },

  CustomerFavorite: {
    id: (row) => String(row._id || row.id),
    type: (row) => row.targetType,
    targetId: (row) => String(row.targetId),
    userId: (row) => String(row.userId),
    restaurant: async (row) => row.targetType === "restaurant" ? Restaurant.findById(row.targetId).lean({ virtuals: true }) : null,
    food: async (row) => row.targetType === "food" ? MenuItem.findById(row.targetId).lean({ virtuals: true }) : null,
  },
};
