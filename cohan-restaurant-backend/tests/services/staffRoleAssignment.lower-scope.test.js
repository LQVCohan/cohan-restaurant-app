import { describe, expect, it } from "vitest";
import { assertAssignableStaffRole } from "../../src/services/auth/staffRoleAssignment.service.js";

const staffParent = { slug: "staff", permissions: [] };

describe("assignable staff role hierarchy", () => {
  it("allows manager to assign staff-derived roles with seeded permissions", () => {
    expect(() => assertAssignableStaffRole({
      actor: { id: "manager-1", roleName: "manager" },
      role: {
        slug: "supervisor",
        parentRole: staffParent,
        permissions: [
          { code: "table.write" },
          { code: "staff.read" },
          { code: "reservation.read" },
          { code: "reservation.update" },
        ],
      },
    })).not.toThrow();
  });

  it("rejects a non-staff-derived role even for an admin assignment", () => {
    expect(() => assertAssignableStaffRole({
      actor: { id: "admin-1", roleName: "admin" },
      role: {
        slug: "customer-support",
        parentRole: { slug: "customer", permissions: [] },
        permissions: [],
      },
    })).toThrow("Only staff-derived roles can be assigned to staff");
  });

  it("still rejects protected system roles", () => {
    expect(() => assertAssignableStaffRole({
      actor: { id: "manager-1", roleName: "manager" },
      role: {
        slug: "admin",
        parentRole: { slug: "admin", permissions: [] },
        permissions: [{ code: "system.manage" }],
      },
    })).toThrow("Protected system role cannot be assigned to staff");
  });
});
