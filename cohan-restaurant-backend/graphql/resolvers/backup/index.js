import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { AuditLog, BackupRun, Restaurant } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import { requireAnyPermission } from "../../../src/services/auth/authorization.service.js";
import {
  buildRestaurantConfigSnapshot,
  buildSectionCounts,
  decodeSnapshotBase64,
  importRestaurantConfigSnapshot,
  previewRestaurantConfigImport,
} from "../../../src/services/restaurantConfigBackup.service.js";

const VALID_STATUS = new Set(["planned", "checklist_completed", "cancelled"]);
const MAX_LIMIT = 100;
const PRE_EXPORT_CHECKLIST_FIELDS = [
  "reportsChecked",
  "transactionsReconciled",
  "settingsReviewed",
];

const DEFAULT_CHECKLIST = {
  reportsChecked: false,
  transactionsReconciled: false,
  settingsReviewed: false,
  exportPrepared: false,
  safeCopyStored: false,
  operatorRecorded: false,
};

const DEFAULT_SCOPE = {
  ordersAndPayments: false,
  tablesAndFloorPlan: true,
  menuAndPricing: true,
  inventory: true,
  staffAndPermissions: false,
  schedules: true,
  customersAndPromotions: true,
  reportsAndReconciliation: false,
};

const RISK_DEFS = [
  ["reportsChecked", "reports_not_checked", "Báo cáo cuối ngày chưa kiểm tra"],
  ["transactionsReconciled", "transactions_not_reconciled", "Giao dịch chưa đối soát"],
  ["settingsReviewed", "settings_not_reviewed", "Cấu hình hệ thống chưa rà soát"],
  ["exportPrepared", "export_not_prepared", "File sao lưu chưa được tạo"],
  ["safeCopyStored", "safe_copy_not_stored", "File sao lưu chưa được lưu ở nơi an toàn"],
  ["operatorRecorded", "operator_not_recorded", "Chưa ghi nhận người thực hiện"],
];

const badInput = (message) => new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
const notFound = (message = "Resource not found") => new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });

function sanitizeNote(note) {
  if (note == null) return undefined;
  const normalized = String(note);
  if (normalized.length > 1000) throw badInput("note must be at most 1000 characters");
  return normalized;
}

function normalizeChecklist(checklist = {}) {
  return {
    reportsChecked: Boolean(checklist.reportsChecked),
    transactionsReconciled: Boolean(checklist.transactionsReconciled),
    settingsReviewed: Boolean(checklist.settingsReviewed),
    exportPrepared: Boolean(checklist.exportPrepared),
    safeCopyStored: Boolean(checklist.safeCopyStored),
    operatorRecorded: Boolean(checklist.operatorRecorded),
  };
}

function checklistFromUserInput(checklist = {}, previous = DEFAULT_CHECKLIST) {
  const current = normalizeChecklist(previous);
  const next = { ...current };

  for (const field of PRE_EXPORT_CHECKLIST_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(checklist, field)) {
      next[field] = Boolean(checklist[field]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(checklist, "safeCopyStored")) {
    next.safeCopyStored = current.exportPrepared ? Boolean(checklist.safeCopyStored) : false;
  }

  return next;
}

function normalizeScope(scope = {}) {
  return {
    ordersAndPayments: Boolean(scope.ordersAndPayments ?? DEFAULT_SCOPE.ordersAndPayments),
    tablesAndFloorPlan: Boolean(scope.tablesAndFloorPlan ?? DEFAULT_SCOPE.tablesAndFloorPlan),
    menuAndPricing: Boolean(scope.menuAndPricing ?? DEFAULT_SCOPE.menuAndPricing),
    inventory: Boolean(scope.inventory ?? DEFAULT_SCOPE.inventory),
    staffAndPermissions: Boolean(scope.staffAndPermissions ?? DEFAULT_SCOPE.staffAndPermissions),
    schedules: Boolean(scope.schedules ?? DEFAULT_SCOPE.schedules),
    customersAndPromotions: Boolean(scope.customersAndPromotions ?? DEFAULT_SCOPE.customersAndPromotions),
    reportsAndReconciliation: Boolean(scope.reportsAndReconciliation ?? DEFAULT_SCOPE.reportsAndReconciliation),
  };
}

function allChecklistDone(checklist) {
  return Object.values(checklist).every(Boolean);
}

function missingPreExportChecks(checklist) {
  return PRE_EXPORT_CHECKLIST_FIELDS.filter((field) => !checklist[field]);
}

async function assertAccess(ctx, restaurantId, permissions = ["system.manage"]) {
  await requireAnyPermission(ctx, [...permissions, "system.manage"]);
  if (!mongoose.isValidObjectId(restaurantId)) throw badInput("Invalid restaurantId");
  await requireRestaurantAccess(ctx, restaurantId);
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) throw notFound("Restaurant not found");
  return restaurant;
}

async function requireExportReadyRun(restaurantId) {
  const run = await BackupRun.findOne({ restaurantId, status: "planned" })
    .sort({ createdAt: -1 });
  if (!run) {
    throw badInput("Hãy bắt đầu và lưu lần kiểm tra trước khi tải file sao lưu.");
  }

  const checklist = normalizeChecklist(run.checklist);
  if (missingPreExportChecks(checklist).length) {
    throw badInput("Hãy hoàn tất và lưu 3 việc bắt buộc trước khi tải file sao lưu.");
  }

  return run;
}

function toView(doc) {
  return {
    id: String(doc._id),
    restaurantId: String(doc.restaurantId),
    status: doc.status,
    checklist: normalizeChecklist(doc.checklist || DEFAULT_CHECKLIST),
    scope: normalizeScope(doc.scope || DEFAULT_SCOPE),
    note: doc.note || "",
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    completedBy: doc.completedBy ? String(doc.completedBy) : null,
    completedAt: doc.completedAt || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function buildRisks(checklist) {
  return RISK_DEFS.map(([field, key, label]) => ({
    key,
    label,
    severity: "warning",
    resolved: Boolean(checklist[field]),
    description: checklist[field] ? "Đã hoàn tất." : "Cần hoàn tất trước khi kết thúc lần sao lưu.",
  }));
}

function configFileName(snapshot) {
  const name = String(snapshot?.source?.restaurantName || "restaurant")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "restaurant";
  const stamp = String(snapshot?.createdAt || new Date().toISOString()).slice(0, 10);
  return `${name}-config-snapshot-${stamp}.json`;
}

function toConfigBackupPreview(restaurantId, snapshot, sections) {
  return {
    restaurantId: String(restaurantId),
    fileName: configFileName(snapshot),
    schemaVersion: snapshot.schemaVersion,
    createdAt: snapshot.createdAt,
    counts: buildSectionCounts(snapshot, sections),
    warnings: [
      "Đây là Restaurant Configuration Snapshot, không thay thế database backup vận hành.",
      "Máy in dùng device id/local IP có thể cần chỉnh lại sau restore.",
    ],
  };
}

function backupScopeFromSections(sections = {}) {
  return normalizeScope({
    ordersAndPayments: false,
    tablesAndFloorPlan: Boolean(sections.floorTableLayout),
    menuAndPricing: Boolean(sections.menuCatalog),
    inventory: Boolean(sections.inventoryMaster),
    staffAndPermissions: false,
    schedules: Boolean(sections.schedulingPolicy),
    customersAndPromotions: Boolean(sections.customerRankSettings || sections.promotionConfig),
    reportsAndReconciliation: false,
  });
}

async function safeAuditLog(payload) {
  try {
    await AuditLog.create(payload);
  } catch (error) {
    console.warn("[backup] audit log failed", error?.message || error);
  }
}

export default {
  Query: {
    backupReadiness: async (_, { restaurantId }, ctx) => {
      await assertAccess(ctx, restaurantId, ["backup.read"]);
      const latest = await BackupRun.findOne({ restaurantId }).sort({ createdAt: -1 }).lean();
      const checklist = normalizeChecklist(latest?.checklist || DEFAULT_CHECKLIST);
      const scope = normalizeScope(latest?.scope || DEFAULT_SCOPE);
      const risks = buildRisks(checklist);
      return {
        restaurantId: String(restaurantId),
        ready: risks.every((r) => r.resolved),
        risks,
        checklist,
        scope,
        lastRun: latest ? toView(latest) : null,
      };
    },
    backupRuns: async (_, { restaurantId, limit = 20, offset = 0 }, ctx) => {
      await assertAccess(ctx, restaurantId, ["backup.read"]);
      const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), MAX_LIMIT);
      const safeOffset = Math.max(Number(offset) || 0, 0);
      const rows = await BackupRun.find({ restaurantId })
        .sort({ createdAt: -1 })
        .skip(safeOffset)
        .limit(safeLimit)
        .lean();
      return rows.map(toView);
    },
    restaurantConfigBackupPreview: async (_, { input }, ctx) => {
      const restaurantId = input?.restaurantId;
      await assertAccess(ctx, restaurantId, ["backup.read"]);
      try {
        const snapshot = await buildRestaurantConfigSnapshot({
          restaurantId,
          sections: input?.sections,
          actorId: ctx?.user?.id || ctx?.user?._id,
        });
        return toConfigBackupPreview(restaurantId, snapshot, input?.sections);
      } catch (error) {
        throw badInput(error.message || "Cannot build restaurant config backup preview");
      }
    },
  },
  Mutation: {
    createBackupRun: async (_, { input }, ctx) => {
      const restaurantId = input?.restaurantId;
      await assertAccess(ctx, restaurantId, ["backup.write"]);
      const actorId = ctx?.user?.id || ctx?.user?._id;

      const checklist = checklistFromUserInput(input?.checklist, DEFAULT_CHECKLIST);
      const scope = normalizeScope({ ...DEFAULT_SCOPE, ...(input?.scope || {}) });
      const note = sanitizeNote(input?.note);
      const status = allChecklistDone(checklist) ? "checklist_completed" : "planned";

      const payload = {
        restaurantId,
        checklist,
        scope,
        status,
      };
      if (note !== undefined) payload.note = note;
      if (actorId && mongoose.isValidObjectId(actorId)) payload.createdBy = actorId;
      if (status === "checklist_completed") {
        payload.completedAt = new Date();
        if (actorId && mongoose.isValidObjectId(actorId)) payload.completedBy = actorId;
      }

      const created = await BackupRun.create(payload);

      await safeAuditLog({
        action: "BACKUP_RUN_CREATED",
        module: "backup",
        targetType: "BackupRun",
        targetId: created._id,
        restaurantId,
        actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
        byUserId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
        after: toView(created),
      });

      return toView(created);
    },

    exportRestaurantConfigBackup: async (_, { input }, ctx) => {
      const restaurantId = input?.restaurantId;
      await assertAccess(ctx, restaurantId, ["backup.export"]);
      const actorId = ctx?.user?.id || ctx?.user?._id;
      const backupRun = await requireExportReadyRun(restaurantId);
      try {
        const snapshot = await buildRestaurantConfigSnapshot({ restaurantId, sections: input?.sections, actorId });
        const json = JSON.stringify(snapshot, null, 2);
        const contentBase64 = Buffer.from(json, "utf8").toString("base64");

        const nextChecklist = {
          ...normalizeChecklist(backupRun.checklist),
          exportPrepared: true,
          operatorRecorded: true,
        };
        backupRun.checklist = nextChecklist;
        backupRun.status = allChecklistDone(nextChecklist) ? "checklist_completed" : "planned";
        if (backupRun.status === "checklist_completed") {
          backupRun.completedAt = new Date();
          if (actorId && mongoose.isValidObjectId(actorId)) backupRun.completedBy = actorId;
        }
        await backupRun.save();

        await safeAuditLog({
          action: "CONFIG_BACKUP_EXPORTED",
          module: "backup",
          targetType: "Restaurant",
          targetId: restaurantId,
          restaurantId,
          actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
          byUserId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
          after: {
            backupRunId: String(backupRun._id),
            checksum: snapshot.checksum,
            counts: snapshot.counts,
            sections: Object.keys(snapshot.sections || {}),
          },
        });

        return {
          fileName: configFileName(snapshot),
          mimeType: "application/json",
          encoding: "base64",
          contentBase64,
          checksum: snapshot.checksum,
          sizeBytes: Buffer.byteLength(json, "utf8"),
          createdAt: snapshot.createdAt,
        };
      } catch (error) {
        throw badInput(error.message || "Cannot export restaurant config backup");
      }
    },

    previewRestaurantConfigImport: async (_, { input }, ctx) => {
      const targetRestaurantId = input?.targetRestaurantId;
      await assertAccess(ctx, targetRestaurantId, ["backup.import"]);
      const actorId = ctx?.user?.id || ctx?.user?._id;
      try {
        const snapshot = decodeSnapshotBase64(input?.fileContentBase64);
        const result = await previewRestaurantConfigImport({
          targetRestaurantId,
          snapshot,
          mode: input?.mode || "clone",
          sections: input?.sections,
          conflictResolutions: input?.conflictResolutions || [],
        });
        await safeAuditLog({
          action: "CONFIG_BACKUP_IMPORT_PREVIEWED",
          module: "backup",
          targetType: "Restaurant",
          targetId: targetRestaurantId,
          restaurantId: targetRestaurantId,
          actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
          byUserId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
          after: { mode: result.mode, valid: result.valid, sourceRestaurantName: result.sourceRestaurantName, conflictCount: result.conflicts?.length || 0 },
        });
        return result;
      } catch (error) {
        return {
          valid: false,
          schemaVersion: null,
          sourceRestaurantName: null,
          targetRestaurantId: String(targetRestaurantId),
          mode: input?.mode || "clone",
          changes: [],
          conflicts: [],
          conflictSummary: [],
          warnings: [],
          errors: [error.message || "Invalid restaurant config snapshot file"],
        };
      }
    },

    importRestaurantConfigBackup: async (_, { input }, ctx) => {
      const targetRestaurantId = input?.targetRestaurantId;
      await assertAccess(ctx, targetRestaurantId, ["backup.import"]);
      const actorId = ctx?.user?.id || ctx?.user?._id;
      let snapshot;
      try {
        snapshot = decodeSnapshotBase64(input?.fileContentBase64);
      } catch (error) {
        throw badInput(error.message || "Invalid restaurant config snapshot file");
      }
      const result = await importRestaurantConfigSnapshot({
        targetRestaurantId,
        snapshot,
        mode: input?.mode || "clone",
        sections: input?.sections,
        actorId,
        dryRun: input?.dryRun ?? true,
        replaceExisting: Boolean(input?.replaceExisting),
        conflictResolutions: input?.conflictResolutions || [],
      });
      let backupRun = null;
      if (!result.success && !result.dryRun) throw badInput((result.errors || []).join("; ") || "Import failed");
      if (result.success && !result.dryRun) {
        const enabled = Object.fromEntries((result.changes || []).map((entry) => [entry.section, true]));
        const created = await BackupRun.create({
          restaurantId: targetRestaurantId,
          status: "checklist_completed",
          checklist: { ...DEFAULT_CHECKLIST, exportPrepared: true, settingsReviewed: true, operatorRecorded: true },
          scope: backupScopeFromSections(enabled),
          note: `Imported restaurant configuration snapshot from ${snapshot.source?.restaurantName || snapshot.source?.restaurantId || "unknown source"}. Mode: ${result.mode}. Resolved conflicts: ${result.appliedResolutions?.length || 0}.`,
          createdBy: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
          completedBy: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
          completedAt: new Date(),
        });
        backupRun = toView(created);
        await safeAuditLog({
          action: "CONFIG_BACKUP_IMPORTED",
          module: "backup",
          targetType: "Restaurant",
          targetId: targetRestaurantId,
          restaurantId: targetRestaurantId,
          actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
          byUserId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
          after: { mode: result.mode, checksum: snapshot.checksum, changes: result.changes, conflictCount: result.conflicts?.length || 0, appliedResolutionCount: result.appliedResolutions?.length || 0 },
        });
      }
      return { ...result, backupRun };
    },

    updateBackupRun: async (_, { input }, ctx) => {
      const { id, restaurantId } = input || {};
      await assertAccess(ctx, restaurantId, ["backup.write"]);
      if (!mongoose.isValidObjectId(id)) throw badInput("Invalid id");

      const doc = await BackupRun.findById(id);
      if (!doc) throw notFound("Backup run not found");
      if (String(doc.restaurantId) !== String(restaurantId)) throw badInput("Backup run does not belong to restaurantId");

      const before = toView(doc);
      const set = {};
      if (input?.checklist) {
        set.checklist = checklistFromUserInput(input.checklist, doc.checklist);
      }
      if (input?.scope) {
        set.scope = normalizeScope({ ...normalizeScope(doc.scope), ...input.scope });
      }
      const note = sanitizeNote(input?.note);
      if (note !== undefined) set.note = note;

      if (Object.prototype.hasOwnProperty.call(input || {}, "status") && input.status != null) {
        const status = String(input.status);
        if (!VALID_STATUS.has(status)) throw badInput("Invalid status");
        set.status = status;
      }

      const actorId = ctx?.user?.id || ctx?.user?._id;
      const finalChecklist = set.checklist || normalizeChecklist(doc.checklist);
      const finalStatus = set.status || doc.status;
      if (set.status === "checklist_completed") {
        if (!allChecklistDone(finalChecklist)) {
          throw badInput("Chỉ có thể hoàn tất lần kiểm tra sau khi đủ tất cả các bước.");
        }
        set.completedAt = new Date();
        if (actorId && mongoose.isValidObjectId(actorId)) set.completedBy = actorId;
      } else if (allChecklistDone(finalChecklist) && finalStatus === "planned") {
        set.status = "checklist_completed";
        set.completedAt = new Date();
        if (actorId && mongoose.isValidObjectId(actorId)) set.completedBy = actorId;
      }
      if (set.status === "cancelled") {
        set.completedAt = null;
        set.completedBy = null;
      }

      Object.assign(doc, set);
      await doc.save();

      await safeAuditLog({
        action: "BACKUP_RUN_UPDATED",
        module: "backup",
        targetType: "BackupRun",
        targetId: doc._id,
        restaurantId,
        actorId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
        byUserId: actorId && mongoose.isValidObjectId(actorId) ? actorId : undefined,
        before,
        after: toView(doc),
      });

      return toView(doc);
    },
  },
};
