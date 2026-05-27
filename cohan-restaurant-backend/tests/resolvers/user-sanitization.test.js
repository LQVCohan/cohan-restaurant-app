import { describe, it, expect } from "vitest";
import { sanitizeUserForClient } from "../../src/security/sanitizeUserForClient.js";

describe("sanitizeUserForClient", () => {
  it("removes sensitive fields and preserves safe ones", () => {
    const user = {
      _id: "u1", fullName: "Jane", email: "j@e.com", passwordHash: "hash", emailVerifyToken: "tok", deletedAt: new Date(),
      role: { _id: "r1", name: "Admin", slug: "admin", permissions: ["a"], internal: "x" },
      wallet: { provider: "internal", currency: "VND", balance: 1, secret: "nope" },
    };
    const out = sanitizeUserForClient(user);
    expect(out.passwordHash).toBeUndefined();
    expect(out.emailVerifyToken).toBeUndefined();
    expect(out.deletedAt).toBeUndefined();
    expect(out.fullName).toBe("Jane");
    expect(out.roleName).toBe("admin");
    expect(out.role.internal).toBeUndefined();
  });

  it("preserves refRestaurants and strips sensitive fields from raw lean graph user", () => {
    const out = sanitizeUserForClient({
      _id: "u2",
      fullName: "Graph User",
      email: "graph@example.com",
      passwordHash: "secret-hash",
      emailVerifyToken: "verify-token",
      deletedBy: "admin1",
      refRestaurants: [{ _id: "r1", name: "R1" }],
      role: { _id: "rid", slug: "manager", name: "Manager", permissions: ["read"], internalFlag: true },
    });
    expect(out.passwordHash).toBeUndefined();
    expect(out.emailVerifyToken).toBeUndefined();
    expect(out.deletedBy).toBeUndefined();
    expect(out.refRestaurants).toEqual([{ _id: "r1", name: "R1" }]);
    expect(out.roleName).toBe("manager");
  });

});
