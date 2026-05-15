import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("../../models/index.js", () => ({
  AuditLog: { create: createMock },
}));

describe("rbacAudit.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates an AuditLog with module rbac and legacy compatibility fields", async () => {
    createMock.mockResolvedValue({ _id: "audit-1" });
    const { logRbacAudit } = await import("../../src/services/audit/rbacAudit.service.js");

    await logRbacAudit({
      ctx: { user: { id: "64f000000000000000000001", fullName: "Admin", roleName: "admin" } },
      action: "ROLE_CREATED",
      targetType: "Role",
      targetId: "64f000000000000000000002",
      targetName: "Server",
      after: { _id: "64f000000000000000000002", name: "Server", slug: "server" },
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "ROLE_CREATED",
      module: "rbac",
      targetType: "Role",
      targetName: "Server",
      entity: "Role",
      diff: expect.objectContaining({ after: expect.objectContaining({ name: "Server" }) }),
    }));
  });

  it("sanitizes passwords and tokens from payloads", async () => {
    createMock.mockResolvedValue({ _id: "audit-1" });
    const { logRbacAudit } = await import("../../src/services/audit/rbacAudit.service.js");

    await logRbacAudit({
      ctx: { user: { id: "64f000000000000000000001", roleName: "admin" } },
      action: "PERMISSION_UPDATED",
      targetType: "Permission",
      targetId: "64f000000000000000000003",
      before: { name: "Before", password: "secret", token: "token" },
      after: { name: "After", accessToken: "access", refreshToken: "refresh" },
      metadata: { safe: true, authorization: "Bearer token" },
    });

    const payload = createMock.mock.calls[0][0];
    expect(payload.before.password).toBeUndefined();
    expect(payload.before.token).toBeUndefined();
    expect(payload.after.accessToken).toBeUndefined();
    expect(payload.after.refreshToken).toBeUndefined();
    expect(payload.metadata.authorization).toBeUndefined();
    expect(payload.metadata.safe).toBe(true);
  });

  it("does not throw when AuditLog.create fails", async () => {
    createMock.mockRejectedValue(new Error("db down"));
    const { logRbacAudit } = await import("../../src/services/audit/rbacAudit.service.js");

    await expect(logRbacAudit({
      ctx: { user: { id: "64f000000000000000000001", roleName: "admin" } },
      action: "ROLE_UPDATED",
      targetType: "Role",
      targetId: "64f000000000000000000002",
    })).resolves.toBeNull();
  });
});
