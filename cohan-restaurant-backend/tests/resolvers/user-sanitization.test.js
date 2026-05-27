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
});
