import { describe, expect, it } from "vitest";
import { hasAnyPermission, hasPermission } from "./frontendPermissionAccess";

describe("manager RBAC access", () => {
  it("lets a manager open role create and update controls", () => {
    const manager = { roleName: "manager" };

    expect(hasPermission(manager, "role.read")).toBe(true);
    expect(hasPermission(manager, "role.write")).toBe(true);
    expect(hasAnyPermission(manager, ["role.write", "permission.write"])).toBe(true);
  });

  it("does not let a manager edit permission definitions", () => {
    expect(hasPermission({ roleName: "manager" }, "permission.write")).toBe(false);
  });

  it("keeps lower roles without role write access", () => {
    for (const roleName of ["hr", "accountant", "staff", "server", "customer"]) {
      expect(hasPermission({ roleName }, "role.write")).toBe(false);
    }
  });
});
