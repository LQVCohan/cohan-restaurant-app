import { describe, expect, it } from "vitest";
import {
  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
  canAccessRoute,
  getDefaultPathForRole,
  getStaffWorkspacePath,
  hasStaffKitchenAccess,
  hasStaffOrderAccess,
  isRestaurantScopedRole,
  isStaffOperationalRole,
  resolveUserRoleName,
} from "./frontendRoleAccess";

const userWith = (...codes) => ({
  roleName: "staff",
  effectivePermissionCodes: codes,
});

const customStaff = ({ slug, department, permissions = [] }) => ({
  roleName: slug,
  userType: "STAFF",
  department,
  effectivePermissionCodes: permissions,
  role: {
    slug,
    department,
    parentRole: { slug: "staff" },
  },
});

describe("restaurant-scoped frontend roles", () => {
  it("keeps HR and accountant out of operational floor roles", () => {
    expect(isStaffOperationalRole("hr")).toBe(false);
    expect(isStaffOperationalRole("accountant")).toBe(false);
  });

  it("maps HR, accountant and operational staff to an assigned restaurant", () => {
    expect(isRestaurantScopedRole("hr")).toBe(true);
    expect(isRestaurantScopedRole("accountant")).toBe(true);
    expect(isRestaurantScopedRole("server")).toBe(true);
    expect(isRestaurantScopedRole("manager")).toBe(false);
    expect(isRestaurantScopedRole("customer")).toBe(false);
  });

  it("routes operational roles to their primary workspace", () => {
    expect(getStaffWorkspacePath("server")).toBe("/staff/orders");
    expect(getDefaultPathForRole("cashier")).toBe("/staff/orders");
    expect(getDefaultPathForRole("chef")).toBe("/staff/kitchen");
    expect(getDefaultPathForRole("bartender")).toBe("/staff/kitchen");
    expect(getDefaultPathForRole("storekeeper")).toBe("/staff/dashboard");
  });

  it("maps custom staff roles to the existing workspace for their department", () => {
    const customBar = customStaff({
      slug: "bar-lead",
      department: "bar",
      permissions: ["order.read", "order.update"],
    });
    const restoredCustomBar = {
      roleName: "bar-lead",
      department: "bar",
      effectivePermissionCodes: ["order.read", "order.update"],
    };
    const customKitchen = customStaff({
      slug: "grill-specialist",
      department: "kitchen",
      permissions: ["order.read", "order.update"],
    });
    const customStorekeeper = customStaff({
      slug: "stock-controller",
      department: "inventory",
      permissions: ["inventory.read"],
    });

    expect(resolveUserRoleName(customBar)).toBe("bartender");
    expect(resolveUserRoleName(restoredCustomBar)).toBe("bartender");
    expect(resolveUserRoleName(customKitchen)).toBe("chef");
    expect(resolveUserRoleName(customStorekeeper)).toBe("storekeeper");
    expect(hasStaffKitchenAccess(customBar)).toBe(true);
    expect(hasStaffKitchenAccess(restoredCustomBar)).toBe(true);
    expect(hasStaffKitchenAccess(customKitchen)).toBe(true);
    expect(getDefaultPathForRole(customStorekeeper)).toBe("/staff/dashboard");
  });

  it("uses permissions to distinguish custom service roles", () => {
    const customHost = customStaff({
      slug: "guest-welcome",
      department: "service",
      permissions: ["reservation.read", "reservation.update", "table.read"],
    });
    const customServer = customStaff({
      slug: "table-attendant",
      department: "service",
      permissions: ["order.read", "order.create", "order.update"],
    });
    const customSupervisor = customStaff({
      slug: "service-lead",
      department: "service",
      permissions: ["order.read", "order.update", "order.cancel", "staff.read"],
    });

    expect(resolveUserRoleName(customHost)).toBe("host");
    expect(resolveUserRoleName(customServer)).toBe("server");
    expect(resolveUserRoleName(customSupervisor)).toBe("supervisor");
    expect(hasStaffOrderAccess(customHost)).toBe(true);
    expect(hasStaffOrderAccess(customServer)).toBe(true);
    expect(hasStaffOrderAccess(customSupervisor)).toBe(true);
  });
});

describe("frontend route access policy", () => {
  it("keeps customer-only pages customer-only", () => {
    expect(canAccessRoute("customer", "/for-you")).toBe(true);
    expect(canAccessRoute("customer", "/wallet")).toBe(true);
    expect(canAccessRoute("customer", "/checkout")).toBe(true);

    expect(canAccessRoute("manager", "/for-you")).toBe(false);
    expect(canAccessRoute("manager", "/wallet")).toBe(false);
    expect(canAccessRoute("admin", "/checkout")).toBe(false);
  });

  it("keeps management and profile routes aligned with AppRouter", () => {
    expect(canAccessRoute("manager", "/manager")).toBe(true);
    expect(canAccessRoute("accountant", "/manager")).toBe(true);
    expect(canAccessRoute("manager", "/orders")).toBe(true);

    expect(canAccessRoute("staff", "/profile")).toBe(true);
    expect(canAccessRoute("hr", "/profile")).toBe(false);
    expect(canAccessRoute("accountant", "/notifications")).toBe(false);
  });
});

describe("MenuManagement frontend permission mapping", () => {
  it("allows admin to access every MenuManagement action", () => {
    const admin = { roleName: "admin" };

    Object.values(MENU_MANAGEMENT_ACTIONS).forEach((action) => {
      expect(canAccessMenuManagementAction(admin, action)).toBe(true);
    });
  });

  it("uses granular menu permissions for menu actions", () => {
    expect(canAccessMenuManagementAction(userWith("menu.create"), MENU_MANAGEMENT_ACTIONS.CREATE_MENU)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.update"), MENU_MANAGEMENT_ACTIONS.UPDATE_MENU)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.delete"), MENU_MANAGEMENT_ACTIONS.DELETE_MENU)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.copy"), MENU_MANAGEMENT_ACTIONS.COPY_MENU)).toBe(true);
  });

  it("uses granular menu item permissions for item actions", () => {
    expect(canAccessMenuManagementAction(userWith("menu.item.create"), MENU_MANAGEMENT_ACTIONS.CREATE_ITEM)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.item.update"), MENU_MANAGEMENT_ACTIONS.UPDATE_ITEM)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.item.delete"), MENU_MANAGEMENT_ACTIONS.DELETE_ITEM)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.price.update"), MENU_MANAGEMENT_ACTIONS.UPDATE_PRICE)).toBe(true);
  });

  it("uses granular permissions for category, group, inventory sync, and audit", () => {
    expect(canAccessMenuManagementAction(userWith("menu.category.manage"), MENU_MANAGEMENT_ACTIONS.MANAGE_DISH_CATEGORY)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.group.manage"), MENU_MANAGEMENT_ACTIONS.MANAGE_MENU_GROUP)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.inventory.sync"), MENU_MANAGEMENT_ACTIONS.SYNC_INVENTORY)).toBe(true);
    expect(canAccessMenuManagementAction(userWith("menu.audit.read"), MENU_MANAGEMENT_ACTIONS.VIEW_AUDIT)).toBe(true);
  });

  it("allows legacy menu.write fallback for write actions", () => {
    const legacyManager = userWith("menu.write");

    [
      MENU_MANAGEMENT_ACTIONS.CREATE_ITEM,
      MENU_MANAGEMENT_ACTIONS.UPDATE_ITEM,
      MENU_MANAGEMENT_ACTIONS.DELETE_ITEM,
      MENU_MANAGEMENT_ACTIONS.UPDATE_PRICE,
      MENU_MANAGEMENT_ACTIONS.MANAGE_DISH_CATEGORY,
      MENU_MANAGEMENT_ACTIONS.MANAGE_MENU_GROUP,
      MENU_MANAGEMENT_ACTIONS.CREATE_MENU,
      MENU_MANAGEMENT_ACTIONS.UPDATE_MENU,
      MENU_MANAGEMENT_ACTIONS.DELETE_MENU,
      MENU_MANAGEMENT_ACTIONS.TOGGLE_MENU,
      MENU_MANAGEMENT_ACTIONS.COPY_MENU,
      MENU_MANAGEMENT_ACTIONS.SYNC_INVENTORY,
      MENU_MANAGEMENT_ACTIONS.VIEW_AUDIT,
    ].forEach((action) => {
      expect(canAccessMenuManagementAction(legacyManager, action)).toBe(true);
    });
  });

  it("allows inventory.write fallback for inventory sync only", () => {
    const storekeeper = userWith("inventory.write");

    expect(canAccessMenuManagementAction(storekeeper, MENU_MANAGEMENT_ACTIONS.SYNC_INVENTORY)).toBe(true);
    expect(canAccessMenuManagementAction(storekeeper, MENU_MANAGEMENT_ACTIONS.DELETE_MENU)).toBe(false);
    expect(canAccessMenuManagementAction(storekeeper, MENU_MANAGEMENT_ACTIONS.UPDATE_PRICE)).toBe(false);
  });

  it("allows log.read fallback for audit only", () => {
    const auditor = userWith("log.read");

    expect(canAccessMenuManagementAction(auditor, MENU_MANAGEMENT_ACTIONS.VIEW_AUDIT)).toBe(true);
    expect(canAccessMenuManagementAction(auditor, MENU_MANAGEMENT_ACTIONS.COPY_MENU)).toBe(false);
  });

  it("keeps read-only users from write actions", () => {
    const reader = userWith("menu.read");

    expect(canAccessMenuManagementAction(reader, MENU_MANAGEMENT_ACTIONS.VIEW)).toBe(true);
    expect(canAccessMenuManagementAction(reader, MENU_MANAGEMENT_ACTIONS.CREATE_MENU)).toBe(false);
    expect(canAccessMenuManagementAction(reader, MENU_MANAGEMENT_ACTIONS.DELETE_MENU)).toBe(false);
    expect(canAccessMenuManagementAction(reader, MENU_MANAGEMENT_ACTIONS.SYNC_INVENTORY)).toBe(false);
  });
});
