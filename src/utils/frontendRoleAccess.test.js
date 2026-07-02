import { describe, expect, it } from "vitest";
import {
  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
  canAccessRoute,
  isRestaurantScopedRole,
  isStaffOperationalRole,
} from "./frontendRoleAccess";

const userWith = (...codes) => ({
  roleName: "staff",
  effectivePermissionCodes: codes,
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
