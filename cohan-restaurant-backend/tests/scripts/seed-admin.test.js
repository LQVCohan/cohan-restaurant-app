import { describe, it, expect } from "vitest";
import { buildAdminUserPayload } from "../../scripts/seed-admin.js";

describe("seed-admin payload", () => {
  it("uses ObjectId role value instead of array", () => {
    const payload = buildAdminUserPayload({ email: "a@b.com", passwordHash: "h", adminRoleId: "role1" });
    expect(Array.isArray(payload.role)).toBe(false);
    expect(payload.role).toBe("role1");
  });
});
