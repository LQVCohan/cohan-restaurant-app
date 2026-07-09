import { beforeEach, describe, expect, it, vi } from "vitest";

const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(async () => true),
  staffBelongsToRestaurantByMembership: vi.fn(async () => true),
}));
const modelMocks = vi.hoisted(() => ({
  Role: { findById: vi.fn() },
  Staff: { findById: vi.fn() },
  Restaurant: { exists: vi.fn() },
  AuditLog: { create: vi.fn().mockResolvedValue({ _id: "audit-1" }) },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/restaurantScope.service.js", async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
  staffBelongsToRestaurantByMembership: restaurantScopeMocks.staffBelongsToRestaurantByMembership,
}));

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
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
    restaurantScopeMocks.staffBelongsToRestaurantByMembership.mockResolvedValue(true);
    modelMocks.AuditLog.create.mockResolvedValue({ _id: "audit-1" });
    modelMocks.Restaurant.exists.mockResolvedValue(true);
  });

  it("allows manager with staff.write in restaurant scope to assign a whitelisted staff role", async () => {
    const staff = staffDoc({
      role: { _id: "role-old", name: "Old role", slug: "old", parentRole: { _id: "parent-old", name: "Old parent", slug: "staff" } },
    });
    modelMocks.Staff.findById.mockResolvedValue(staff);
    modelMocks.Role.findById.mockReturnValue(roleQuery({
      _id: "role-server",
      slug: "server",
      name: "Server",
      parentRole: { _id: "parent-staff", slug: "staff", name: "Staff", permissions: [] },
      permissions: [{ code: "menu.read" }, { code: "order.create" }],
    }));

    const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

    const result = await assignStaffRoleWithinRestaurant({
      actor: { id: "manager-1", roleName: "manager" },
      staffUserId: "staff-1",
      roleId: "role-server",
      restaurantId: "restaurant-1",
    });

    expect(result).toBe(staff);
    expect(staff.role).toBe("role-server");
    expect(staff.save).toHaveBeenCalled();
    expect(staff.populate).toHaveBeenCalledWith({ path: "role", populate: { path: "parentRole" } });
    expect(modelMocks.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      action: "STAFF_ROLE_ASSIGNED",
      module: "rbac",
      targetType: "User",
      before: expect.objectContaining({ role: expect.objectContaining({ slug: "old" }) }),
      after: expect.objectContaining({ role: expect.objectContaining({ slug: "server" }) }),
    }));
  });

  it("does not fail assignment when audit logging fails", async () => {
    const staff = staffDoc();
    modelMocks.AuditLog.create.mockRejectedValue(new Error("audit down"));
    modelMocks.Staff.findById.mockResolvedValue(staff);
    modelMocks.Role.findById.mockReturnValue(roleQuery({
      _id: "role-server",
      slug: "server",
      parentRole: { slug: "staff", permissions: [] },
      permissions: [{ code: "order.read" }],
    }));

    const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

    await expect(assignStaffRoleWithinRestaurant({
      actor: { id: "manager-1", roleName: "manager" },
      staffUserId: "staff-1",
      roleId: "role-server",
      restaurantId: "restaurant-1",
    })).resolves.toBe(staff);
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
      actor: { id: "manager-1", roleName: "manager" },
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
      actor: { id: "manager-1", roleName: "manager" },
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
        actor: { id: "manager-1", roleName: "manager" },
        staffUserId: "staff-1",
        roleId: `role-${code}`,
        restaurantId: "restaurant-1",
      })).rejects.toThrow("Manager cannot assign permissions");

      vi.resetModules();
      vi.clearAllMocks();
      restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
      restaurantScopeMocks.staffBelongsToRestaurantByMembership.mockResolvedValue(true);
      modelMocks.AuditLog.create.mockResolvedValue({ _id: "audit-1" });
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

  it("blocks manager from assigning staff in another restaurant", async () => {
    restaurantScopeMocks.staffBelongsToRestaurantByMembership.mockResolvedValue(false);
    modelMocks.Staff.findById.mockResolvedValue(staffDoc());
    modelMocks.Role.findById.mockReturnValue(roleQuery({
      _id: "role-server",
      slug: "server",
      parentRole: { slug: "staff", permissions: [] },
      permissions: [{ code: "order.read" }],
    }));

    const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

    await expect(assignStaffRoleWithinRestaurant({
      actor: { id: "manager-1", roleName: "manager" },
      staffUserId: "staff-1",
      roleId: "role-server",
      restaurantId: "restaurant-1",
    })).rejects.toThrow("Staff does not belong to this restaurant");
  });

  it("blocks staff and customers before assignment", async () => {
    const { assignStaffRoleWithinRestaurant } = await import("../../src/services/auth/staffRoleAssignment.service.js");

    for (const actor of [
      { id: "staff-actor", roleName: "staff" },
      { id: "customer-actor", roleName: "customer" },
    ]) {
      await expect(assignStaffRoleWithinRestaurant({
        actor,
        staffUserId: "staff-1",
        roleId: "role-server",
        restaurantId: "restaurant-1",
      })).rejects.toThrow("FORBIDDEN");
    }
  });
});