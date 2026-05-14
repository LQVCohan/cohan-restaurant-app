import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Promotion: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    find: vi.fn(),
  },
}));

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
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
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
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

    const ctx = { user: { roleName: "manager" } };
    await PromotionQuery.promotionsByRestaurant(
      null,
      {
        restaurantId: "restaurant-1",
        activeOnly: true,
        now: "2026-05-04T00:00:00.000Z",
      },
      ctx,
    );

    const passedQuery = modelMocks.Promotion.find.mock.calls[0][0];
    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(passedQuery.isActive).toBe(true);
    expect(passedQuery.$and).toHaveLength(2);
    expect(passedQuery.$expr).toEqual({
      $or: [{ $lte: ["$usageLimit", 0] }, { $lt: ["$usageCount", "$usageLimit"] }],
    });
    expect(chain.sort).toHaveBeenCalled();
  });

  it("blocks admin promotion listings when restaurant access is denied", async () => {
    mockFindChain();
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PromotionQuery } = await import("../../graphql/resolvers/promotion/query.js");

    await expect(
      PromotionQuery.promotionsByRestaurant(
        null,
        { restaurantId: "restaurant-1", activeOnly: false },
        { user: { roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Promotion.find).not.toHaveBeenCalled();
  });

  it("createPromotion calls restaurant access guard and create", async () => {
    modelMocks.Promotion.create.mockResolvedValue({ _id: "promotion-1" });
    modelMocks.Promotion.findById.mockReturnValue(mockLeanQuery({ id: "promotion-1" }));
    const ctx = { user: { roleName: "manager" } };
    const { PromotionMutation } = await import("../../graphql/resolvers/promotion/mutation.js");

    await PromotionMutation.createPromotion(
      null,
      { input: { name: "Promo", restaurantId: "restaurant-1", discountValue: 10 } },
      ctx,
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(modelMocks.Promotion.create).toHaveBeenCalled();
  });

  it("createPromotion blocks when restaurant access is denied", async () => {
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PromotionMutation } = await import("../../graphql/resolvers/promotion/mutation.js");

    await expect(
      PromotionMutation.createPromotion(
        null,
        { input: { name: "Promo", restaurantId: "restaurant-1", discountValue: 10 } },
        { user: { roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Promotion.create).not.toHaveBeenCalled();
  });

  it("updatePromotion guards existing restaurant and preserves existing restaurantId", async () => {
    modelMocks.Promotion.findById
      .mockReturnValueOnce(mockLeanQuery({ _id: "promotion-1", restaurantId: "restaurant-existing" }))
      .mockReturnValueOnce(mockLeanQuery({ id: "promotion-1" }));
    modelMocks.Promotion.findByIdAndUpdate.mockResolvedValue({ _id: "promotion-1" });
    const { PromotionMutation } = await import("../../graphql/resolvers/promotion/mutation.js");

    await PromotionMutation.updatePromotion(
      null,
      {
        id: "promotion-1",
        input: {
          name: "Updated",
          restaurantId: "restaurant-other",
          discountValue: 10,
        },
      },
      { user: { roleName: "manager" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      { user: { roleName: "manager" } },
      "restaurant-existing",
    );
    expect(modelMocks.Promotion.findByIdAndUpdate).toHaveBeenCalled();
    const payload = modelMocks.Promotion.findByIdAndUpdate.mock.calls[0][1];
    expect(payload.restaurantId).toBe("restaurant-existing");
  });

  it("deletePromotion blocks cross-restaurant access", async () => {
    modelMocks.Promotion.findById.mockReturnValue(
      mockLeanQuery({ _id: "promotion-1", restaurantId: "restaurant-existing" }),
    );
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PromotionMutation } = await import("../../graphql/resolvers/promotion/mutation.js");

    await expect(
      PromotionMutation.deletePromotion(null, { id: "promotion-1" }, { user: { roleName: "manager" } }),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Promotion.deleteOne).not.toHaveBeenCalled();
  });

  it("togglePromotion blocks cross-restaurant access", async () => {
    modelMocks.Promotion.findById.mockReturnValue(
      mockLeanQuery({ _id: "promotion-1", restaurantId: "restaurant-existing" }),
    );
    guardMocks.requireRestaurantAccess.mockRejectedValue(new Error("FORBIDDEN_SCOPE"));
    const { PromotionMutation } = await import("../../graphql/resolvers/promotion/mutation.js");

    await expect(
      PromotionMutation.togglePromotion(
        null,
        { id: "promotion-1", isActive: false },
        { user: { roleName: "manager" } },
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Promotion.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
