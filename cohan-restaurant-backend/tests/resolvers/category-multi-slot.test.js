import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Category: { find: vi.fn() },
  Menu: { find: vi.fn() },
  MenuItem: { aggregate: vi.fn(), find: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

const mongooseMock = vi.hoisted(() => ({
  isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
  Types: {
    ObjectId: class ObjectId {
      constructor(value) {
        this.value = String(value);
      }
      toString() {
        return this.value;
      }
    },
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("mongoose", () => ({ default: mongooseMock }));

const categoryRows = [
  { _id: "valid-category-1", name: "Món chính" },
  { _id: "valid-category-2", name: "Đồ uống" },
];

const mockCategories = () => {
  modelMocks.Category.find.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(categoryRows),
    }),
  });
};

const mockMenus = (rows) => {
  modelMocks.Menu.find.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(rows),
    }),
  });
};

describe("CategoryMultiSlotQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(true);
    mockCategories();
    modelMocks.MenuItem.aggregate.mockResolvedValue([
      { _id: "valid-category-1", count: 3 },
    ]);
  });

  it("counts only the manager-selected menu when menuId is supplied", async () => {
    mockMenus([{ _id: "valid-menu-vip" }]);
    const { CategoryMultiSlotQuery } = await import(
      "../../graphql/resolvers/category/multiSlotQuery.js"
    );

    const result = await CategoryMultiSlotQuery.categories(
      null,
      {
        restaurantId: "valid-restaurant",
        timeSlot: "dinner",
        menuId: "valid-menu-vip",
      },
      { user: { id: "valid-user" } },
    );

    expect(modelMocks.Menu.find).toHaveBeenCalledWith({
      restaurantId: "valid-restaurant",
      _id: "valid-menu-vip",
      timeSlot: "dinner",
    });
    expect(modelMocks.MenuItem.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({
            menuId: { $in: ["valid-menu-vip"] },
          }),
        }),
      ]),
    );
    expect(result.map((category) => category.menuItemCount)).toEqual([3, 0]);
  });

  it("aggregates every menu when the caller only supplies a time slot", async () => {
    mockMenus([
      { _id: "valid-menu-vip" },
      { _id: "valid-menu-casual" },
    ]);
    const { CategoryMultiSlotQuery } = await import(
      "../../graphql/resolvers/category/multiSlotQuery.js"
    );

    await CategoryMultiSlotQuery.categories(
      null,
      {
        restaurantId: "valid-restaurant",
        timeSlot: "dinner",
      },
      { user: { id: "valid-user" } },
    );

    expect(modelMocks.Menu.find).toHaveBeenCalledWith({
      restaurantId: "valid-restaurant",
      timeSlot: "dinner",
    });
    expect(modelMocks.MenuItem.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({
            menuId: {
              $in: ["valid-menu-vip", "valid-menu-casual"],
            },
          }),
        }),
      ]),
    );
  });
});
