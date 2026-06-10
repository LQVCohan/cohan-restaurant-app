import { beforeEach, describe, expect, it, vi } from "vitest";

const authz = vi.hoisted(() => ({ requireAnyPermission: vi.fn(), requirePermission: vi.fn() }));
const guards = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const models = vi.hoisted(() => ({
  AuditLog: { create: vi.fn() },
  Restaurant: { findById: vi.fn() },
  SystemSetting: { findOne: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn() },
}));

vi.mock("../../../src/services/auth/authorization.service.js", () => authz);
vi.mock("../../../graphql/guards.js", () => guards);
vi.mock("../../../models/index.js", () => models);

const restaurantId = "507f1f77bcf86cd799439011";
const actorId = "507f1f77bcf86cd799439012";
const lean = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const doc = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439099",
  restaurantId,
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  dateFormat: "DD/MM/YYYY",
  operational: { businessDayStartHour: 6, defaultLanguage: "vi" },
  modules: { scheduling: true, rbac: true, printing: true, backup: true },
  metadata: { version: 1, note: "old" },
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  toObject() { return { ...this }; },
  ...overrides,
});

async function resolver() {
  return (await import("../../../graphql/resolvers/systemSetting/index.js")).default;
}

describe("systemSetting resolver", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authz.requireAnyPermission.mockResolvedValue(true);
    authz.requirePermission.mockResolvedValue(true);
    guards.requireRestaurantAccess.mockResolvedValue(true);
    models.Restaurant.findById.mockReturnValue(lean({ _id: restaurantId, name: "Cohan" }));
    models.SystemSetting.findOne.mockResolvedValue(doc());
    models.SystemSetting.create.mockResolvedValue(doc());
    models.SystemSetting.findOneAndUpdate.mockResolvedValue(doc({ metadata: { version: 2, note: "new" } }));
    models.AuditLog.create.mockResolvedValue({});
  });

  it("systemSetting query requires restaurant.read or system.manage and valid restaurant access", async () => {
    const r = await resolver();
    await r.Query.systemSetting(null, { restaurantId }, { user: { id: actorId, role: { permissions: [{ code: "restaurant.read" }] } } });
    expect(authz.requireAnyPermission).toHaveBeenCalledWith(expect.any(Object), ["system.manage", "restaurant.read"]);
    expect(guards.requireRestaurantAccess).toHaveBeenCalledWith(expect.any(Object), restaurantId);
  });

  it("updateSystemSetting requires system.manage", async () => {
    const r = await resolver();
    await r.Mutation.updateSystemSetting(null, { input: { restaurantId, timezone: "UTC" } }, { user: { id: actorId, role: { permissions: [{ code: "system.manage" }] } } });
    expect(authz.requirePermission).toHaveBeenCalledWith(expect.any(Object), "system.manage");
    expect(guards.requireRestaurantAccess).toHaveBeenCalledWith(expect.any(Object), restaurantId);
  });

  it("rejects businessDayStartHour outside 0-23", async () => {
    const r = await resolver();
    await expect(r.Mutation.updateSystemSetting(null, { input: { restaurantId, operational: { businessDayStartHour: 24 } } }, { user: { id: actorId } })).rejects.toThrow(/between 0 and 23/);
  });

  it("increments metadata.version", async () => {
    const r = await resolver();
    await r.Mutation.updateSystemSetting(null, { input: { restaurantId, currency: "USD" } }, { user: { id: actorId } });
    expect(models.SystemSetting.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ $inc: { "metadata.version": 1 } }), expect.any(Object));
  });

  it("writes SYSTEM_SETTING_UPDATED audit log", async () => {
    const r = await resolver();
    await r.Mutation.updateSystemSetting(null, { input: { restaurantId, note: "new" } }, { user: { id: actorId } });
    expect(models.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: "SYSTEM_SETTING_UPDATED", before: expect.any(Object), after: expect.any(Object) }));
  });
});
