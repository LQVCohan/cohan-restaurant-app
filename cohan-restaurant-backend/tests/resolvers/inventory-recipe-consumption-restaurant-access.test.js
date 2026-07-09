import { describe, it, expect, beforeEach, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Recipe: {
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  },
  MenuItem: { find: vi.fn(), countDocuments: vi.fn(), updateOne: vi.fn() },
  Menu: { findOne: vi.fn(), find: vi.fn() },
  Warehouse: { findOne: vi.fn() },
}));

const serviceMocks = vi.hoisted(() => ({
  consumeForOrderTx: vi.fn(),
  reserveForOrderTx: vi.fn(),
  commitReservationForOrderTx: vi.fn(),
  cancelReservationForOrderTx: vi.fn(),
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/inventory.service.js", () => serviceMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((v) => typeof v === "string" && (v.startsWith("valid-") || /^[a-fA-F0-9]{24}$/.test(v))),
    Types: { ObjectId: { createFromHexString: vi.fn((v) => v) } },
  },
}));

const ctx = { user: { id: "u1", roleName: "manager" } };
const forbidden = new Error("FORBIDDEN_SCOPE");
const q = { select: vi.fn(() => ({ lean: vi.fn(async () => null) })) };

describe("Inventory restaurant access guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    modelMocks.Recipe.findOne.mockReturnValue(q);
    modelMocks.Recipe.find.mockReturnValue(q);
    modelMocks.Menu.findOne.mockReturnValue(q);
    modelMocks.Menu.find.mockReturnValue(q);
    modelMocks.MenuItem.find.mockReturnValue(q);
    modelMocks.MenuItem.countDocuments.mockResolvedValue(0);
    modelMocks.Recipe.findOneAndUpdate.mockResolvedValue(null);
    modelMocks.Recipe.deleteOne.mockResolvedValue({ deletedCount: 0 });
    modelMocks.MenuItem.updateOne.mockResolvedValue({ acknowledged: true });
    modelMocks.Warehouse.findOne.mockReturnValue({ sort: vi.fn(() => ({ lean: vi.fn(async () => ({ _id: "valid-wh1" })) })) });
    serviceMocks.consumeForOrderTx.mockResolvedValue({ ok: true });
    serviceMocks.reserveForOrderTx.mockResolvedValue({ ok: true });
    serviceMocks.commitReservationForOrderTx.mockResolvedValue({ ok: true });
    serviceMocks.cancelReservationForOrderTx.mockResolvedValue({ ok: true });
  });

  it("recipe denied does not call Recipe.findOne", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const recipeQuery = (await import("../../graphql/resolvers/inventory/recipe.query.js")).default;
    await expect(recipeQuery.recipe(null, { restaurantId: "valid-r1", menuItemId: "valid-m1" }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Recipe.findOne).not.toHaveBeenCalled();
  });

  it("recipe allowed calls guard before Recipe.findOne", async () => {
    const recipeQuery = (await import("../../graphql/resolvers/inventory/recipe.query.js")).default;
    await recipeQuery.recipe(null, { restaurantId: "valid-r1", menuItemId: "valid-m1" }, ctx);
    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(ctx, "valid-r1");
    expect(guardMocks.requireRestaurantAccess.mock.invocationCallOrder[0]).toBeLessThan(modelMocks.Recipe.findOne.mock.invocationCallOrder[0]);
  });

  it("recipesByMenuItems denied does not call Recipe.find", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const recipeQuery = (await import("../../graphql/resolvers/inventory/recipe.query.js")).default;
    await expect(recipeQuery.recipesByMenuItems(null, { restaurantId: "valid-r1", menuItemIds: ["valid-m1"] }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Recipe.find).not.toHaveBeenCalled();
  });

  it("menuItemsWithRecipes denied before Menu/MenuItem/Recipe queries", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const recipeQuery = (await import("../../graphql/resolvers/inventory/recipe.query.js")).default;
    await expect(recipeQuery.menuItemsWithRecipes(null, { restaurantId: "valid-r1" }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Menu.findOne).not.toHaveBeenCalled();
    expect(modelMocks.Menu.find).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.find).not.toHaveBeenCalled();
    expect(modelMocks.Recipe.find).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.countDocuments).not.toHaveBeenCalled();
  });

  it("upsertRecipe denied does not call writes", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const m = (await import("../../graphql/resolvers/inventory/recipe.mutation.js")).default;
    await expect(m.upsertRecipe(null, { input: { restaurantId: "valid-r1", menuItemId: "valid-m1", servingVariants: [{ key: "k", mode: "PORTION", ingredients: [], isDefault: true }] } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Recipe.findOneAndUpdate).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.updateOne).not.toHaveBeenCalled();
  });

  it("deleteRecipe denied does not call writes", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const m = (await import("../../graphql/resolvers/inventory/recipe.mutation.js")).default;
    await expect(m.deleteRecipe(null, { restaurantId: "valid-r1", menuItemId: "valid-m1" }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Recipe.deleteOne).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.updateOne).not.toHaveBeenCalled();
  });

  it("deleteRecipePermanently denied does not call writes", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const m = (await import("../../graphql/resolvers/inventory/recipe.mutation.js")).default;
    await expect(m.deleteRecipePermanently(null, { restaurantId: "valid-r1", menuItemId: "valid-m1" }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Recipe.deleteOne).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.updateOne).not.toHaveBeenCalled();
  });

  it("deleteRecipePermanently deletes soft-deleted recipe and resets menu cache", async () => {
    modelMocks.Recipe.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });
    const m = (await import("../../graphql/resolvers/inventory/recipe.mutation.js")).default;
    await expect(m.deleteRecipePermanently(null, { restaurantId: "valid-r1", menuItemId: "valid-m1" }, ctx)).resolves.toBe(true);
    expect(modelMocks.Recipe.deleteOne).toHaveBeenCalledWith({
      restaurantId: "valid-r1",
      menuItemId: "valid-m1",
      deletedAt: { $ne: null },
    });
    expect(modelMocks.MenuItem.updateOne).toHaveBeenCalledWith(
      { _id: "valid-m1", restaurantId: "valid-r1" },
      { $set: { hasByWeightVariant: false }, $unset: { defaultServingKey: 1 } },
    );
  });

  it("consumeForOrder denied before warehouse/service", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const m = (await import("../../graphql/resolvers/inventory/consume.mutation.js")).default;
    await expect(m.consumeForOrder(null, { input: { restaurantId: "valid-r1", orderCode: "O1", lines: [{ menuItemId: "valid-m1", quantity: 1 }] } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Warehouse.findOne).not.toHaveBeenCalled();
    expect(serviceMocks.consumeForOrderTx).not.toHaveBeenCalled();
  });

  it("consumeForOrder allowed with explicit warehouseId skips default lookup", async () => {
    const m = (await import("../../graphql/resolvers/inventory/consume.mutation.js")).default;
    await m.consumeForOrder(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-wh1", orderCode: "O1", lines: [{ menuItemId: "valid-m1", quantity: "2" }] } }, ctx);
    expect(modelMocks.Warehouse.findOne).not.toHaveBeenCalled();
    expect(serviceMocks.consumeForOrderTx).toHaveBeenCalledWith(expect.objectContaining({ restaurantId: "valid-r1", warehouseId: "valid-wh1", orderCode: "O1" }));
  });

  it("reserve denied before warehouse/service", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const m = (await import("../../graphql/resolvers/inventory/reservation.mutation.js")).default;
    await expect(m.reserveForOrder(null, { input: { restaurantId: "valid-r1", orderCode: "O1", lines: [{ menuItemId: "valid-m1", quantity: 1 }] } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Warehouse.findOne).not.toHaveBeenCalled();
    expect(serviceMocks.reserveForOrderTx).not.toHaveBeenCalled();
  });

  it("commit denied before warehouse/service", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const m = (await import("../../graphql/resolvers/inventory/reservation.mutation.js")).default;
    await expect(m.commitReservationForOrder(null, { input: { restaurantId: "valid-r1", orderCode: "O1", lines: [{ menuItemId: "valid-m1", quantity: 1 }] } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Warehouse.findOne).not.toHaveBeenCalled();
    expect(serviceMocks.commitReservationForOrderTx).not.toHaveBeenCalled();
  });

  it("cancel denied before warehouse/service", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden);
    const m = (await import("../../graphql/resolvers/inventory/reservation.mutation.js")).default;
    await expect(m.cancelReservationForOrder(null, { input: { restaurantId: "valid-r1", orderCode: "O1", lines: [{ menuItemId: "valid-m1", quantity: 1 }] } }, ctx)).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Warehouse.findOne).not.toHaveBeenCalled();
    expect(serviceMocks.cancelReservationForOrderTx).not.toHaveBeenCalled();
  });

  it("reserve allowed with explicit warehouseId skips default lookup", async () => {
    const m = (await import("../../graphql/resolvers/inventory/reservation.mutation.js")).default;
    await m.reserveForOrder(null, { input: { restaurantId: "valid-r1", warehouseId: "valid-wh1", orderCode: "O1", lines: [{ menuItemId: "valid-m1", quantity: "1" }] } }, ctx);
    expect(modelMocks.Warehouse.findOne).not.toHaveBeenCalled();
    expect(serviceMocks.reserveForOrderTx).toHaveBeenCalled();
  });
});