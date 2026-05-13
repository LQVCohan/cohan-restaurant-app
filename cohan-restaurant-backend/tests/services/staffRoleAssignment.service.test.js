import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Role: { findById: vi.fn() },
  Staff: { findById: vi.fn() },
  Restaurant: { exists: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);

function roleQuery(role) {
  const query = {
    populate: vi.fn(() => query),
    lean: vi.fn().mockResolvedValue(role),
  };
  return query;
}

function staffDoc(overrides = {}) {
  return {
    _id: "staff-1",
    userType: "STAFF",
    deletedAt: null,
    restaurantForStaff: "restaurant-1",
    role: null,
    save: vi.fn().mockResolvedValue(true),
    populate: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("staffRoleAssignment.service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("allows manager with staff.write in restaurant scope to assign a whitelisted staff role", async () => {
    const staff = staffDoc();
    modelMocks.Staff.findById.mockResolvedValue(staff);
    modelMocks.Role.findById.mockReturnValue(roleQuery({
      _id: "role-server",
      slug: "server",
      parentRole: { slug: "staff", permissions: [] },
      permissions: [{ code: "menu.read" }, { code: "order.create" }],
    }));

    const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

    const result = await assignStaffRoleWithinRestaurant({
      actor: { id: "manager-1", roleName: "manager", refRestaurants: ["restaurant-1"] },
      staffUserId: "staff-1",
      roleId: "role-server",
      restaurantId: "restaurant-1",
    });

    expect(result).toBe(staff);
    expect(staff.role).toBe("role-server");
    expect(staff.save).toHaveBeenCalled();
  });

  it("blocks manager from assigning protected system roles to staff", async () => {
    modelMocks.Staff.findById.mockResolvedValue(staffDoc());
    modelMocks.Role.findById.mockReturnValue(roleQuery({
      _id: "role-admin",
      slug: "admin",
      parentRole: { slug: "admin", permissions: [] },
      permissions: [{ code: "system.manage" }],
    }));

    const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

    await expect(assignStaffRoleWithinRestaurant({
      actor: { id: "manager-1", roleName: "manager", refRestaurants: ["restaurant-1"] },
      staffUserId: "staff-1",
      roleId: "role-admin",
      restaurantId: "restaurant-1",
    })).rejects.toThrow("Protected system role");
  });

  it("allows manager to assign storekeeper with inventory, stock, and supplier permissions", async () => {
    const staff = staffDoc();
    modelMocks.Staff.findById.mockResolvedValue(staff);
    modelMocks.Role.findById.mockReturnValue(roleQuery({
      _id: "role-storekeeper",
      slug: "storekeeper",
      parentRole: { slug: "staff", permissions: [] },
      permissions: [
        { code: "inventory.read" },
        { code: "inventory.write" },
        { code: "stock.read" },
        { code: "stock.write" },
        { code: "supplier.read" },
        { code: "supplier.write" },
      ],
    }));

    const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

    await expect(assignStaffRoleWithinRestaurant({
      actor: { id: "manager-1", roleName: "manager", refRestaurants: ["restaurant-1"] },
      staffUserId: "staff-1",
      roleId: "role-storekeeper",
      restaurantId: "restaurant-1",
    })).resolves.toBe(staff);
    expect(staff.role).toBe("role-storekeeper");
    expect(staff.save).toHaveBeenCalled();
  });

  it("blocks manager from assigning roles with sensitive system permissions", async () => {
    for (const code of ["role.write", "permission.write", "config.write", "system.manage"]) {
      modelMocks.Staff.findById.mockResolvedValue(staffDoc());
      modelMocks.Role.findById.mockReturnValue(roleQuery({
        _id: `role-${code}`,
        slug: "custom-staff-role",
        parentRole: { slug: "staff", permissions: [] },
        permissions: [{ code }],
      }));

      const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

      await expect(assignStaffRoleWithinRestaurant({
        actor: { id: "manager-1", roleName: "manager", refRestaurants: ["restaurant-1"] },
        staffUserId: "staff-1",
        roleId: `role-${code}`,
        restaurantId: "restaurant-1",
      })).rejects.toThrow("Manager cannot assign permissions");

      vi.resetModules();
      vi.clearAllMocks();
    }
  });

  it("allows admin to bypass manager assignment whitelist", async () => {
    const staff = staffDoc();
    modelMocks.Staff.findById.mockResolvedValue(staff);
    modelMocks.Role.findById.mockReturnValue(roleQuery({
      _id: "role-storekeeper",
      slug: "storekeeper",
      parentRole: { slug: "staff", permissions: [] },
      permissions: [{ code: "inventory.write" }],
    }));

    const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

    await expect(assignStaffRoleWithinRestaurant({
      actor: { id: "admin-1", roleName: "admin" },
      staffUserId: "staff-1",
      roleId: "role-storekeeper",
      restaurantId: "restaurant-1",
    })).resolves.toBe(staff);
    expect(staff.role).toBe("role-storekeeper");
  });
});
