import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Menu: { find: vi.fn(), findOne: vi.fn() },
  MenuItem: { aggregate: vi.fn() },
  Category: { find: vi.fn() },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = String(value);
        this.toString = () => this.value;
      },
    },
  },
}));

const categoryRows = [
  { _id: "valid-category-vip", name: "Món VIP", isActive: true },
  { _id: "valid-category-casual", name: "Món ăn chơi", isActive: true },
];

const mockCategories = () => {
  modelMocks.Category.find.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(categoryRows),
    }),
  });
};

const findChain = (rows) => ({ lean: vi.fn().mockResolvedValue(rows) });
const findOneChain = (row) => ({ lean: vi.fn().mockResolvedValue(row) });

describe("customer menu category selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCategories();
    modelMocks.MenuItem.aggregate.mockResolvedValue([
      { _id: "valid-category-vip", count: 4 },
    ]);
  });

  it("counts categories only from the selected active menu", async () => {
    modelMocks.Menu.findOne.mockReturnValue(
      findOneChain({ _id: "valid-menu-vip" }),
    );
    const { CustomerCategoryQuery } = await import(
      "../../graphql/resolvers/category/customerQuery.js"
    );

    const rows = await CustomerCategoryQuery.customerMenuCategories(null, {
      restaurantId: "valid-restaurant",
      timeSlot: "dinner",
      menuId: "valid-menu-vip",
    });

    expect(modelMocks.Menu.findOne).toHaveBeenCalledWith({
      _id: "valid-menu-vip",
      restaurantId: "valid-restaurant",
      timeSlot: "dinner",
      isActive: true,
    });
    expect(modelMocks.Menu.find).not.toHaveBeenCalled();
    expect(modelMocks.MenuItem.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({
            menuId: { $in: ["valid-menu-vip"] },
          }),
        }),
      ]),
    );
    expect(rows.map((row) => row.name)).toEqual(["Món VIP"]);
  });

  it("keeps same-slot aggregation for callers that omit menuId", async () => {
    modelMocks.Menu.find.mockReturnValue(
      findChain([
        { _id: "valid-menu-vip" },
        { _id: "valid-menu-casual" },
      ]),
    );
    const { CustomerCategoryQuery } = await import(
      "../../graphql/resolvers/category/customerQuery.js"
    );

    await CustomerCategoryQuery.customerMenuCategories(null, {
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
