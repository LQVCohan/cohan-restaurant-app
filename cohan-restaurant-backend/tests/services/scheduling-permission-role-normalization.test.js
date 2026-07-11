import { describe, expect, it } from "vitest";
import {
  resolveUserRoles,
  userHasAnyRole,
} from "../../src/services/scheduling/schedulingPermission.service.js";

describe("scheduling permission role normalization", () => {
  it("accepts every authenticated role shape used by manager and staff accounts", () => {
    expect(resolveUserRoles({ roleSlug: "manager" })).toContain("MANAGER");
    expect(resolveUserRoles({ role: "admin" })).toContain("ADMIN");
    expect(resolveUserRoles({ role: { name: "Human Resources" } })).toContain(
      "HUMAN RESOURCES",
    );
    expect(resolveUserRoles({ role: { slug: "accountant" } })).toContain(
      "ACCOUNTANT",
    );
    expect(resolveUserRoles({ userType: "staff" })).toContain("STAFF");
  });

  it("keeps role checks case-insensitive", () => {
    expect(userHasAnyRole({ roleSlug: "manager" }, ["MANAGER"])).toBe(true);
    expect(userHasAnyRole({ role: "ADMIN" }, ["admin"])).toBe(true);
  });
});
