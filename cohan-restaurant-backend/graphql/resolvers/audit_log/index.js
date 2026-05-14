import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { AuditLog } from "../../../models/index.js";
import { requireRestaurantAccess, requireRoles } from "../../guards.js";

const MAX_LIMIT = 100;

function isOid(value) {
  return mongoose.isValidObjectId(value);
}

function normalizeLimit(limit) {
  const n = Number(limit || 50);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(n, MAX_LIMIT);
}

function normalizeOffset(offset) {
  const n = Number(offset || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function buildFilter(filter = {}) {
  const query = {};
  if (filter.restaurantId) {
    if (!isOid(filter.restaurantId))
      throw new GraphQLError("Invalid restaurantId");
    query.restaurantId = filter.restaurantId;
  }
  if (filter.entity) query.entity = String(filter.entity).trim();

  if (filter.action) query.action = String(filter.action).trim();

  if (filter.entityId) {
    if (!isOid(filter.entityId)) throw new GraphQLError("Invalid entityId");
    query.entityId = filter.entityId;
  }

  if (filter.byUserId) {
    if (!isOid(filter.byUserId)) throw new GraphQLError("Invalid byUserId");
    query.byUserId = filter.byUserId;
  }

  return query;
}

function buildRbacFilter(filter = {}) {
  const query = { module: "rbac" };
  if (filter.restaurantId) query.restaurantId = filter.restaurantId;
  if (filter.action) query.action = String(filter.action).trim();
  if (filter.targetType) query.targetType = String(filter.targetType).trim();
  if (filter.targetId) query.targetId = filter.targetId;
  if (filter.actorId) query.actorId = filter.actorId;
  return query;
}

export default {
  Query: {
    auditLogs: async (_, { filter = {}, limit = 50, offset = 0 }, ctx) => {
      if (filter?.restaurantId) {
        await requireRestaurantAccess(ctx, filter.restaurantId);
      } else {
        requireRoles(ctx, ["ADMIN"]);
      }

      const query = buildFilter(filter);
      const safeLimit = normalizeLimit(limit);
      const safeOffset = normalizeOffset(offset);

      const [items, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ createdAt: -1 })
          .skip(safeOffset)
          .limit(safeLimit)
          .lean({ virtuals: true }),
        AuditLog.countDocuments(query),
      ]);

      return {
        items,
        total,
      };
    },

    rbacAuditLogs: async (_, { filter = {}, limit = 50, offset = 0 }, ctx) => {
      if (filter?.restaurantId) {
        await requireRestaurantAccess(ctx, filter.restaurantId);
      } else {
        requireRoles(ctx, ["ADMIN"]);
      }

      return AuditLog.find(buildRbacFilter(filter))
        .sort({ createdAt: -1 })
        .skip(normalizeOffset(offset))
        .limit(normalizeLimit(limit))
        .lean({ virtuals: true });
    },
  },

  AuditLog: {
    id: (doc) => doc.id || String(doc._id),
  },
};