import { describe, it, expect } from "vitest";
import { buildAdminUserPayload } from "../../scripts/seed-admin.js";

describe("seed-admin payload", () => {
  it("uses ObjectId role value instead of array", () => {
    const payload = buildAdminUserPayload({ email: "a@b.com", passwordHash: "h", adminRoleId: "role1" });
    expect(Array.isArray(payload.role)).toBe(false);
    expect(payload.role).toBe("role1");
  });

  it("creates an active verified local admin account", () => {
    const payload = buildAdminUserPayload({ email: "a@b.com", passwordHash: "h", adminRoleId: "role1" });
    expect(payload.status).toBe("active");
    expect(payload.provider).toBe("local");
    expect(payload.userType).toBe("ADMIN");
    expect(payload.emailVerified).toBe(true);
    expect(payload.verifiedAt).toBeInstanceOf(Date);
    expect(payload.forcePasswordChange).toBe(false);
  });
});
