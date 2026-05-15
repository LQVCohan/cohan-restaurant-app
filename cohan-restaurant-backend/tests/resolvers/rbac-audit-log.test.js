import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  AuditLog: { find: vi.fn() },
}));
const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
}));
const authzMocks = vi.hoisted(() => ({
  requireAnyPermission: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authzMocks);
vi.mock("../../utils/authz.js", () => ({
  hasRole: vi.fn((user, roles) => roles.map((role) => String(role).toLowerCase()).includes(String(user?.roleName || "").toLowerCase())),
}));

function auditFindQuery(items = []) {
  const query = {
    sort: vi.fn(() => query),
    skip: vi.fn(() => query),
    limit: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(items),
  };
  return query;
}

const adminCtx = { user: { id: "admin-1", roleName: "admin" } };
const managerCtx = { user: { id: "manager-1", roleName: "manager", refRestaurants: ["restaurant-1"] } };
const staffCtx = { user: { id: "staff-1", roleName: "staff" } };
const customerCtx = { user: { id: "customer-1", roleName: "customer" } };

describe("rbacAuditLogs resolver", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(true);
    authzMocks.requireAnyPermission.mockResolvedValue(true);
    modelMocks.AuditLog.find.mockReturnValue(auditFindQuery([{ _id: "audit-1", action: "ROLE_CREATED" }]));
  });

  it("allows admin to view global rbac logs", async () => {
    const { rbacAuditLogs } = await import("../../graphql/resolvers/audit_log/rbac.js");
    const logs = await rbacAuditLogs(null, { filter: {}, limit: 50, offset: 0 }, adminCtx);
    expect(logs).toHaveLength(1);
    expect(guardMocks.requireRoles).toHaveBeenCalledWith(adminCtx, ["ADMIN"]);
    expect(modelMocks.AuditLog.find).toHaveBeenCalledWith({ module: "rbac" });
  });

  it("requires manager to pass restaurantId", async () => {
    const { rbacAuditLogs } = await import("../../graphql/resolvers/audit_log/rbac.js");
    await expect(rbacAuditLogs(null, { filter: {}, limit: 50, offset: 0 }, managerCtx)).rejects.toThrow("FORBIDDEN");
  });

  it("allows manager in restaurant scope with an allowed permission", async () => {
    const { rbacAuditLogs } = await import("../../graphql/resolvers/audit_log/rbac.js");
    await rbacAuditLogs(null, { filter: { restaurantId: "restaurant-1" }, limit: 50, offset: 0 }, managerCtx);
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(managerCtx, "restaurant-1");
    expect(authzMocks.requireAnyPermission).toHaveBeenCalledWith(managerCtx, ["role.read", "permission.read", "staff.write"]);
    expect(modelMocks.AuditLog.find).toHaveBeenCalledWith({ module: "rbac", restaurantId: "restaurant-1" });
  });

  it("blocks manager outside restaurant scope", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN"));
    const { rbacAuditLogs } = await import("../../graphql/resolvers/audit_log/rbac.js");
    await expect(rbacAuditLogs(null, { filter: { restaurantId: "restaurant-2" }, limit: 50, offset: 0 }, managerCtx)).rejects.toThrow("FORBIDDEN");
  });

  it("rejects module override through rbacAuditLogs", async () => {
    const { rbacAuditLogs } = await import("../../graphql/resolvers/audit_log/rbac.js");
    await expect(rbacAuditLogs(null, { filter: { module: "order" }, limit: 50, offset: 0 }, adminCtx)).rejects.toThrow("rbacAuditLogs only supports module rbac");
    expect(modelMocks.AuditLog.find).not.toHaveBeenCalled();
  });

  it("blocks staff and customers", async () => {
    const { rbacAuditLogs } = await import("../../graphql/resolvers/audit_log/rbac.js");
    await expect(rbacAuditLogs(null, { filter: { restaurantId: "restaurant-1" }, limit: 50, offset: 0 }, staffCtx)).rejects.toThrow("FORBIDDEN");
    await expect(rbacAuditLogs(null, { filter: { restaurantId: "restaurant-1" }, limit: 50, offset: 0 }, customerCtx)).rejects.toThrow("FORBIDDEN");
  });
});
