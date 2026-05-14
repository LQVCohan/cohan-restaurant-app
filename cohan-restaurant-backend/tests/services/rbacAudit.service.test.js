import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("../../models/index.js", () => ({
  AuditLog: { create: createMock },
}));

vi.mock("mongoose", async () => {
  const actual = await vi.importActual("mongoose");
  return actual;
});

describe("rbacAudit.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes sanitized RBAC audit payloads with legacy compatibility fields", async () => {
    const { logRbacAudit } = await import("../../src/services/audit/rbacAudit.service.js");
    createMock.mockResolvedValue({ _id: "audit-1" });

    await logRbacAudit({
      ctx: {
        user: {
          id: "64f000000000000000000001",
          fullName: "Admin User",
          roleName: "admin",
        },
        request: { headers: { "user-agent": "vitest" } },
      },
      action: "ROLE_CREATED",
      targetType: "Role",
      targetId: "64f000000000000000000002",
      targetName: "Server",
      after: {
        _id: "64f000000000000000000002",
        name: "Server",
        slug: "server",
        password: "must-not-log",
        permissions: [{ _id: "64f000000000000000000003", code: "order.read" }],
      },
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const payload = createMock.mock.calls[0][0];
    expect(payload.action).toBe("ROLE_CREATED");
    expect(payload.module).toBe("rbac");
    expect(payload.entity).toBe("Role");
    expect(String(payload.entityId)).toBe("64f000000000000000000002");
    expect(String(payload.byUserId)).toBe("64f000000000000000000001");
    expect(payload.after).toMatchObject({ name: "Server", slug: "server" });
    expect(payload.after.password).toBeUndefined();
  });

  it("does not throw when audit persistence fails", async () => {
    const { logRbacAudit } = await import("../../src/services/audit/rbacAudit.service.js");
    createMock.mockRejectedValue(new Error("db down"));

    await expect(logRbacAudit({
      ctx: { user: { id: "64f000000000000000000001", roleName: "admin" } },
      action: "ROLE_UPDATED",
      targetType: "Role",
      targetId: "64f000000000000000000002",
    })).resolves.toBeNull();
  });
});
