import { describe, it, expect, vi, beforeEach } from "vitest";

const auditCreate = vi.fn();

vi.mock("../../models/index.js", () => ({
  AuditLog: { create: auditCreate },
}));

describe("adminSensitiveAccess.service", () => {
  beforeEach(() => auditCreate.mockReset().mockResolvedValue({ _id: "audit-1" }));

  it("rejects system admin without strong verification", async () => {
    const { requireAdminSensitiveAccess, SENSITIVE_ACCESS } = await import("../../src/services/auth/adminSensitiveAccess.service.js");
    await expect(requireAdminSensitiveAccess({
      user: { id: "507f1f77bcf86cd799439011", roleName: "admin", status: "active", emailVerified: false },
      headers: { "x-admin-access-reason": "support ticket" },
    }, { category: SENSITIVE_ACCESS.CUSTOMER_CONTACT, resourceType: "User", resourceId: "list" })).rejects.toThrow("Admin cần xác thực");
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("rejects verified system admin without reason", async () => {
    const { requireAdminSensitiveAccess, SENSITIVE_ACCESS } = await import("../../src/services/auth/adminSensitiveAccess.service.js");
    await expect(requireAdminSensitiveAccess({
      user: { id: "507f1f77bcf86cd799439011", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true },
      headers: {},
    }, { category: SENSITIVE_ACCESS.CUSTOMER_CONTACT, resourceType: "User", resourceId: "list" })).rejects.toThrow("reason is required");
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("allows verified admin with reason and writes safe audit metadata", async () => {
    const { requireAdminSensitiveAccess, SENSITIVE_ACCESS } = await import("../../src/services/auth/adminSensitiveAccess.service.js");
    await expect(requireAdminSensitiveAccess({
      user: { id: "507f1f77bcf86cd799439011", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true, role: { permissions: [{ code: "admin.sensitive.customer_contact.read" }] } },
      headers: { "x-admin-access-reason": "ticket-123", "user-agent": "vitest" },
      ip: "127.0.0.1",
    }, { category: SENSITIVE_ACCESS.CUSTOMER_CONTACT, resourceType: "User", resourceId: "list" })).resolves.toBe(true);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0]).toMatchObject({
      action: "admin.sensitive.customer_contact.read",
      module: "admin_sensitive_access",
      metadata: expect.objectContaining({ category: "customer_contact", reason: "ticket-123" }),
      userAgent: "vitest",
    });
    expect(JSON.stringify(auditCreate.mock.calls[0][0])).not.toContain("safe@example.com");
  });

  it("rejects admin without explicit sensitive permission despite admin roleName", async () => {
    const { requireAdminSensitiveAccess, SENSITIVE_ACCESS } = await import("../../src/services/auth/adminSensitiveAccess.service.js");
    await expect(requireAdminSensitiveAccess({
      user: { id: "507f1f77bcf86cd799439011", roleName: "admin", status: "active", emailVerified: true, phoneVerified: true, role: { permissions: [] } },
      headers: { "x-admin-access-reason": "ticket-123" },
    }, { category: SENSITIVE_ACCESS.CUSTOMER_CONTACT, resourceType: "User", resourceId: "list" })).rejects.toThrow("FORBIDDEN");
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("masks contact and wallet fields", async () => {
    const { maskUserSensitiveFields } = await import("../../src/services/auth/adminSensitiveAccess.service.js");
    const out = maskUserSensitiveFields({ email: "leminh@gmail.com", phone: "0987654389", wallet: { balance: 99, currency: "VND" }, taxCode: "123" });
    expect(out.email).toBe("le***@gmail.com");
    expect(out.phone).toBe("09******89");
    expect(out.wallet.balance).toBeNull();
    expect(out.taxCode).toBe("masked");
  });

  it("does not treat Brand admin membership as system admin", async () => {
    const { isStronglyVerifiedAdmin } = await import("../../src/services/auth/adminSensitiveAccess.service.js");
    expect(isStronglyVerifiedAdmin({ roleName: "manager", userType: "STAFF", brandMemberships: [{ role: "admin" }], status: "active", emailVerified: true })).toBe(false);
  });
});
