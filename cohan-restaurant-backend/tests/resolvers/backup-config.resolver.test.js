import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermission = vi.fn();
const requireRestaurantAccess = vi.fn();
const service = vi.hoisted(() => ({
  buildRestaurantConfigSnapshot: vi.fn(),
  buildSectionCounts: vi.fn(),
  decodeSnapshotBase64: vi.fn(),
  importRestaurantConfigSnapshot: vi.fn(),
  previewRestaurantConfigImport: vi.fn(),
}));
const models = vi.hoisted(() => ({
  AuditLog: { create: vi.fn() },
  BackupRun: { findOne: vi.fn(), find: vi.fn(), create: vi.fn(), findById: vi.fn() },
  Restaurant: { findById: vi.fn() },
}));

vi.mock("../../src/services/auth/authorization.service.js", () => ({ requireAnyPermission }));
vi.mock("../../graphql/guards.js", () => ({ requireRestaurantAccess }));
vi.mock("../../src/services/restaurantConfigBackup.service.js", () => service);
vi.mock("../../models/index.js", () => models);

const restaurantId = "507f1f77bcf86cd799439011";
const targetRestaurantId = "507f1f77bcf86cd799439012";
const actorId = "507f1f77bcf86cd799439013";
const runId = "507f1f77bcf86cd799439014";
const lean = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const snapshot = {
  kind: "cohan.restaurant_config_snapshot",
  schemaVersion: 1,
  createdAt: "2026-06-02T00:00:00.000Z",
  source: { restaurantId, restaurantName: "Source" },
  sections: { systemSettings: { locale: "vi" } },
  counts: {},
  checksum: "sha256:abc",
};
const base64 = Buffer.from(JSON.stringify(snapshot), "utf8").toString("base64");

const makeRun = (overrides = {}) => ({
  _id: runId,
  restaurantId,
  status: "planned",
  checklist: {
    reportsChecked: true,
    transactionsReconciled: true,
    settingsReviewed: true,
    exportPrepared: false,
    safeCopyStored: false,
    operatorRecorded: false,
  },
  scope: {},
  note: "",
  createdAt: new Date("2026-07-10T10:00:00.000Z"),
  updatedAt: new Date("2026-07-10T10:00:00.000Z"),
  completedAt: null,
  createdBy: actorId,
  completedBy: null,
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

async function resolver() {
  return (await import("../../graphql/resolvers/backup/index.js")).default;
}

describe("backup config resolver", () => {
  let activeRun;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    activeRun = makeRun();
    requireAnyPermission.mockResolvedValue(true);
    requireRestaurantAccess.mockResolvedValue(true);
    models.Restaurant.findById.mockReturnValue(lean({ _id: restaurantId, name: "Target" }));
    models.BackupRun.findOne.mockImplementation((filter = {}) => {
      if (filter.status === "planned") {
        return { sort: vi.fn().mockResolvedValue(activeRun) };
      }
      return { sort: vi.fn(() => lean(null)) };
    });
    models.BackupRun.find.mockReturnValue({ sort: vi.fn(() => ({ skip: vi.fn(() => ({ limit: vi.fn(() => lean([])) })) })) });
    models.BackupRun.create.mockImplementation(async (payload) => ({
      _id: "507f1f77bcf86cd799439099",
      createdAt: new Date("2026-06-02T00:00:00.000Z"),
      updatedAt: new Date("2026-06-02T00:00:00.000Z"),
      ...payload,
    }));
    models.BackupRun.findById.mockResolvedValue(activeRun);
    models.AuditLog.create.mockResolvedValue({});
    service.buildSectionCounts.mockReturnValue([{ key: "systemSettings", label: "Cấu hình hệ thống", count: 1, enabled: true }]);
    service.buildRestaurantConfigSnapshot.mockResolvedValue(snapshot);
    service.decodeSnapshotBase64.mockReturnValue(snapshot);
    service.previewRestaurantConfigImport.mockResolvedValue({ valid: true, schemaVersion: 1, sourceRestaurantName: "Source", targetRestaurantId, mode: "clone", changes: [], conflicts: [], conflictSummary: [], warnings: [], errors: [] });
    service.importRestaurantConfigSnapshot.mockResolvedValue({ success: true, dryRun: false, targetRestaurantId, mode: "clone", changes: [{ section: "systemSettings", action: "upsert", label: "Cấu hình hệ thống", count: 1 }], conflicts: [], appliedResolutions: [], warnings: [], errors: [] });
  });

  it("export requires backup.export/system.manage + restaurant access", async () => {
    const r = await resolver();
    await r.Mutation.exportRestaurantConfigBackup(null, { input: { restaurantId } }, { user: { id: actorId, roleName: "manager" } });
    expect(requireAnyPermission).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }), ["backup.export", "system.manage"]);
    expect(requireRestaurantAccess).toHaveBeenCalledWith(expect.objectContaining({ user: expect.any(Object) }), restaurantId);
    expect(service.buildRestaurantConfigSnapshot).toHaveBeenCalled();
    expect(models.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: "CONFIG_BACKUP_EXPORTED",
      after: expect.objectContaining({ backupRunId: runId }),
    }));
  });

  it("rejects export when no active preparation run exists", async () => {
    activeRun = null;
    const r = await resolver();
    await expect(
      r.Mutation.exportRestaurantConfigBackup(null, { input: { restaurantId } }, { user: { id: actorId } }),
    ).rejects.toThrow(/bắt đầu và lưu lần kiểm tra/i);
    expect(service.buildRestaurantConfigSnapshot).not.toHaveBeenCalled();
  });

  it("rejects export until the three pre-export checks are saved", async () => {
    activeRun.checklist.settingsReviewed = false;
    const r = await resolver();
    await expect(
      r.Mutation.exportRestaurantConfigBackup(null, { input: { restaurantId } }, { user: { id: actorId } }),
    ).rejects.toThrow(/3 việc bắt buộc/i);
    expect(service.buildRestaurantConfigSnapshot).not.toHaveBeenCalled();
  });

  it("marks file creation and the operator automatically after export", async () => {
    const r = await resolver();
    await r.Mutation.exportRestaurantConfigBackup(null, { input: { restaurantId } }, { user: { id: actorId } });
    expect(activeRun.checklist).toMatchObject({
      exportPrepared: true,
      operatorRecorded: true,
      safeCopyStored: false,
    });
    expect(activeRun.status).toBe("planned");
    expect(activeRun.save).toHaveBeenCalledTimes(1);
  });

  it("does not let create input fake automatic or post-export checks", async () => {
    const r = await resolver();
    await r.Mutation.createBackupRun(null, {
      input: {
        restaurantId,
        checklist: {
          reportsChecked: true,
          transactionsReconciled: true,
          settingsReviewed: true,
          exportPrepared: true,
          operatorRecorded: true,
          safeCopyStored: true,
        },
      },
    }, { user: { id: actorId } });
    expect(models.BackupRun.create).toHaveBeenCalledWith(expect.objectContaining({
      status: "planned",
      checklist: expect.objectContaining({
        reportsChecked: true,
        transactionsReconciled: true,
        settingsReviewed: true,
        exportPrepared: false,
        operatorRecorded: false,
        safeCopyStored: false,
      }),
    }));
  });

  it("allows safe-copy confirmation only after a file was exported", async () => {
    const r = await resolver();
    await r.Mutation.updateBackupRun(null, {
      input: {
        id: runId,
        restaurantId,
        checklist: { safeCopyStored: true, exportPrepared: true, operatorRecorded: true },
      },
    }, { user: { id: actorId } });
    expect(activeRun.checklist).toMatchObject({
      exportPrepared: false,
      operatorRecorded: false,
      safeCopyStored: false,
    });

    activeRun.checklist.exportPrepared = true;
    activeRun.checklist.operatorRecorded = true;
    await r.Mutation.updateBackupRun(null, {
      input: { id: runId, restaurantId, checklist: { safeCopyStored: true } },
    }, { user: { id: actorId } });
    expect(activeRun.checklist.safeCopyStored).toBe(true);
    expect(activeRun.status).toBe("checklist_completed");
    expect(activeRun.completedAt).toBeInstanceOf(Date);
  });

  it("keeps completed import history editable when its legacy checklist is partial", async () => {
    activeRun.status = "checklist_completed";
    activeRun.checklist = {
      reportsChecked: false,
      transactionsReconciled: false,
      settingsReviewed: true,
      exportPrepared: true,
      safeCopyStored: false,
      operatorRecorded: true,
    };
    const r = await resolver();
    const result = await r.Mutation.updateBackupRun(null, {
      input: { id: runId, restaurantId, note: "Đã kiểm tra lịch sử khôi phục" },
    }, { user: { id: actorId } });
    expect(result.status).toBe("checklist_completed");
    expect(result.note).toBe("Đã kiểm tra lịch sử khôi phục");
    expect(activeRun.save).toHaveBeenCalledTimes(1);
  });

  it("backupReadiness default scope does not claim runtime data backup", async () => {
    const r = await resolver();
    const result = await r.Query.backupReadiness(null, { restaurantId }, { user: { id: actorId, roleName: "manager" } });
    expect(result.scope).toMatchObject({
      ordersAndPayments: false,
      tablesAndFloorPlan: true,
      menuAndPricing: true,
      inventory: true,
      staffAndPermissions: false,
      schedules: true,
      customersAndPromotions: true,
      reportsAndReconciliation: false,
    });
  });

  it("preview import validates file base64", async () => {
    service.decodeSnapshotBase64.mockImplementationOnce(() => { throw new Error("Invalid base64 JSON"); });
    const r = await resolver();
    const result = await r.Mutation.previewRestaurantConfigImport(null, { input: { targetRestaurantId, fileContentBase64: "bad", mode: "clone" } }, { user: { id: actorId, roleName: "manager" } });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Invalid base64 JSON/);
  });

  it("import dryRun=false creates BackupRun/AuditLog", async () => {
    const r = await resolver();
    const result = await r.Mutation.importRestaurantConfigBackup(null, { input: { targetRestaurantId, fileContentBase64: base64, mode: "clone", dryRun: false } }, { user: { id: actorId, roleName: "manager" } });
    expect(result.success).toBe(true);
    expect(models.BackupRun.create).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: targetRestaurantId, status: "checklist_completed" }));
    expect(models.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: "CONFIG_BACKUP_IMPORTED" }));
    expect(result.backupRun).toEqual(expect.objectContaining({ id: "507f1f77bcf86cd799439099" }));
  });

  it("replace mode requires replaceExisting=true", async () => {
    service.importRestaurantConfigSnapshot.mockResolvedValueOnce({ success: false, dryRun: false, targetRestaurantId, mode: "replace", changes: [], warnings: [], errors: ["replace mode requires replaceExisting=true"] });
    const r = await resolver();
    await expect(r.Mutation.importRestaurantConfigBackup(null, { input: { targetRestaurantId, fileContentBase64: base64, mode: "replace", dryRun: false, replaceExisting: false } }, { user: { id: actorId, roleName: "manager" } })).rejects.toThrow(/replaceExisting/);
  });

  it("preview passes conflictResolutions to service", async () => {
    const conflictResolutions = [{ conflictId: "menuCatalog:MenuItem:PHO", resolution: "keep_target" }];
    const r = await resolver();
    await r.Mutation.previewRestaurantConfigImport(null, { input: { targetRestaurantId, fileContentBase64: base64, mode: "clone", conflictResolutions } }, { user: { id: actorId, roleName: "manager" } });
    expect(service.previewRestaurantConfigImport).toHaveBeenCalledWith(expect.objectContaining({ conflictResolutions }));
  });

  it("import passes conflictResolutions to service", async () => {
    const conflictResolutions = [{ conflictId: "menuCatalog:MenuItem:PHO", resolution: "use_source" }];
    const r = await resolver();
    await r.Mutation.importRestaurantConfigBackup(null, { input: { targetRestaurantId, fileContentBase64: base64, mode: "clone", dryRun: false, conflictResolutions } }, { user: { id: actorId, roleName: "manager" } });
    expect(service.importRestaurantConfigSnapshot).toHaveBeenCalledWith(expect.objectContaining({ conflictResolutions }));
  });

  it("AuditLog includes conflictCount/appliedResolutionCount", async () => {
    service.importRestaurantConfigSnapshot.mockResolvedValueOnce({ success: true, dryRun: false, targetRestaurantId, mode: "clone", changes: [], conflicts: [{ id: "c1" }], appliedResolutions: [{ conflictId: "c1", resolution: "keep_target" }], warnings: [], errors: [] });
    const r = await resolver();
    await r.Mutation.importRestaurantConfigBackup(null, { input: { targetRestaurantId, fileContentBase64: base64, mode: "clone", dryRun: false } }, { user: { id: actorId, roleName: "manager" } });
    expect(models.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: "CONFIG_BACKUP_IMPORTED",
      after: expect.objectContaining({ conflictCount: 1, appliedResolutionCount: 1 }),
    }));
    expect(models.BackupRun.create.mock.calls[0][0].note).toMatch(/Resolved conflicts: 1/);
  });
});
