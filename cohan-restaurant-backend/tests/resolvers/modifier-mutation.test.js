import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  ModifierGroup: {
    findById: vi.fn(),
    create: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
  MenuItem: { countDocuments: vi.fn() },
  Ingredient: { countDocuments: vi.fn() },
  Order: { exists: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../utils/authz.js", () => authMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) =>
      String(value || "").startsWith("valid-"),
    ),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = String(value);
        this.toString = () => this.value;
      },
    },
  },
}));

const resolvedGroupQuery = (value) => ({
  lean: vi.fn().mockResolvedValue(value),
});

const option = (name = "Mặc định", patch = {}) => ({
  _id: patch._id || "valid-o1",
  name,
  isDefault: patch.isDefault ?? true,
  isActive: patch.isActive ?? true,
  priceRule: patch.priceRule || { rule: "DELTA", amount: 0 },
  inventoryRule: patch.inventoryRule || {
    rule: "NONE",
    ingredientLines: [],
  },
  toObject() {
    return {
      name: this.name,
      isDefault: this.isDefault,
      isActive: this.isActive,
      priceRule: this.priceRule,
      inventoryRule: this.inventoryRule,
    };
  },
});

const groupDocument = (patch = {}) => ({
  _id: "valid-g1",
  restaurantId: "valid-r1",
  name: "Topping",
  groupType: "TOPPING",
  coverage: "GLOBAL",
  menuItemIds: [],
  selectionType: "multiple",
  required: false,
  minSelected: 0,
  maxSelected: 3,
  options: [option()],
  note: "Ghi chú cũ",
  isActive: true,
  save: vi.fn().mockResolvedValue(undefined),
  ...patch,
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  guardMocks.requireRestaurantAccess.mockResolvedValue(true);
  authMocks.requireRole.mockReturnValue(undefined);
  modelMocks.MenuItem.countDocuments.mockResolvedValue(0);
  modelMocks.Ingredient.countDocuments.mockResolvedValue(0);
  modelMocks.Order.exists.mockResolvedValue(false);
});

describe("ModifierMutation", () => {
  it("preserves explicit null values so maximum and note can be cleared", async () => {
    const document = groupDocument();
    modelMocks.ModifierGroup.findById
      .mockResolvedValueOnce(document)
      .mockReturnValueOnce(resolvedGroupQuery({ id: "valid-g1" }));

    const { ModifierMutation } = await import(
      "../../graphql/resolvers/modifier/mutation.js"
    );

    await ModifierMutation.updateModifierGroup(
      null,
      {
        input: {
          id: "valid-g1",
          maxSelected: null,
          note: null,
        },
      },
      { user: { id: "valid-u1", userType: "manager" } },
    );

    expect(document.maxSelected).toBeNull();
    expect(document.note).toBeNull();
    expect(document.save).toHaveBeenCalledOnce();
  });

  it("checks modifier ingredients inside the selected restaurant", async () => {
    modelMocks.Ingredient.countDocuments.mockResolvedValueOnce(0);

    const { ModifierMutation } = await import(
      "../../graphql/resolvers/modifier/mutation.js"
    );

    await expect(
      ModifierMutation.createModifierGroup(
        null,
        {
          input: {
            restaurantId: "valid-r1",
            name: "Thêm sốt",
            groupType: "TOPPING",
            coverage: "GLOBAL",
            selectionType: "multiple",
            required: false,
            minSelected: 0,
            options: [
              {
                name: "Sốt phô mai",
                priceRule: { rule: "DELTA", amount: 5000 },
                inventoryRule: {
                  rule: "ADD_INGREDIENTS",
                  ingredientLines: [
                    {
                      ingredientId: "valid-i1",
                      qty: 10,
                      unit: "g",
                      wastePct: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
        { user: { id: "valid-u1", userType: "manager" } },
      ),
    ).rejects.toThrow("không thuộc nhà hàng");

    expect(modelMocks.Ingredient.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: expect.any(Object),
        _id: { $in: expect.any(Array) },
      }),
    );
    expect(modelMocks.ModifierGroup.create).not.toHaveBeenCalled();
  });

  it("moves the default marker when a new default option is added", async () => {
    const document = groupDocument({
      options: [option("Nhỏ", { _id: "valid-o1", isDefault: true })],
    });
    modelMocks.ModifierGroup.findById
      .mockResolvedValueOnce(document)
      .mockReturnValueOnce(resolvedGroupQuery({ id: "valid-g1" }));

    const { ModifierMutation } = await import(
      "../../graphql/resolvers/modifier/mutation.js"
    );

    await ModifierMutation.addModifierOption(
      null,
      {
        groupId: "valid-g1",
        option: {
          name: "Lớn",
          isDefault: true,
          priceRule: { rule: "DELTA", amount: 10000 },
          inventoryRule: { rule: "NONE", ingredientLines: [] },
        },
      },
      { user: { id: "valid-u1", userType: "manager" } },
    );

    expect(document.options).toHaveLength(2);
    expect(document.options.map((item) => item.isDefault)).toEqual([
      false,
      true,
    ]);
    expect(document.save).toHaveBeenCalledOnce();
  });

  it("blocks removing the final option from a group", async () => {
    const document = groupDocument();
    modelMocks.ModifierGroup.findById.mockResolvedValueOnce(document);

    const { ModifierMutation } = await import(
      "../../graphql/resolvers/modifier/mutation.js"
    );

    await expect(
      ModifierMutation.removeModifierOption(
        null,
        { groupId: "valid-g1", optionId: "valid-o1" },
        { user: { id: "valid-u1", userType: "manager" } },
      ),
    ).rejects.toThrow("ít nhất một lựa chọn");

    expect(document.save).not.toHaveBeenCalled();
  });
});
