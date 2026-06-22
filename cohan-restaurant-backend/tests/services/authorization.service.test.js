import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUserEffectivePermissions,
  hasPermission,
  requirePermission,
  requireRestaurantPermission,
} from "../../src/services/auth/authorization.service.js";
const modelMocks = vi.hoisted(() => ({
  Restaurant: {
    exists: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);

const RESTAURANT_ID = "rest-main-1";

describe("authorization.service RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.Restaurant.exists.mockResolvedValue(false);
  });

  it("allows admin to create permissions through wildcard/system authority", async () => {
    await expect(
      requirePermission({ user: { id: "admin-1", roleName: "admin" } }, "permission.write"),
    ).resolves.toBe(true);
  });

  it("forbids manager from creating or updating system permissions", async () => {
    await expect(
      requirePermission({ user: { id: "manager-1", roleName: "manager" } }, "permission.write"),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("merges effective permissions from parent role and concrete role without duplicates", async () => {
    const orderRead = { _id: "p1", code: "order.read" };
    const user = {
      id: "507f1f77bcf86cd799439088",
      role: {
        slug: "server",
        parentRole: { permissions: [orderRead, { _id: "p2", code: "menu.read" }] },
        permissions: [orderRead, { _id: "p3", code: "order.create" }],
      },
    };

    const codes = (await getUserEffectivePermissions(user)).map((p) => p.code).sort();
    expect(codes).toEqual(["menu.read", "order.create", "order.read"]);
  });


  it("does not give manager global role.write through legacy/default permissions", async () => {
    expect(await hasPermission({ id: "manager-1", roleName: "manager" }, "role.write")).toBe(false);
  });

  it("forbids staff from role/permission administration APIs", async () => {
    await expect(
      requirePermission({ user: { id: "507f1f77bcf86cd799439088", roleName: "staff" } }, "role.write"),
    ).rejects.toThrow("FORBIDDEN");
  });

  it("allows manager to manage staff inside a restaurant they own", async () => {
    modelMocks.Restaurant.exists.mockResolvedValue(true);
    const ctx = { user: { id: "manager-1", roleName: "manager" } };
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "staff.write")).resolves.toBe(true);
  });

  it("returns 403 when manager manages staff outside assigned restaurant scope", async () => {
    const ctx = {
      user: {
        id: "manager-1",
        roleName: "manager",
      },
    };
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "staff.write")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("allows HR read permission only in the assigned restaurant", async () => {
    const ctx = { user: { id: "hr-1", roleName: "hr", restaurantForStaff: RESTAURANT_ID } };
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "staff.read")).resolves.toBe(true);
    await expect(requireRestaurantPermission(ctx, "rest-other-1", "staff.read")).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("allows accountant finance permission only in the assigned restaurant", async () => {
    const ctx = { user: { id: "acc-1", roleName: "accountant", restaurantForStaff: RESTAURANT_ID } };
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "finance.read")).resolves.toBe(true);
    await expect(requireRestaurantPermission(ctx, "rest-other-1", "finance.read")).rejects.toThrow("FORBIDDEN_SCOPE");
  });

  it("returns 403 when user lacks the requested restaurant permission", async () => {
    const ctx = {
      user: {
        id: "507f1f77bcf86cd799439088",
        roleName: "staff",
        restaurantForStaff: RESTAURANT_ID,
      },
    };
    expect(await hasPermission(ctx.user, "staff.write")).toBe(false);
    await expect(requireRestaurantPermission(ctx, RESTAURANT_ID, "staff.write")).rejects.toThrow("FORBIDDEN");
  });
  it("seeds storekeeper with inventory, stock, and supplier permissions", () => {
    const seedRoles = fs.readFileSync(new URL("../../scripts/seedRoles.js", import.meta.url), "utf8");
    expect(seedRoles).toContain('slug: "storekeeper"');
    expect(seedRoles).toContain('"inventory.read"');
    expect(seedRoles).toContain('"stock.write"');
    expect(seedRoles).toContain('"supplier.read"');
  });

});
