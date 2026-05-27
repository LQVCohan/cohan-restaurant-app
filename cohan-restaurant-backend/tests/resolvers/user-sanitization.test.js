import { describe, it, expect } from "vitest";
import { sanitizeUserForClient } from "../../src/security/sanitizeUserForClient.js";

describe("sanitizeUserForClient", () => {
  it("preserves emailVerified true/false and safe profile fields", () => {
    const verified = sanitizeUserForClient({
      _id: "u1",
      fullName: "Verified User",
      emailVerified: true,
      employmentType: "full-time",
      department: "ops",
      positionTitle: "manager",
    });

    const unverified = sanitizeUserForClient({
      _id: "u2",
      fullName: "Unverified User",
      emailVerified: false,
    });

    expect(verified.emailVerified).toBe(true);
    expect(unverified.emailVerified).toBe(false);
    expect(unverified).toHaveProperty("emailVerified", false);
    expect(verified.employmentType).toBe("full-time");
    expect(verified.department).toBe("ops");
    expect(verified.positionTitle).toBe("manager");
  });

  it("preserves wallet fields needed by frontend", () => {
    const out = sanitizeUserForClient({
      _id: "u3",
      wallet: {
        provider: "internal",
        status: false,
        balance: 10,
        currency: "USD",
        updatedAt: "2026-05-27T00:00:00.000Z",
        secret: "hidden",
      },
    });

    expect(out.wallet).toEqual({
      provider: "internal",
      status: false,
      balance: 10,
      currency: "USD",
      updatedAt: "2026-05-27T00:00:00.000Z",
    });
    expect(out.wallet.secret).toBeUndefined();
  });

  it("removes sensitive auth/deletion fields", () => {
    const out = sanitizeUserForClient({
      _id: "u4",
      fullName: "Jane",
      passwordHash: "hash",
      emailVerifyToken: "tok",
      emailVerifyTokenExp: new Date(),
      emailVerifyLastSentAt: new Date(),
      deletedAt: new Date(),
      deleteExpiresAt: new Date(),
      deletedBy: "admin",
      _generatedPassword: "tmp",
      role: { _id: "r1", name: "Admin", slug: "admin", permissions: ["a"], internal: "x" },
    });

    expect(out.passwordHash).toBeUndefined();
    expect(out.emailVerifyToken).toBeUndefined();
    expect(out.emailVerifyTokenExp).toBeUndefined();
    expect(out.emailVerifyLastSentAt).toBeUndefined();
    expect(out.deletedAt).toBeUndefined();
    expect(out.deleteExpiresAt).toBeUndefined();
    expect(out.deletedBy).toBeUndefined();
    expect(out._generatedPassword).toBeUndefined();
    expect(out.role.internal).toBeUndefined();
  });
});
