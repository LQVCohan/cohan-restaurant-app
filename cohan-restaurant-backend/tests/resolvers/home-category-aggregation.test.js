import {
  aggregateGlobalHomeCategories,
  normalizeHomeCategoryName,
} from "../../graphql/resolvers/category/homeCategoryAggregation.js";

describe("homepage category aggregation", () => {
  it("normalizes Vietnamese category names", () => {
    expect(normalizeHomeCategoryName("  Đồ uống & Trà  ")).toBe("do uong tra");
  });

  it("merges restaurant-specific category ids with the same normalized name", () => {
    const result = aggregateGlobalHomeCategories({
      countRows: [
        { _id: "drink-restaurant-a", menuItemCount: 3 },
        { _id: "drink-restaurant-b", menuItemCount: 5 },
        { _id: "seafood-restaurant-a", menuItemCount: 6 },
      ],
      categories: [
        { _id: "drink-restaurant-a", name: "Đồ uống", order: 2 },
        { _id: "drink-restaurant-b", name: "Do uong", order: 1 },
        { _id: "seafood-restaurant-a", name: "Hải sản", order: 3 },
      ],
      limit: 6,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "drink-restaurant-b",
      name: "Do uong",
      menuItemCount: 8,
    });
    expect(result[1]).toMatchObject({
      id: "seafood-restaurant-a",
      menuItemCount: 6,
    });
  });

  it("ignores categories without available menu items and respects the limit", () => {
    const result = aggregateGlobalHomeCategories({
      countRows: [
        { _id: "c1", menuItemCount: 2 },
        { _id: "c2", menuItemCount: 0 },
        { _id: "c3", menuItemCount: 1 },
      ],
      categories: [
        { _id: "c1", name: "Món Việt", order: 1 },
        { _id: "c2", name: "Không còn món", order: 2 },
        { _id: "c3", name: "Hải sản", order: 3 },
      ],
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "c1", menuItemCount: 2 });
  });
});
