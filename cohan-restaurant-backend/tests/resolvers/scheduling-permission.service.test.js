import { describe, expect, it } from "vitest";
import { resolveUserRoles, userHasAnyRole, SHIFT_ACK_READ_ROLES } from "../../src/services/scheduling/schedulingPermission.service.js";

describe("scheduling permission service", () => {
  it("normalizes user roles from userType/roleName/role.slug/roles", () => {
    const roles = resolveUserRoles({ userType: "accountant", roleName: "Hr", role: { slug: "manager" }, roles: ["admin"] });
    expect(roles).toEqual(expect.arrayContaining(["ACCOUNTANT", "HR", "MANAGER", "ADMIN"]));
  });

  it("matches allowed roles case-insensitively", () => {
    expect(userHasAnyRole({ roleName: "accountant" }, SHIFT_ACK_READ_ROLES)).toBe(true);
    expect(userHasAnyRole({ userType: "staff" }, SHIFT_ACK_READ_ROLES)).toBe(false);
  });
});
