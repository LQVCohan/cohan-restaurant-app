import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Category: { find: vi.fn(), findById: vi.fn(), findOneAndUpdate: vi.fn(), findByIdAndDelete: vi.fn() },
  CategoryMenu: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
  Menu: { findOne: vi.fn() },
  MenuItem: { aggregate: vi.fn(), find: vi.fn(), exists: vi.fn(), countDocuments: vi.fn() },
  RestaurantCategoryIndex: { find: vi.fn(), bulkWrite: vi.fn() },
  Order: { exists: vi.fn(), aggregate: vi.fn() },
  Reservation: { aggregate: vi.fn() },
  TableCustomer: { aggregate: vi.fn() },
  ModifierGroup: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
  Ingredient: { countDocuments: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const authMocks = vi.hoisted(() => ({ requireRole: vi.fn() }));
const permissionMocks = vi.hoisted(() => ({ hasAnyPermission: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../utils/authz.js", () => authMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => permissionMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((v) => String(v || "").startsWith("valid-")),
    Types: { ObjectId: function ObjectId(v) { this.value = v; this.toString = () => String(v); } },
  },
}));

const lean = (v) => ({ lean: vi.fn().mockResolvedValue(v) });
const selectLean = (v) => ({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) });

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
  authMocks.requireRole.mockReturnValue(undefined);
  permissionMocks.hasAnyPermission.mockResolvedValue(true);
});

describe("category + modifier restaurant access guards", () => {
  it("covers denied guard flows", async () => {
    const { CategoryQuery } = await import("../../graphql/resolvers/category/query.js");
    const { CategoryMutation } = await import("../../graphql/resolvers/category/mutation.js");
    const { ModifierQuery } = await import("../../graphql/resolvers/modifier/query.js");
    const { ModifierMutation } = await import("../../graphql/resolvers/modifier/mutation.js");

    modelMocks.Category.find.mockReturnValue({ sort: vi.fn().mockReturnValue(lean([])) });
    await expect(CategoryQuery.categories(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Category.find).not.toHaveBeenCalled();
    expect(modelMocks.Menu.findOne).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.aggregate).not.toHaveBeenCalled();

    await expect(CategoryQuery.topCategoriesByMenuItemCount(null, { restaurantId: "valid-r1", timeSlot: "MORNING" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Menu.findOne).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.find).not.toHaveBeenCalled();

    await expect(CategoryQuery.categoryMenus(null, { restaurantId: "valid-r1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.CategoryMenu.find).not.toHaveBeenCalled();

    modelMocks.CategoryMenu.findById.mockReturnValueOnce(selectLean({ restaurantId: "valid-r1" }));
    await expect(CategoryQuery.categoryMenu(null, { id: "valid-cm1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");

    await expect(CategoryMutation.createCategory(null, { input: { restaurantId: "valid-r1", name: "A" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Category.findOneAndUpdate).not.toHaveBeenCalled();

    const catDoc = { restaurantId: "valid-r1", save: vi.fn() };
    modelMocks.Category.findById.mockResolvedValueOnce(catDoc);
    await expect(CategoryMutation.updateCategory(null, { input: { id: "valid-c1", name: "B" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(catDoc.save).not.toHaveBeenCalled();

    modelMocks.Category.findById.mockReturnValueOnce(selectLean({ restaurantId: "valid-r1" }));
    await expect(CategoryMutation.deleteCategory(null, { id: "valid-c1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.MenuItem.exists).not.toHaveBeenCalled();
    expect(modelMocks.Category.findByIdAndDelete).not.toHaveBeenCalled();

    await expect(CategoryMutation.createCategoryMenu(null, { input: { restaurantId: "valid-r1", name: "CM" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.CategoryMenu.create).not.toHaveBeenCalled();

    const cmDoc = { restaurantId: "valid-r1", save: vi.fn() };
    modelMocks.CategoryMenu.findById.mockResolvedValueOnce(cmDoc);
    await expect(CategoryMutation.updateCategoryMenu(null, { input: { id: "valid-cm1", name: "N" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(cmDoc.save).not.toHaveBeenCalled();

    modelMocks.CategoryMenu.findById.mockReturnValueOnce(selectLean({ restaurantId: "valid-r1" }));
    await expect(CategoryMutation.deleteCategoryMenu(null, { id: "valid-cm1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.CategoryMenu.findByIdAndDelete).not.toHaveBeenCalled();

    await expect(ModifierQuery.modifierGroups(null, { filter: { restaurantId: "valid-r1" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.ModifierGroup.find).not.toHaveBeenCalled();

    modelMocks.ModifierGroup.findById.mockReturnValueOnce(selectLean({ restaurantId: "valid-r1" }));
    await expect(ModifierQuery.modifierGroup(null, { id: "valid-g1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");

    await expect(ModifierMutation.createModifierGroup(null, { input: { restaurantId: "valid-r1", name: "G", groupType: "SIZE", coverage: "GLOBAL", selectionType: "single", required: true, options: [{ name: "S", priceRule: { rule: "DELTA", amount: 0 }, inventoryRule: { rule: "NONE" } }] } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.MenuItem.countDocuments).not.toHaveBeenCalled();
    expect(modelMocks.Ingredient.countDocuments).not.toHaveBeenCalled();
    expect(modelMocks.ModifierGroup.create).not.toHaveBeenCalled();

    const gDoc = { restaurantId: "valid-r1", name: "G", groupType: "SIZE", coverage: "GLOBAL", menuItemIds: [], selectionType: "single", required: true, minSelected: 1, maxSelected: 1, options: [{ name: "S", isDefault: true, isActive: true, priceRule: { rule: "DELTA", amount: 0 }, inventoryRule: { rule: "NONE", ingredientLines: [] } }], note: "", isActive: true, save: vi.fn() };
    modelMocks.ModifierGroup.findById.mockResolvedValueOnce(gDoc);
    await expect(ModifierMutation.updateModifierGroup(null, { input: { id: "valid-g1", name: "G2" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(gDoc.save).not.toHaveBeenCalled();

    modelMocks.ModifierGroup.findById.mockReturnValueOnce(selectLean({ restaurantId: "valid-r1" }));
    await expect(ModifierMutation.deleteModifierGroup(null, { id: "valid-g1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Order.exists).not.toHaveBeenCalled();
    expect(modelMocks.ModifierGroup.findByIdAndDelete).not.toHaveBeenCalled();

    const group = { restaurantId: "valid-r1", selectionType: "single", required: true, options: [{ _id: "valid-o1", isDefault: true, name: "A", isActive: true, priceRule: { rule: "DELTA", amount: 0 }, inventoryRule: { rule: "NONE", ingredientLines: [] }, toObject: () => ({ name: "A", isDefault: true, isActive: true, priceRule: { rule: "DELTA", amount: 0 }, inventoryRule: { rule: "NONE", ingredientLines: [] } }) }], save: vi.fn() };
    modelMocks.ModifierGroup.findById.mockResolvedValueOnce(group);
    await expect(ModifierMutation.addModifierOption(null, { groupId: "valid-g1", option: { name: "B", priceRule: { rule: "DELTA", amount: 0 }, inventoryRule: { rule: "NONE" } } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(group.save).not.toHaveBeenCalled();

    modelMocks.ModifierGroup.findById.mockResolvedValueOnce(group);
    await expect(ModifierMutation.updateModifierOption(null, { groupId: "valid-g1", optionId: "valid-o1", option: { name: "B" } }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(group.save).not.toHaveBeenCalled();

    modelMocks.ModifierGroup.findById.mockResolvedValueOnce(group);
    await expect(ModifierMutation.removeModifierOption(null, { groupId: "valid-g1", optionId: "valid-o1" }, {})).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(group.save).not.toHaveBeenCalled();
  });

  it("preserves an explicitly inactive category on create", async () => {
    guardMocks.requireRestaurantAccess.mockResolvedValueOnce(true);
    modelMocks.Category.findOneAndUpdate.mockResolvedValueOnce({
      toObject: () => ({ id: "valid-c1", name: "Đồ uống", isActive: false }),
    });

    const { CategoryMutation } = await import("../../graphql/resolvers/category/mutation.js");
    const result = await CategoryMutation.createCategory(
      null,
      {
        input: {
          restaurantId: "valid-r1",
          name: "Đồ uống",
          isActive: false,
        },
      },
      { user: { id: "valid-u1" } }
    );

    expect(modelMocks.Category.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({ isActive: false }),
      }),
      expect.objectContaining({ new: true, upsert: true })
    );
    expect(result.isActive).toBe(false);
  });
});
