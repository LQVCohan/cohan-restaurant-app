import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Promotion: {
    create: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn(() => true),
    Types: {
      ObjectId: function ObjectId(value) {
        this.value = value;
      },
    },
  },
}));

const mockLeanQuery = (value) => ({
  lean: vi.fn().mockResolvedValue(value),
});

const mockFindChain = () => {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue([]),
  };
  modelMocks.Promotion.find.mockReturnValue(chain);
  return chain;
};

describe("Promotion validation and query filtering", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("accepts FREESHIP with discountValue = 0 when scope is ORDER", async () => {
    modelMocks.Promotion.create.mockResolvedValue({ _id: "promotion-freeship" });
    modelMocks.Promotion.findById.mockReturnValue(mockLeanQuery({ id: "promotion-freeship" }));

    const { PromotionMutation } = await import("../../graphql/resolvers/promotion/mutation.js");

    await expect(
      PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Free ship",
            restaurantId: "restaurant-1",
            promotionType: "FREESHIP",
            scope: "ORDER",
            discountValue: 0,
          },
        },
        { user: { roleName: "manager" } },
      ),
    ).resolves.toBeTruthy();
  });

  it("rejects FREESHIP outside ORDER scope", async () => {
    const { PromotionMutation } = await import("../../graphql/resolvers/promotion/mutation.js");

    await expect(
      PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Free ship",
            restaurantId: "restaurant-1",
            promotionType: "FREESHIP",
            scope: "ITEM",
            itemId: "item-1",
            discountValue: 0,
          },
        },
        { user: { roleName: "manager" } },
      ),
    ).rejects.toThrow("FREESHIP promotion requires ORDER scope");
  });

  it("builds active promotions query with date and usage-limit constraints", async () => {
    const chain = mockFindChain();
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");

    await PromotionQuery.promotionsByRestaurant(null, {
      restaurantId: "restaurant-1",
      activeOnly: true,
      now: "2026-05-04T00:00:00.000Z",
    });

    const passedQuery = modelMocks.Promotion.find.mock.calls[0][0];
    expect(passedQuery.isActive).toBe(true);
    expect(passedQuery.$and).toHaveLength(2);
    expect(passedQuery.$expr).toEqual({
      $or: [{ $lte: ["$usageLimit", 0] }, { $lt: ["$usageCount", "$usageLimit"] }],
    });
    expect(chain.sort).toHaveBeenCalled();
  });
});
