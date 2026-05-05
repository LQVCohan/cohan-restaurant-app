import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Coupon: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
  VoucherPackage: {
    find: vi.fn(),
  },
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("mongoose", () => ({
  default: {
    isValidObjectId: vi.fn((value) => String(value || "").startsWith("valid-")),
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

describe("couponByCode restaurant scoping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("requires restaurantId and does not fallback to global code lookup", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await expect(
      CouponQuery.couponByCode(null, { code: "FOOD10" }),
    ).rejects.toThrow("restaurantId is required for coupon lookup");

    expect(modelMocks.Coupon.findOne).not.toHaveBeenCalled();
  });

  it("rejects malformed restaurantId and does not fallback to global code lookup", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await expect(
      CouponQuery.couponByCode(null, { code: "FOOD10", restaurantId: "bad-id" }),
    ).rejects.toThrow("restaurantId is required for coupon lookup");

    expect(modelMocks.Coupon.findOne).not.toHaveBeenCalled();
  });

  it("looks up coupon by normalized code scoped to restaurantId", async () => {
    modelMocks.Coupon.findOne.mockReturnValue(mockLeanQuery({ id: "coupon-1" }));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.couponByCode(null, {
      code: " food10 ",
      restaurantId: "valid-restaurant-1",
    });

    expect(modelMocks.Coupon.findOne).toHaveBeenCalledWith({
      code: "FOOD10",
      restaurantId: expect.objectContaining({ value: "valid-restaurant-1" }),
    });
  });
});
