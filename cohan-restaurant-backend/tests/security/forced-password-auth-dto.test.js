import { describe, expect, it } from "vitest";
import { sanitizeAuthUser } from "../../src/security/userDtos.js";

describe("temporary password auth DTO", () => {
  it("marks the session for a required password change without exposing the flag", () => {
    const result = sanitizeAuthUser({
      _id: "user-1",
      status: "active",
      role: { slug: "manager" },
      forcePasswordChange: true,
    });

    expect(result.status).toBe("force_password_change");
    expect(result.forcePasswordChange).toBeUndefined();
  });
});
