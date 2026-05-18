import { beforeEach, describe, expect, it, vi } from "vitest";

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

const authzMocks = vi.hoisted(() => ({
  hasAnyPermission: vi.fn(),
}));

vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authzMocks);

const ctx = { user: { id: "user-1", roleName: "manager" } };

describe("MenuManagement permission helper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(true);
    authzMocks.hasAnyPermission.mockResolvedValue(true);
  });

  it("checks restaurant scope before permission codes", async () => {
    const { MENU_PERMISSION, requireMenuPermission } = await import(
      "../../graphql/resolvers/menu/menuPermission.js"
    );

    await expect(
      requireMenuPermission(ctx, "restaurant-1", MENU_PERMISSION.COPY_MENU),
    ).resolves.toBe(true);

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(ctx, "restaurant-1");
    expect(authzMocks.hasAnyPermission).toHaveBeenCalledWith(ctx.user, [
      "menu.copy",
      "menu.write",
    ]);
  });

  it("falls back to menu.write when no permission list is provided", async () => {
    const { requireMenuPermission } = await import(
      "../../graphql/resolvers/menu/menuPermission.js"
    );

    await requireMenuPermission(ctx, "restaurant-1");

    expect(authzMocks.hasAnyPermission).toHaveBeenCalledWith(ctx.user, ["menu.write"]);
  });

  it("throws FORBIDDEN_MENU_PERMISSION when permission check fails", async () => {
    authzMocks.hasAnyPermission.mockResolvedValue(false);
    const { MENU_PERMISSION, requireMenuPermission } = await import(
      "../../graphql/resolvers/menu/menuPermission.js"
    );

    await expect(
      requireMenuPermission(ctx, "restaurant-1", MENU_PERMISSION.DELETE_MENU),
    ).rejects.toMatchObject({
      message: "FORBIDDEN_MENU_PERMISSION",
      extensions: {
        code: "FORBIDDEN",
        requiredPermissions: ["menu.delete", "menu.write"],
      },
    });
  });

  it("does not run permission check if restaurant scope fails", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN"));
    const { MENU_PERMISSION, requireMenuPermission } = await import(
      "../../graphql/resolvers/menu/menuPermission.js"
    );

    await expect(
      requireMenuPermission(ctx, "restaurant-2", MENU_PERMISSION.SYNC_INVENTORY),
    ).rejects.toThrow("FORBIDDEN");

    expect(authzMocks.hasAnyPermission).not.toHaveBeenCalled();
  });

  it("maps granular MenuManagement permissions with legacy fallbacks", async () => {
    const { MENU_PERMISSION } = await import(
      "../../graphql/resolvers/menu/menuPermission.js"
    );

    expect(MENU_PERMISSION.CREATE_MENU).toEqual(["menu.create", "menu.write"]);
    expect(MENU_PERMISSION.UPDATE_MENU).toEqual(["menu.update", "menu.write"]);
    expect(MENU_PERMISSION.DELETE_MENU).toEqual(["menu.delete", "menu.write"]);
    expect(MENU_PERMISSION.CREATE_ITEM).toEqual(["menu.item.create", "menu.write"]);
    expect(MENU_PERMISSION.UPDATE_ITEM).toEqual(["menu.item.update", "menu.write"]);
    expect(MENU_PERMISSION.DELETE_ITEM).toEqual(["menu.item.delete", "menu.write"]);
    expect(MENU_PERMISSION.UPDATE_PRICE).toEqual(["menu.price.update", "menu.write"]);
    expect(MENU_PERMISSION.MANAGE_CATEGORY).toEqual(["menu.category.manage", "menu.write"]);
    expect(MENU_PERMISSION.MANAGE_GROUP).toEqual(["menu.group.manage", "menu.write"]);
    expect(MENU_PERMISSION.SYNC_INVENTORY).toEqual([
      "menu.inventory.sync",
      "menu.write",
      "inventory.write",
    ]);
    expect(MENU_PERMISSION.VIEW_AUDIT).toEqual(["menu.audit.read", "menu.read", "log.read"]);
  });
});
