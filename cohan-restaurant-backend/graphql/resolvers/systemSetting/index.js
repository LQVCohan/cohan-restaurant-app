import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { AuditLog, Restaurant, SystemSetting } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import { requireAnyPermission, requirePermission } from "../../../src/services/auth/authorization.service.js";

const DEFAULT_OVERTIME_POLICY = {
  enabled: true,
  defaultMaxMinutesPerDay: 120,
  roleGroupLimits: {
    service: { maxMinutesPerDay: 120 },
    kitchen: { maxMinutesPerDay: 180 },
    shiftManager: { maxMinutesPerDay: 240 },
  },
};

const DEFAULT_DOC = {
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  dateFormat: "DD/MM/YYYY",
  operational: { businessDayStartHour: 5, defaultLanguage: "vi" },
  modules: { scheduling: true, rbac: true, printing: true, backup: true },
  overtimePolicy: DEFAULT_OVERTIME_POLICY,
  metadata: { note: "", version: 1 },
};

const badInput = (message) => new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
const notFound = (message = "Resource not found") => new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });

const toId = (v) => (v ? String(v._id || v.id || v) : null);

function sanitizeNonEmptyString(value, fieldName) {
  if (value == null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) throw badInput(`${fieldName} must be a non-empty string`);
  return normalized;
}

function normalizeMinuteLimit(value, fieldName) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
    throw badInput(`${fieldName} must be an integer between 0 and 1440`);
  }
  return minutes;
}

function getSafeMinuteLimit(value, fallback) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 1440) return fallback;
  return numeric;
}

function normalizeOvertimePolicy(policy = {}) {
  const source = policy || {};
  const roleGroupLimits = source.roleGroupLimits || {};

  return {
    enabled: Boolean(source.enabled ?? DEFAULT_OVERTIME_POLICY.enabled),
    defaultMaxMinutesPerDay: getSafeMinuteLimit(
      source.defaultMaxMinutesPerDay,
      DEFAULT_OVERTIME_POLICY.defaultMaxMinutesPerDay,
    ),
    roleGroupLimits: {
      service: {
        maxMinutesPerDay: getSafeMinuteLimit(
          roleGroupLimits.service?.maxMinutesPerDay,
          DEFAULT_OVERTIME_POLICY.roleGroupLimits.service.maxMinutesPerDay,
        ),
      },
      kitchen: {
        maxMinutesPerDay: getSafeMinuteLimit(
          roleGroupLimits.kitchen?.maxMinutesPerDay,
          DEFAULT_OVERTIME_POLICY.roleGroupLimits.kitchen.maxMinutesPerDay,
        ),
      },
      shiftManager: {
        maxMinutesPerDay: getSafeMinuteLimit(
          roleGroupLimits.shiftManager?.maxMinutesPerDay,
          DEFAULT_OVERTIME_POLICY.roleGroupLimits.shiftManager.maxMinutesPerDay,
        ),
      },
    },
  };
}

function normalizeDoc(doc) {
  return {
    id: toId(doc._id),
    restaurantId: toId(doc.restaurantId),
    timezone: doc.timezone || DEFAULT_DOC.timezone,
    currency: doc.currency || DEFAULT_DOC.currency,
    dateFormat: doc.dateFormat || DEFAULT_DOC.dateFormat,
    operational: {
      businessDayStartHour: Number(doc?.operational?.businessDayStartHour ?? DEFAULT_DOC.operational.businessDayStartHour),
      defaultLanguage: doc?.operational?.defaultLanguage || DEFAULT_DOC.operational.defaultLanguage,
    },
    modules: {
      scheduling: Boolean(doc?.modules?.scheduling ?? DEFAULT_DOC.modules.scheduling),
      rbac: Boolean(doc?.modules?.rbac ?? DEFAULT_DOC.modules.rbac),
      printing: Boolean(doc?.modules?.printing ?? DEFAULT_DOC.modules.printing),
      backup: Boolean(doc?.modules?.backup ?? DEFAULT_DOC.modules.backup),
    },
    overtimePolicy: normalizeOvertimePolicy(doc?.overtimePolicy),
    metadata: {
      note: doc?.metadata?.note || "",
      version: Number(doc?.metadata?.version || 1),
    },
    updatedBy: doc?.updatedBy ? toId(doc.updatedBy) : null,
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null,
  };
}

async function assertRestaurant(ctx, restaurantId) {
  if (!mongoose.isValidObjectId(restaurantId)) throw badInput("Invalid restaurantId");
  await requireRestaurantAccess(ctx, restaurantId);
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) throw notFound("Restaurant not found");
}

async function assertReadAccess(ctx, restaurantId) {
  await requireAnyPermission(ctx, ["system.manage", "restaurant.read"]);
  await assertRestaurant(ctx, restaurantId);
}

async function assertManageAccess(ctx, restaurantId) {
  await requirePermission(ctx, "system.manage");
  await assertRestaurant(ctx, restaurantId);
}

async function findOrCreate(restaurantId) {
  let doc = await SystemSetting.findOne({ restaurantId });
  if (!doc) {
    doc = await SystemSetting.create({ restaurantId, ...DEFAULT_DOC });
  }
  return doc;
}

async function safeAuditLog(payload) {
  try {
    await AuditLog.create(payload);
  } catch (error) {
    console.warn("[systemSetting] audit log failed", error?.message || error);
  }
}

export default {
  Query: {
    systemSetting: async (_, { restaurantId }, ctx) => {
      await assertReadAccess(ctx, restaurantId);
      const doc = await findOrCreate(restaurantId);
      return normalizeDoc(doc);
    },
  },
  Mutation: {
    updateSystemSetting: async (_, { input }, ctx) => {
      const restaurantId = input?.restaurantId;
      await assertManageAccess(ctx, restaurantId);
      const existing = await findOrCreate(restaurantId);
      const before = normalizeDoc(existing.toObject());

      const set = {};
      const timezone = sanitizeNonEmptyString(input?.timezone, "timezone");
      if (timezone !== undefined) set.timezone = timezone;
      const currency = sanitizeNonEmptyString(input?.currency, "currency");
      if (currency !== undefined) set.currency = currency;
      const dateFormat = sanitizeNonEmptyString(input?.dateFormat, "dateFormat");
      if (dateFormat !== undefined) set.dateFormat = dateFormat;

      if (input?.operational) {
        if (Object.prototype.hasOwnProperty.call(input.operational, "businessDayStartHour")) {
          const hour = Number(input.operational.businessDayStartHour);
          if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
            throw badInput("operational.businessDayStartHour must be an integer between 0 and 23");
          }
          set["operational.businessDayStartHour"] = hour;
        }
        const lang = sanitizeNonEmptyString(input.operational.defaultLanguage, "operational.defaultLanguage");
        if (lang !== undefined) set["operational.defaultLanguage"] = lang;
      }

      if (input?.modules) {
        const keys = ["scheduling", "rbac", "printing", "backup"];
        keys.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(input.modules, key)) {
            set[`modules.${key}`] = Boolean(input.modules[key]);
          }
        });
      }

      if (input?.overtimePolicy) {
        if (Object.prototype.hasOwnProperty.call(input.overtimePolicy, "enabled")) {
          set["overtimePolicy.enabled"] = Boolean(input.overtimePolicy.enabled);
        }
        if (Object.prototype.hasOwnProperty.call(input.overtimePolicy, "defaultMaxMinutesPerDay")) {
          set["overtimePolicy.defaultMaxMinutesPerDay"] = normalizeMinuteLimit(
            input.overtimePolicy.defaultMaxMinutesPerDay,
            "overtimePolicy.defaultMaxMinutesPerDay",
          );
        }

        const limits = input.overtimePolicy.roleGroupLimits || {};
        ["service", "kitchen", "shiftManager"].forEach((key) => {
          if (!Object.prototype.hasOwnProperty.call(limits, key)) return;
          if (!Object.prototype.hasOwnProperty.call(limits[key] || {}, "maxMinutesPerDay")) return;
          set[`overtimePolicy.roleGroupLimits.${key}.maxMinutesPerDay`] = normalizeMinuteLimit(
            limits[key].maxMinutesPerDay,
            `overtimePolicy.roleGroupLimits.${key}.maxMinutesPerDay`,
          );
        });
      }

      if (Object.prototype.hasOwnProperty.call(input || {}, "note")) {
        const note = input.note == null ? "" : String(input.note);
        set["metadata.note"] = note;
      }

      const actorId = ctx?.user?.id || ctx?.user?._id;
      if (actorId && mongoose.isValidObjectId(actorId)) {
        set.updatedBy = actorId;
      }

      const updated = await SystemSetting.findOneAndUpdate(
        { restaurantId },
        {
          $set: set,
          $inc: { "metadata.version": 1 },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      const after = normalizeDoc(updated.toObject());
      await safeAuditLog({
        action: "SYSTEM_SETTING_UPDATED",
        module: "settings",
        targetType: "SystemSetting",
        targetId: updated._id,
        restaurantId,
        actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
        byUserId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
        before,
        after,
      });

      return after;
    },
  },
};
