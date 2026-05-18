import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  AuditLog: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
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

function auditFindQuery(items = []) {
  const query = {
    sort: vi.fn(() => query),
    skip: vi.fn(() => query),
    limit: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(items),
  };
  return query;
}

const managerCtx = { user: { id: "manager-1", roleName: "manager" } };
const adminCtx = { user: { id: "admin-1", roleName: "admin" } };

describe("auditLogs resolver MenuManagement permissions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(true);
    guardMocks.requireRoles.mockReturnValue(true);
    authzMocks.requireAnyPermission.mockResolvedValue(true);
    modelMocks.AuditLog.find.mockReturnValue(auditFindQuery([{ _id: "audit-1" }]));
    modelMocks.AuditLog.countDocuments.mockResolvedValue(1);
  });

  it("requires restaurant scope and menu audit permission for restaurant audit logs", async () => {
    const resolver = (await import("../../graphql/resolvers/audit_log/index.js")).default;

    const result = await resolver.Query.auditLogs(
      null,
      {
        filter: {
          restaurantId: "507f1f77bcf86cd799439011",
          entity: "Menu",
          entityId: "507f1f77bcf86cd799439012",
        },
        limit: 20,
        offset: 0,
      },
      managerCtx,
    );

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      managerCtx,
      "507f1f77bcf86cd799439011",
    );
    expect(authzMocks.requireAnyPermission).toHaveBeenCalledWith(managerCtx, [
      "menu.audit.read",
      "log.read",
      "menu.write",
    ]);
    expect(modelMocks.AuditLog.find).toHaveBeenCalledWith({
      restaurantId: "507f1f77bcf86cd799439011",
      entity: "Menu",
      entityId: "507f1f77bcf86cd799439012",
    });
  });

  it("blocks restaurant audit logs when menu audit permission is missing", async () => {
    authzMocks.requireAnyPermission.mockRejectedValue(new Error("FORBIDDEN"));
    const resolver = (await import("../../graphql/resolvers/audit_log/index.js")).default;

    await expect(
      resolver.Query.auditLogs(
        null,
        { filter: { restaurantId: "507f1f77bcf86cd799439011" }, limit: 20, offset: 0 },
        managerCtx,
      ),
    ).rejects.toThrow("FORBIDDEN");

    expect(modelMocks.AuditLog.find).not.toHaveBeenCalled();
  });

  it("keeps global audit log access admin-only", async () => {
    const resolver = (await import("../../graphql/resolvers/audit_log/index.js")).default;

    await resolver.Query.auditLogs(null, { filter: {}, limit: 20, offset: 0 }, adminCtx);

    expect(guardMocks.requireRoles).toHaveBeenCalledWith(adminCtx, ["ADMIN"]);
    expect(authzMocks.requireAnyPermission).not.toHaveBeenCalled();
  });

  it("rejects invalid restaurantId before permission lookup", async () => {
    const resolver = (await import("../../graphql/resolvers/audit_log/index.js")).default;

    await expect(
      resolver.Query.auditLogs(
        null,
        { filter: { restaurantId: "bad-id" }, limit: 20, offset: 0 },
        managerCtx,
      ),
    ).rejects.toThrow("Invalid restaurantId");

    expect(authzMocks.requireAnyPermission).not.toHaveBeenCalled();
    expect(modelMocks.AuditLog.find).not.toHaveBeenCalled();
  });
});
