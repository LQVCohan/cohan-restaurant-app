import { describe, expect, it } from "vitest";
import { hasRole } from "../../utils/authz.js";

describe("legacy authz role resolution", () => {
  it("recognizes a system role from userType", () => {
    expect(
      hasRole({ userType: "ADMIN", roleName: "owner" }, ["admin"]),
    ).toBe(true);
  });

  it("keeps specialized staff role matching", () => {
    const user = { userType: "STAFF", roleName: "server" };

    expect(hasRole(user, ["server"])).toBe(true);
    expect(hasRole(user, ["staff"])).toBe(true);
  });
});
