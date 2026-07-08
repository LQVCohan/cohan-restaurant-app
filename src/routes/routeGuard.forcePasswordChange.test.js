import { describe, expect, it } from "vitest";
import { getRoleHomeRoute, resolveRoleName } from "./routeGuard";

describe("forced password change routing", () => {
  it("keeps temporary-password sessions behind the pending account gate", () => {
    const user = {
      roleName: "manager",
      status: "force_password_change",
      emailVerified: true,
    };

    const role = resolveRoleName(user);
    expect(role).toBe("pending_verification");
    expect(getRoleHomeRoute(role)).toBe("/verify-email");
  });
});
