import { describe, expect, it } from "vitest";
import { getRoleHomeRoute, resolveRoleName } from "./routeGuard";
import { getDefaultPathForRole } from "@/utils/frontendRoleAccess";

const PASSWORD_CHANGE_PATH = "/verify-account/confirm?forcePasswordChange=1";

describe("forced password change routing", () => {
  it("routes temporary-password sessions to the required password form", () => {
    const user = {
      roleName: "manager",
      status: "force_password_change",
      emailVerified: true,
    };

    const role = resolveRoleName(user);
    expect(role).toBe("force_password_change");
    expect(getRoleHomeRoute(role)).toBe(PASSWORD_CHANGE_PATH);
    expect(getDefaultPathForRole(role)).toBe(PASSWORD_CHANGE_PATH);
  });
});
