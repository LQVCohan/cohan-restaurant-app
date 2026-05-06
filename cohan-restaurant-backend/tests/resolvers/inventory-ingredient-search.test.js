const modelMocks = vi.hoisted(() => ({
  Ingredient: {
    find: vi.fn(),
    deleteMany: vi.fn(),
  },
  Recipe: {},
  IngredientRecent: {},
  MenuItem: {},
  StockMovement: {},
}));

vi.mock("../../models/index.js", () => modelMocks);
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn(async () => true) }));

vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
  },
}));

describe("Inventory ingredient search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not match unrelated category-like text and keeps name+sku only", async () => {
    const rows = [
      {
        _id: "1",
        name: "Bánh Phở",
        sku: "BPHO-01",
        category: "starch",
      },
      {
        _id: "2",
        name: "Sả",
        sku: "SAR-01",
        category: "herb",
      },
    ];

    modelMocks.Ingredient.find.mockReturnValue({
      select: () => ({
        lean: async () => rows,
      }),
    });

    const ingredientQuery = (await import("../../graphql/resolvers/inventory/ingredient.query.js"))
      .default;

    const result = await ingredientQuery.ingredients(
      null,
      {
        restaurantId: "67a1f8f6a2df3b17f0c12345",
        search: "S",
        limit: 50,
      },
      { user: { id: "u1" } }
    );

    expect(result.map((it) => it.name)).toEqual(["Sả"]);
  });

  it("matches Vietnamese diacritics-insensitively for ingredient name", async () => {
    const rows = [
      { _id: "1", name: "Bánh Phở", sku: "BPHO-01" },
      { _id: "2", name: "Nước mắm", sku: "FISH-01" },
    ];

    modelMocks.Ingredient.find.mockReturnValue({
      select: () => ({
        lean: async () => rows,
      }),
    });

    const ingredientQuery = (await import("../../graphql/resolvers/inventory/ingredient.query.js"))
      .default;

    const result = await ingredientQuery.ingredients(
      null,
      {
        restaurantId: "67a1f8f6a2df3b17f0c12345",
        search: "banh pho",
        limit: 50,
      },
      { user: { id: "u1" } }
    );

    expect(result.map((it) => it.name)).toEqual(["Bánh Phở"]);
  });

  it("prioritizes name matches before sku matches", async () => {
    const rows = [
      { _id: "1", name: "Sốt mè rang", sku: "AA-001" },
      { _id: "2", name: "Bánh Phở", sku: "S-001" },
    ];

    modelMocks.Ingredient.find.mockReturnValue({
      select: () => ({
        lean: async () => rows,
      }),
    });

    const ingredientQuery = (await import("../../graphql/resolvers/inventory/ingredient.query.js"))
      .default;

    const result = await ingredientQuery.ingredients(
      null,
      {
        restaurantId: "67a1f8f6a2df3b17f0c12345",
        search: "s",
        limit: 50,
      },
      { user: { id: "u1" } }
    );

    expect(result.map((it) => it._id)).toEqual(["1", "2"]);
  });
});
