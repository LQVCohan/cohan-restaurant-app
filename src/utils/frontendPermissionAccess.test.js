import { describe, expect, it } from "vitest";
import {
  canAccessRestaurantModule,
  filterNavigationByPermissionAccess,
  getPermissionCodes,
  hasAnyPermission,
  hasPermission,
} from "./frontendPermissionAccess";

const managementMenu = [
  { id: "menu", permissions: ["menu.read"] },
  { id: "orders", permissions: ["order.read"] },
  { id: "payment", permissions: ["payment.read"] },
  { id: "inventory", permissions: ["inventory.read", "stock.read"] },
  { id: "tables", permissions: ["table.read"] },
  { id: "promotions", permissions: ["promotion.read", "coupon.read"] },
  { id: "staff", permissions: ["staff.read"] },
  { id: "schedule", permissions: ["shift.read"] },
  { id: "reports", permissions: ["report.read"] },
  { id: "rbac", permissions: ["role.read", "permission.read", "staff.write"] },
];

const visibleIds = (user) => filterNavigationByPermissionAccess(managementMenu, user).map((item) => item.id);

describe("frontendPermissionAccess", () => {
  it("lets admin pass every management permission", () => {
    const admin = { roleName: "admin" };

    expect(hasPermission(admin, "menu.write")).toBe(true);
    expect(visibleIds(admin)).toEqual(managementMenu.map((item) => item.id));
  });

  it("keeps manager access aligned with legacy effective permissions", () => {
    const manager = { roleName: "manager" };

    expect(getPermissionCodes(manager)).toContain("menu.read");
    expect(visibleIds(manager)).toEqual(expect.arrayContaining(["menu", "orders", "payment", "inventory", "tables", "promotions", "staff", "schedule", "reports", "rbac"]));
  });

  it("shows cashier only order and payment modules when those permissions are assigned", () => {
    const cashier = {
      roleName: "cashier",
      role: {
        permissions: [{ code: "order.read" }, { code: "payment.read" }, { code: "payment.write" }],
      },
    };

    expect(visibleIds(cashier)).toEqual(["orders", "payment"]);
    expect(canAccessRestaurantModule(cashier, "payment.write")).toBe(true);
  });

  it("does not grant write buttons to staff without write permissions", () => {
    const staff = { roleName: "staff", role: { permissions: [{ code: "menu.read" }] } };

    expect(hasPermission(staff, "menu.read")).toBe(true);
    expect(hasPermission(staff, "menu.write")).toBe(false);
  });

  it("does not show management menu entries to customer", () => {
    const customer = { roleName: "customer" };

    expect(visibleIds(customer)).toEqual([]);
  });

  it("does not apply internal RBAC requirements to public/customer browsing entries", () => {
    const publicCustomerItems = [
      { id: "public-menu", label: "Xem menu" },
      { id: "active-promotions", label: "Khuyến mãi đang chạy" },
      { id: "active-coupons", label: "Coupon đang chạy" },
    ];

    expect(filterNavigationByPermissionAccess(publicCustomerItems, null).map((item) => item.id)).toEqual([
      "public-menu",
      "active-promotions",
      "active-coupons",
    ]);
    expect(hasAnyPermission({ roleName: "customer" }, ["menu.read", "promotion.read"])).toBe(false);
  });

  it("requires role.write or permission.write for RBAC role create and update controls", () => {
    const reader = { role: { permissions: [{ code: "role.read" }] } };
    const roleWriter = { role: { permissions: [{ code: "role.write" }] } };
    const permissionWriter = { role: { permissions: [{ code: "permission.write" }] } };

    expect(hasAnyPermission(reader, ["role.write", "permission.write"])).toBe(false);
    expect(hasAnyPermission(roleWriter, ["role.write", "permission.write"])).toBe(true);
    expect(hasAnyPermission(permissionWriter, ["role.write", "permission.write"])).toBe(true);
  });

  it("requires staff.write for RBAC staff role assignment controls", () => {
    const reader = { role: { permissions: [{ code: "staff.read" }] } };
    const writer = { role: { permissions: [{ code: "staff.write" }] } };

    expect(hasPermission(reader, "staff.write")).toBe(false);
    expect(hasPermission(writer, "staff.write")).toBe(true);
  });

  it("requires coupon.write for coupon and voucher package write controls", () => {
    const reader = { role: { permissions: [{ code: "coupon.read" }] } };
    const writer = { role: { permissions: [{ code: "coupon.write" }] } };

    expect(hasPermission(reader, "coupon.write")).toBe(false);
    expect(hasPermission(writer, "coupon.write")).toBe(true);
  });

  it("requires inventory.write or stock.write for inventory and stock write controls", () => {
    const reader = { role: { permissions: [{ code: "inventory.read" }, { code: "stock.read" }] } };
    const inventoryWriter = { role: { permissions: [{ code: "inventory.write" }] } };
    const stockWriter = { role: { permissions: [{ code: "stock.write" }] } };

    expect(hasAnyPermission(reader, ["inventory.write", "stock.write"])).toBe(false);
    expect(hasAnyPermission(inventoryWriter, ["inventory.write", "stock.write"])).toBe(true);
    expect(hasAnyPermission(stockWriter, ["inventory.write", "stock.write"])).toBe(true);
  });

  it("requires payment.write for payment mutation controls", () => {
    const reader = { role: { permissions: [{ code: "payment.read" }] } };
    const writer = { role: { permissions: [{ code: "payment.write" }] } };

    expect(hasPermission(reader, "payment.write")).toBe(false);
    expect(hasPermission(writer, "payment.write")).toBe(true);
  });
});
