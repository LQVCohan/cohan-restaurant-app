import mongoose from "mongoose";
import {
  AuditLog,
  StaffPerformanceSnapshot,
  SystemSetting,
} from "../../../models/index.js";
import { resolveUserRoles } from "../scheduling/schedulingPermission.service.js";

export const DEFAULT_PERFORMANCE_LEVEL_THRESHOLDS = Object.freeze({
  excellentMin: 90,
  goodMin: 80,
  averageMin: 65,
  needsAttentionMin: 50,
});

export const LOCKED_PERFORMANCE_WEIGHTS = Object.freeze({
  productivity: 25,
  punctuality: 25,
  quality: 20,
  managerReview: 20,
  compliance: 10,
});

export const PERFORMANCE_POLICY_EDITABLE_FIELDS = Object.freeze([
  "excellentMin",
  "goodMin",
  "averageMin",
  "needsAttentionMin",
]);

export const PERFORMANCE_POLICY_LOCKED_FIELDS = Object.freeze([
  "Trọng số 25/25/20/20/10",
  "Công thức năng suất theo thời lượng ca",
  "Mức trừ đi trễ, về sớm và vắng mặt",
  "Quy tắc Chất lượng theo từng vai trò",
  "Mức trừ yêu cầu chỉnh công",
  "Quy trình incident và hoàn điểm appeal",
]);

const PERFORMANCE_POLICY_MANAGER_ROLES = new Set(["ADMIN", "MANAGER", "HR"]);

function toObjectId(value) {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

function actorIdFromContext(ctx) {
  return toObjectId(ctx?.user?.id || ctx?.user?._id);
}

function assertCanManagePerformancePolicy(ctx) {
  const roles = resolveUserRoles(ctx?.user || {});
  if (!roles.some((role) => PERFORMANCE_POLICY_MANAGER_ROLES.has(role))) {
    const error = new Error("Bạn không có quyền xem hoặc cập nhật cấu hình hiệu suất.");
    error.code = "FORBIDDEN";
    throw error;
  }
}

function normalizeThresholdValue(value, fieldName) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 100) {
    const error = new Error(`${fieldName} phải là số nguyên từ 1 đến 100.`);
    error.code = "BAD_USER_INPUT";
    throw error;
  }
  return numeric;
}

export function validatePerformanceLevelThresholds(input = {}) {
  const thresholds = {
    excellentMin: normalizeThresholdValue(input.excellentMin, "Mốc Xuất sắc"),
    goodMin: normalizeThresholdValue(input.goodMin, "Mốc Tốt"),
    averageMin: normalizeThresholdValue(input.averageMin, "Mốc Trung bình"),
    needsAttentionMin: normalizeThresholdValue(
      input.needsAttentionMin,
      "Mốc Cần chú ý",
    ),
  };

  if (
    !(
      thresholds.excellentMin > thresholds.goodMin &&
      thresholds.goodMin > thresholds.averageMin &&
      thresholds.averageMin > thresholds.needsAttentionMin
    )
  ) {
    const error = new Error(
      "Các mốc phải giảm nghiêm ngặt: Xuất sắc > Tốt > Trung bình > Cần chú ý.",
    );
    error.code = "BAD_USER_INPUT";
    throw error;
  }

  return thresholds;
}

export function normalizePerformanceLevelThresholds(source = {}) {
  const merged = {
    ...DEFAULT_PERFORMANCE_LEVEL_THRESHOLDS,
    ...(source || {}),
  };

  try {
    return validatePerformanceLevelThresholds(merged);
  } catch {
    return { ...DEFAULT_PERFORMANCE_LEVEL_THRESHOLDS };
  }
}

export function resolvePerformanceLevel(score, thresholdsInput = {}) {
  const thresholds = normalizePerformanceLevelThresholds(thresholdsInput);
  const numeric = Number(score || 0);

  if (numeric >= thresholds.excellentMin) return "excellent";
  if (numeric >= thresholds.goodMin) return "good";
  if (numeric >= thresholds.averageMin) return "average";
  if (numeric >= thresholds.needsAttentionMin) return "needs_attention";
  return "poor";
}

function mapPolicy({ restaurantId, setting = null }) {
  return {
    restaurantId: String(restaurantId),
    weights: { ...LOCKED_PERFORMANCE_WEIGHTS },
    levelThresholds: normalizePerformanceLevelThresholds(
      setting?.performancePolicy?.levelThresholds,
    ),
    editableFields: [...PERFORMANCE_POLICY_EDITABLE_FIELDS],
    lockedFields: [...PERFORMANCE_POLICY_LOCKED_FIELDS],
    updatedBy: setting?.updatedBy ? String(setting.updatedBy) : null,
    updatedAt: setting?.updatedAt || null,
  };
}

export async function getPerformanceLevelThresholds(restaurantId) {
  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("restaurantId không hợp lệ.");

  const setting = await SystemSetting.findOne({ restaurantId: rid })
    .select({ "performancePolicy.levelThresholds": 1 })
    .lean();

  return normalizePerformanceLevelThresholds(
    setting?.performancePolicy?.levelThresholds,
  );
}

export async function getStaffPerformancePolicy({ restaurantId, ctx }) {
  assertCanManagePerformancePolicy(ctx);
  const rid = toObjectId(restaurantId);
  if (!rid) throw new Error("restaurantId không hợp lệ.");

  const setting = await SystemSetting.findOne({ restaurantId: rid }).lean();
  return mapPolicy({ restaurantId: rid, setting });
}

async function safeAuditLog(payload) {
  try {
    await AuditLog.create(payload);
  } catch (error) {
    console.warn(
      "[staffPerformancePolicy] audit log failed",
      error?.message || error,
    );
  }
}

export async function updateStaffPerformancePolicy({ input = {}, ctx }) {
  assertCanManagePerformancePolicy(ctx);
  const rid = toObjectId(input.restaurantId);
  if (!rid) throw new Error("restaurantId không hợp lệ.");

  const thresholds = validatePerformanceLevelThresholds(
    input.levelThresholds || {},
  );
  const beforeSetting = await SystemSetting.findOne({ restaurantId: rid }).lean();
  const before = mapPolicy({ restaurantId: rid, setting: beforeSetting });
  const actorId = actorIdFromContext(ctx);

  const setting = await SystemSetting.findOneAndUpdate(
    { restaurantId: rid },
    {
      $set: {
        "performancePolicy.levelThresholds": thresholds,
        ...(actorId ? { updatedBy: actorId } : {}),
      },
      $inc: { "metadata.version": 1 },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  const after = mapPolicy({ restaurantId: rid, setting });
  await safeAuditLog({
    action: "STAFF_PERFORMANCE_POLICY_UPDATED",
    module: "staff_performance",
    targetType: "SystemSetting",
    targetId: setting?._id,
    restaurantId: rid,
    actorId: actorId || undefined,
    byUserId: actorId || undefined,
    before,
    after,
  });

  return after;
}

export async function applyPerformancePolicyToRecalculationResult({
  result,
  restaurantId,
}) {
  const isList = Array.isArray(result);
  const snapshots = isList ? result : result ? [result] : [];
  if (!snapshots.length) return result;

  const thresholds = await getPerformanceLevelThresholds(restaurantId);
  const mapped = snapshots.map((snapshot) => {
    const insufficientData = snapshot?.factors?.insufficientData === true;
    const performanceLevel = insufficientData
      ? "poor"
      : resolvePerformanceLevel(snapshot?.finalPerformanceScore, thresholds);

    return {
      ...snapshot,
      performanceLevel,
      factors: {
        ...(snapshot?.factors || {}),
        performanceLevelThresholds: thresholds,
      },
    };
  });

  const operations = mapped
    .filter((snapshot) => snapshot?.id && mongoose.isValidObjectId(snapshot.id))
    .map((snapshot) => ({
      updateOne: {
        filter: { _id: toObjectId(snapshot.id) },
        update: {
          $set: {
            performanceLevel: snapshot.performanceLevel,
            "factors.performanceLevelThresholds": thresholds,
          },
        },
      },
    }));

  if (operations.length) {
    await StaffPerformanceSnapshot.bulkWrite(operations, { ordered: false });
  }

  return isList ? mapped : mapped[0];
}
