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
vi.mock("mongoose", () => ({ default: { isValidObjectId: vi.fn(() => true) } }));

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
const staffCtx = { user: { id: "staff-1", roleName: "staff", restaurantForStaff: "restaurant-1" } };

describe("rbacAuditLogs query access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authzMocks.requireAnyPermission.mockResolvedValue(true);
    guardMocks.requireRestaurantAccess.mockResolvedValue(true);
    modelMocks.AuditLog.find.mockReturnValue(auditFindQuery([{ _id: "audit-1", action: "ROLE_CREATED" }]));
  });

  it("allows admin to view global RBAC audit logs", async () => {
    const resolver = (await import("../../graphql/resolvers/audit_log/index.js")).default;
    const logs = await resolver.Query.rbacAuditLogs(null, { filter: {}, limit: 50, offset: 0 }, adminCtx);
    expect(logs).toHaveLength(1);
    expect(modelMocks.AuditLog.find).toHaveBeenCalledWith({ module: "rbac" });
  });

  it("allows manager only inside restaurant scope", async () => {
    const resolver = (await import("../../graphql/resolvers/audit_log/index.js")).default;
    await resolver.Query.rbacAuditLogs(null, { filter: { restaurantId: "restaurant-1" }, limit: 50, offset: 0 }, managerCtx);
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(managerCtx, "restaurant-1");
  });

  it("blocks manager when restaurantId is missing", async () => {
    const resolver = (await import("../../graphql/resolvers/audit_log/index.js")).default;
    await expect(resolver.Query.rbacAuditLogs(null, { filter: {}, limit: 50, offset: 0 }, managerCtx)).rejects.toThrow("FORBIDDEN");
  });

  it("blocks staff users", async () => {
    const resolver = (await import("../../graphql/resolvers/audit_log/index.js")).default;
    await expect(resolver.Query.rbacAuditLogs(null, { filter: { restaurantId: "restaurant-1" }, limit: 50, offset: 0 }, staffCtx)).rejects.toThrow("FORBIDDEN");
  });
});
