import mongoose from "mongoose";
import { AuditLog } from "../../../models/index.js";

const SAFE_FIELDS = Object.freeze([
  "_id",
  "id",
  "name",
  "slug",
  "code",
  "permissions",
  "parentRole",
  "department",
  "isSystem",
  "isActive",
  "action",
  "resource",
  "group",
  "description",
]);

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "authorization",
]);

function toObject(value) {
  if (!value) return value;
  if (typeof value.toObject === "function") return value.toObject();
  return value;
}

function normalizeId(value) {
  if (!value) return undefined;
  if (typeof value === "object") return value._id || value.id || value;
  return value;
}

function idToObjectId(value) {
  const raw = normalizeId(value);
  if (!raw) return undefined;
  if (raw instanceof mongoose.Types.ObjectId) return raw;
  if (mongoose.isValidObjectId(raw)) return new mongoose.Types.ObjectId(raw);
  return undefined;
}

function hasSafeFields(source) {
  return SAFE_FIELDS.some((field) => source[field] !== undefined);
}

function simplifyValue(value) {
  if (Array.isArray(value)) return value.map(simplifyValue);
  if (!value || typeof value !== "object") return value;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  const id = value._id || value.id;
  if (id && (value.code || value.slug || value.name)) {
    return {
      id: String(id),
      ...(value.code ? { code: value.code } : {}),
      ...(value.slug ? { slug: value.slug } : {}),
      ...(value.name ? { name: value.name } : {}),
    };
  }
  if (id && Object.keys(value).length <= 3) return String(id);
  return sanitizeAuditPayload(value);
}

export function sanitizeAuditPayload(payload) {
  const source = toObject(payload);
  if (!source || typeof source !== "object") return source ?? null;

  const output = {};
  const fields = hasSafeFields(source) ? SAFE_FIELDS : Object.keys(source);
  for (const field of fields) {
    if (source[field] === undefined) continue;
    if (SENSITIVE_KEYS.has(field)) continue;
    const key = field === "_id" ? "id" : field;
    output[key] = simplifyValue(source[field]);
  }
  return output;
}

function actorName(user) {
  return user?.fullName || user?.name || user?.username || user?.email || undefined;
}

function actorRole(user) {
  return user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || undefined;
}

function getIp(ctx) {
  return ctx?.ip || ctx?.request?.ip || ctx?.reply?.request?.ip || ctx?.req?.ip || undefined;
}

function getUserAgent(ctx) {
  return (
    ctx?.userAgent ||
    ctx?.request?.headers?.["user-agent"] ||
    ctx?.req?.headers?.["user-agent"] ||
    undefined
  );
}

export async function logRbacAudit({
  ctx = {},
  action,
  targetType,
  targetId,
  targetName,
  restaurantId,
  before,
  after,
  metadata,
}) {
  try {
    if (!action || !targetType) return null;
    const actor = ctx?.user || {};
    const actorId = idToObjectId(actor._id || actor.id);
    const normalizedTargetId = idToObjectId(targetId);
    const normalizedRestaurantId = idToObjectId(restaurantId);
    const sanitizedBefore = before === undefined ? undefined : sanitizeAuditPayload(before);
    const sanitizedAfter = after === undefined ? undefined : sanitizeAuditPayload(after);

    return await AuditLog.create({
      actorId,
      actorName: actorName(actor),
      actorRole: actorRole(actor),
      action,
      module: "rbac",
      targetType,
      targetId: normalizedTargetId,
      targetName,
      restaurantId: normalizedRestaurantId,
      before: sanitizedBefore,
      after: sanitizedAfter,
      metadata: metadata === undefined ? undefined : sanitizeAuditPayload(metadata),
      ipAddress: getIp(ctx),
      userAgent: getUserAgent(ctx),
      entity: targetType,
      entityId: normalizedTargetId,
      byUserId: actorId,
      diff: {
        before: sanitizedBefore ?? null,
        after: sanitizedAfter ?? null,
      },
    });
  } catch (error) {
    console.warn("[rbacAudit] failed to write audit log", error?.message || error);
    return null;
  }
}
