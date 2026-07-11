import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Category: {
    exists: vi.fn(),
  },
  MenuItem: {
    countDocuments: vi.fn(),
  },
  Promotion: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
    find: vi.fn(),
  },
}));

const authorizationMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/auth/authorization.service.js", () =>
  authorizationMocks,
);
vi.mock("mongoose", () => {
  function ObjectId(value) {
    this.value = value;
  }
  ObjectId.prototype.toString = function toString() {
    return String(this.value);
  };

  return {
    default: {
      isValidObjectId: vi.fn((value) => Boolean(value)),
      Types: { ObjectId },
    },
  };
});

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

const managerContext = {
  user: { id: "manager-1", roleName: "manager" },
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  authorizationMocks.requireRestaurantPermission.mockResolvedValue(undefined);
  modelMocks.Category.exists.mockResolvedValue(true);
  modelMocks.MenuItem.countDocuments.mockImplementation(({ _id }) =>
    Promise.resolve(_id?.$in?.length || 0),
  );
});

describe("Promotion validation and query filtering", () => {
  it("accepts FREESHIP with zero discount when scope is ORDER", async () => {
    modelMocks.Promotion.create.mockResolvedValue({ _id: "promotion-freeship" });
    modelMocks.Promotion.findById.mockReturnValue(
      mockLeanQuery({ _id: "promotion-freeship", restaurantId: "restaurant-1" }),
    );

    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

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
        managerContext,
      ),
    ).resolves.toBeTruthy();

    expect(modelMocks.Promotion.create.mock.calls[0][0]).toMatchObject({
      promotionType: "FREESHIP",
      scope: "ORDER",
      discountType: "AMOUNT",
      discountValue: 0,
    });
  });

  it("rejects unknown promotion types instead of silently storing percentage", async () => {
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await expect(
      PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Unknown",
            restaurantId: "restaurant-1",
            promotionType: "MAGIC",
            discountValue: 10,
          },
        },
        managerContext,
      ),
    ).rejects.toThrow("promotionType không hợp lệ");
    expect(modelMocks.Promotion.create).not.toHaveBeenCalled();
  });

  it("rejects BOGO outside ITEM scope", async () => {
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await expect(
      PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Mua tặng",
            restaurantId: "restaurant-1",
            promotionType: "BOGO",
            scope: "ORDER",
            itemId: "item-1",
            giftItemId: "item-2",
            buyQuantity: 1,
            getQuantity: 1,
          },
        },
        managerContext,
      ),
    ).rejects.toThrow("BOGO chỉ hỗ trợ phạm vi ITEM");
  });

  it("rejects levels outside the persisted model range", async () => {
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await expect(
      PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Too high",
            restaurantId: "restaurant-1",
            promotionType: "PERCENTAGE",
            discountValue: 10,
            level: 4,
          },
        },
        managerContext,
      ),
    ).rejects.toThrow("level phải là số nguyên từ 1 đến 3");
  });

  it("rejects category references from another restaurant", async () => {
    modelMocks.Category.exists.mockResolvedValue(false);
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await expect(
      PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Category promo",
            restaurantId: "restaurant-1",
            promotionType: "PERCENTAGE",
            scope: "CATEGORY",
            categoryId: "category-other",
            discountValue: 10,
          },
        },
        managerContext,
      ),
    ).rejects.toThrow("Danh mục áp dụng không thuộc nhà hàng đã chọn");
    expect(modelMocks.Promotion.create).not.toHaveBeenCalled();
  });

  it("rejects any item reference outside the promotion restaurant", async () => {
    modelMocks.MenuItem.countDocuments.mockResolvedValue(1);
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await expect(
      PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Mua tặng",
            restaurantId: "restaurant-1",
            promotionType: "BOGO",
            scope: "ITEM",
            itemId: "item-1",
            giftItemId: "item-other",
            buyQuantity: 1,
            getQuantity: 1,
          },
        },
        managerContext,
      ),
    ).rejects.toThrow("Một hoặc nhiều món không thuộc nhà hàng đã chọn");
  });

  it("builds active queries with date and usage-limit constraints", async () => {
    const chain = mockFindChain();
    const { PromotionQuery } = await import(
      "../../graphql/resolvers/promotion/query.js"
    );

    await PromotionQuery.promotionsByRestaurant(
      null,
      {
        restaurantId: "restaurant-1",
        activeOnly: true,
        now: "2026-05-04T00:00:00.000Z",
      },
      managerContext,
    );

    const passedQuery = modelMocks.Promotion.find.mock.calls[0][0];
    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(passedQuery.isActive).toBe(true);
    expect(passedQuery.$and).toHaveLength(2);
    expect(passedQuery.$expr).toEqual({
      $or: [
        { $lte: ["$usageLimit", 0] },
        { $lt: ["$usageCount", "$usageLimit"] },
      ],
    });
    expect(chain.sort).toHaveBeenCalled();
  });

  it("requires restaurant permission for management listings", async () => {
    mockFindChain();
    authorizationMocks.requireRestaurantPermission.mockRejectedValue(
      new Error("FORBIDDEN_SCOPE"),
    );
    const { PromotionQuery } = await import(
      "../../graphql/resolvers/promotion/query.js"
    );

    await expect(
      PromotionQuery.promotionsByRestaurant(
        null,
        { restaurantId: "restaurant-1", activeOnly: false },
        managerContext,
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Promotion.find).not.toHaveBeenCalled();
  });

  it("creates only after promotion permission and reference checks", async () => {
    modelMocks.Promotion.create.mockResolvedValue({ _id: "promotion-1" });
    modelMocks.Promotion.findById.mockReturnValue(
      mockLeanQuery({ _id: "promotion-1", restaurantId: "restaurant-1" }),
    );
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await PromotionMutation.createPromotion(
      null,
      {
        input: {
          name: "Promo",
          restaurantId: "restaurant-1",
          discountValue: 10,
        },
      },
      managerContext,
    );

    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalled();
    expect(modelMocks.Promotion.create).toHaveBeenCalled();
  });

  it("blocks create when restaurant permission is denied", async () => {
    authorizationMocks.requireRestaurantPermission.mockRejectedValue(
      new Error("FORBIDDEN_SCOPE"),
    );
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await expect(
      PromotionMutation.createPromotion(
        null,
        {
          input: {
            name: "Promo",
            restaurantId: "restaurant-1",
            discountValue: 10,
          },
        },
        managerContext,
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Promotion.create).not.toHaveBeenCalled();
  });

  it("rejects attempted restaurant moves instead of reporting a false success", async () => {
    modelMocks.Promotion.findById.mockReturnValue(
      mockLeanQuery({ _id: "promotion-1", restaurantId: "restaurant-existing" }),
    );
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await expect(
      PromotionMutation.updatePromotion(
        null,
        {
          id: "promotion-1",
          input: {
            name: "Updated",
            restaurantId: "restaurant-other",
            discountValue: 10,
          },
        },
        managerContext,
      ),
    ).rejects.toThrow("Không thể chuyển khuyến mãi sang nhà hàng khác");
    expect(modelMocks.Promotion.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("updates within the original restaurant with model validators enabled", async () => {
    modelMocks.Promotion.findById
      .mockReturnValueOnce(
        mockLeanQuery({
          _id: "promotion-1",
          restaurantId: "restaurant-existing",
        }),
      )
      .mockReturnValueOnce(
        mockLeanQuery({
          _id: "promotion-1",
          restaurantId: "restaurant-existing",
        }),
      );
    modelMocks.Promotion.findByIdAndUpdate.mockResolvedValue({
      _id: "promotion-1",
    });
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await PromotionMutation.updatePromotion(
      null,
      {
        id: "promotion-1",
        input: {
          name: "Updated",
          restaurantId: "restaurant-existing",
          discountValue: 10,
        },
      },
      managerContext,
    );

    expect(modelMocks.Promotion.findByIdAndUpdate).toHaveBeenCalledWith(
      "promotion-1",
      expect.objectContaining({ name: "Updated" }),
      { new: true, runValidators: true },
    );
  });

  it("blocks delete and toggle when permission is denied", async () => {
    modelMocks.Promotion.findById.mockReturnValue(
      mockLeanQuery({ _id: "promotion-1", restaurantId: "restaurant-existing" }),
    );
    authorizationMocks.requireRestaurantPermission.mockRejectedValue(
      new Error("FORBIDDEN_SCOPE"),
    );
    const { PromotionMutation } = await import(
      "../../graphql/resolvers/promotion/mutation.js"
    );

    await expect(
      PromotionMutation.deletePromotion(null, { id: "promotion-1" }, managerContext),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    await expect(
      PromotionMutation.togglePromotion(
        null,
        { id: "promotion-1", isActive: false },
        managerContext,
      ),
    ).rejects.toThrow("FORBIDDEN_SCOPE");
    expect(modelMocks.Promotion.deleteOne).not.toHaveBeenCalled();
    expect(modelMocks.Promotion.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
