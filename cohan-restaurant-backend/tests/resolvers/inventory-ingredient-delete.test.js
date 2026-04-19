const modelMocks = vi.hoisted(() => ({
  Ingredient: {
    findById: vi.fn(),
    updateOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
  },
  Order: {
    findOne: vi.fn(),
  },
  IngredientRecent: {
    updateOne: vi.fn(),
  },
  IngredientCategory: {
    findOne: vi.fn(),
  },
  Recipe: {
    find: vi.fn(),
  },
  MenuItem: {
    find: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        return value;
      },
    },
  },
}));

describe("Inventory ingredient delete flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks delete when ingredient is used by active menu item", async () => {
    modelMocks.Ingredient.findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: "ing-1",
          restaurantId: "rest-1",
          name: "Thịt bò",
          deletedAt: null,
        }),
      }),
    });

    modelMocks.Recipe.find.mockReturnValue({
      select: () => ({
        lean: async () => [{ menuItemId: "menu-1" }],
      }),
    });

    modelMocks.MenuItem.find.mockReturnValue({
      select: () => ({
        sort: () => ({
          lean: async () => [{ _id: "menu-1", name: "Phở bò", status: "available" }],
        }),
      }),
    });

    const mutation = (await import("../../graphql/resolvers/inventory/ingredient.mutation.js"))
      .default;

    await expect(mutation.deleteIngredient(null, { id: "ing-1" })).rejects.toThrow(
      /Không thể xóa nguyên liệu/
    );
    expect(modelMocks.Ingredient.updateOne).not.toHaveBeenCalled();
  });

  it("soft-deletes ingredient for 30-day trash when no active menu item uses it", async () => {
    modelMocks.Ingredient.findById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: "ing-2",
          restaurantId: "rest-1",
          name: "Hành lá",
          deletedAt: null,
        }),
      }),
    });

    modelMocks.Recipe.find.mockReturnValue({
      select: () => ({
        lean: async () => [],
      }),
    });

    modelMocks.Ingredient.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const mutation = (await import("../../graphql/resolvers/inventory/ingredient.mutation.js"))
      .default;

    const result = await mutation.deleteIngredient(null, { id: "ing-2" });
    expect(result).toBe(true);
    expect(modelMocks.Ingredient.updateOne).toHaveBeenCalledTimes(1);
  });
});
