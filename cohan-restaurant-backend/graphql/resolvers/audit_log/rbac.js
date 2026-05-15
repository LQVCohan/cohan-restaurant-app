import { AuditLog } from "../../../models/index.js";
import { requireRestaurantAccess, requireRoles } from "../../guards.js";
import { hasRole } from "../../../utils/authz.js";

const MAX_LIMIT = 100;

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

function buildRbacFilter(filter = {}) {
  const query = { module: "rbac" };
  if (filter.restaurantId) query.restaurantId = filter.restaurantId;
  if (filter.targetId) query.targetId = filter.targetId;
  if (filter.actorId) query.actorId = filter.actorId;
  if (filter.action) query.action = String(filter.action).trim();
  if (filter.module) query.module = String(filter.module).trim();
  if (filter.targetType) query.targetType = String(filter.targetType).trim();
  return query;
}

async function assertRbacAuditAccess(ctx, filter = {}) {
  if (hasRole(ctx?.user, ["admin"])) {
    requireRoles(ctx, ["ADMIN"]);
    return;
  }
  if (!hasRole(ctx?.user, ["manager"]) || !filter?.restaurantId) {
    const err = new Error("FORBIDDEN");
    err.statusCode = 403;
    throw err;
  }
  await requireRestaurantAccess(ctx, filter.restaurantId);
}

export async function rbacAuditLogs(_, { filter = {}, limit = 50, offset = 0 }, ctx) {
  await assertRbacAuditAccess(ctx, filter);
  return AuditLog.find(buildRbacFilter(filter))
    .sort({ createdAt: -1 })
    .skip(normalizeOffset(offset))
    .limit(normalizeLimit(limit))
    .lean({ virtuals: true });
}
