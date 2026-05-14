import { describe, it, expect, beforeEach, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Menu: { find: vi.fn(), findOne: vi.fn() },
  MenuItem: { find: vi.fn(), countDocuments: vi.fn() },
  Recipe: { find: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));

vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: {
        createFromHexString: vi.fn((v) => v),
      },
    },
  },
}));

function makeLeanChain(rows) {
  return {
    select: () => ({
      limit: () => ({
        lean: async () => rows,
      }),
      sort: () => ({
        limit: () => ({
          lean: async () => rows,
        }),
      }),
      lean: async () => rows,
    }),
  };
}

describe("Inventory recipe search", () => {
  beforeEach(() => {
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    vi.clearAllMocks();

    modelMocks.Menu.find.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: "menu-1" }],
      }),
    });

    modelMocks.MenuItem.countDocuments.mockResolvedValue(1);
  });

  it("matches recipe/menu item name diacritics-insensitively", async () => {
    modelMocks.MenuItem.find
      .mockReturnValueOnce(makeLeanChain([{ _id: "mi-1" }]))
      .mockReturnValueOnce({
        select: () => ({
          sort: () => ({
            limit: () => ({
              lean: async () => [
                { _id: "mi-1", name: "Bánh Phở Bò", description: "Món nước" },
              ],
            }),
          }),
        }),
      });

    modelMocks.Recipe.find
      .mockReturnValueOnce(makeLeanChain([{ menuItemId: "mi-1" }]))
      .mockReturnValueOnce({
        select: () => ({
          lean: async () => [
            {
              menuItemId: "mi-1",
              notes: "recipe",
              servingVariants: [{ name: "Tô lớn" }],
            },
          ],
        }),
      });

    const recipeQuery = (await import("../../graphql/resolvers/inventory/recipe.query.js"))
      .default;

    const result = await recipeQuery.menuItemsWithRecipes(null, {
      restaurantId: "67a1f8f6a2df3b17f0c12345",
      search: "banh pho",
      first: 30,
    }, { user: { id: "u1", roleName: "manager" } });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].menuItem.name).toBe("Bánh Phở Bò");
  });

  it("does not use servingVariants.key as a noisy search field", async () => {
    modelMocks.MenuItem.find.mockReturnValue(makeLeanChain([]));
    modelMocks.Recipe.find.mockReturnValue(makeLeanChain([]));

    const recipeQuery = (await import("../../graphql/resolvers/inventory/recipe.query.js"))
      .default;

    const result = await recipeQuery.menuItemsWithRecipes(null, {
      restaurantId: "67a1f8f6a2df3b17f0c12345",
      search: "sv_default",
      first: 30,
    }, { user: { id: "u1", roleName: "manager" } });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
