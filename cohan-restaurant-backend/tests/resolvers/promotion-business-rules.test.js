import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Promotion: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
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

describe("PromotionMutation business rules", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rejects BOGO promotions when the gifted item is missing", async () => {
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    let thrownError = null;
    try {
      await PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Mua 1 tang 1",
            restaurantId: "restaurant-1",
            promotionType: "BOGO",
            scope: "ITEM",
            itemId: "item-buy",
            buyQuantity: 1,
            getQuantity: 1,
            discountValue: 0,
            startAt: "2026-05-01T03:00:00.000Z",
            endAt: "2026-05-05T15:00:00.000Z",
          },
        },
        { user: { roleName: "manager" } },
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError?.message).toBe("BOGO promotion requires giftItemId");
    expect(modelMocks.Promotion.create).not.toHaveBeenCalled();
  });

  it("persists BOGO item and gift item data for downstream inventory handling", async () => {
    modelMocks.Promotion.create.mockResolvedValue({ _id: "promotion-1" });
    modelMocks.Promotion.findById.mockReturnValue(
      mockLeanQuery({
        id: "promotion-1",
        name: "Mua 1 tang 1",
        itemId: "item-buy",
        giftItemId: "item-gift",
        buyQuantity: 1,
        getQuantity: 1,
      }),
    );

    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    const result = await PromotionMutation.createPromotion(
      null,
      {
        input: {
          name: "Mua 1 tang 1",
          restaurantId: "restaurant-1",
          promotionType: "BOGO",
          scope: "ITEM",
          itemId: "item-buy",
          giftItemId: "item-gift",
          buyQuantity: 1,
          getQuantity: 1,
          discountValue: 0,
          startAt: "2026-05-01T03:00:00.000Z",
          endAt: "2026-05-05T15:00:00.000Z",
        },
      },
      { user: { roleName: "manager" } },
    );

    expect(modelMocks.Promotion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        promotionType: "BOGO",
        scope: "ITEM",
        itemId: expect.objectContaining({ value: "item-buy" }),
        giftItemId: expect.objectContaining({ value: "item-gift" }),
        buyQuantity: 1,
        getQuantity: 1,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: "promotion-1",
        itemId: "item-buy",
        giftItemId: "item-gift",
      }),
    );
  });
});
