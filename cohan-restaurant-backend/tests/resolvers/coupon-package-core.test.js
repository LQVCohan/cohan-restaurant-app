import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Coupon: {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  },
  VoucherPackage: {
    create: vi.fn(),
    find: vi.fn(),
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

const mockFindChain = (result) => {
  const chain = {
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn().mockResolvedValue(result),
  };
  return chain;
};

describe("Coupon and voucher package core flows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a usable coupon payload with non-null id after create", async () => {
    modelMocks.Coupon.create.mockResolvedValue({ _id: "coupon-1" });
    modelMocks.Coupon.findById.mockReturnValue(
      mockLeanQuery({
        id: "coupon-1",
        name: "Voucher food",
        restaurantId: "restaurant-1",
      }),
    );

    const { CouponMutation } = await import(
      "../../graphql/resolvers/coupon/mutation.js"
    );

    const result = await CouponMutation.createCoupon(
      null,
      {
        input: {
          name: "Voucher food",
          code: "FOOD10",
          category: "food",
          discountType: "PERCENT",
          discountValue: 10,
          publishAt: "2026-05-01T03:00:00.000Z",
          startAt: "2026-05-01T03:00:00.000Z",
          endAt: "2026-05-05T15:00:00.000Z",
          restaurantId: "restaurant-1",
        },
      },
      { user: { roleName: "manager" } },
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: "coupon-1",
        restaurantId: "restaurant-1",
      }),
    );
  });

  it("rejects invalid DateTime input early for coupon create", async () => {
    const { CouponMutation } = await import(
      "../../graphql/resolvers/coupon/mutation.js"
    );

    let thrownError = null;
    try {
      await CouponMutation.createCoupon(
        null,
        {
          input: {
            name: "Voucher food",
            code: "FOOD10",
            category: "food",
            discountType: "PERCENT",
            discountValue: 10,
            startAt: "not-a-date",
            endAt: "2026-05-05T15:00:00.000Z",
            restaurantId: "restaurant-1",
          },
        },
        { user: { roleName: "manager" } },
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError?.message).toBe("Invalid startAt");
    expect(modelMocks.Coupon.create).not.toHaveBeenCalled();
  });

  it("filters coupon queries by the selected restaurant", async () => {
    const findChain = mockFindChain([{ id: "coupon-1" }]);
    modelMocks.Coupon.find.mockReturnValue(findChain);

    const { CouponQuery } = await import(
      "../../graphql/resolvers/coupon/query.js"
    );

    await CouponQuery.coupons(null, {
      restaurantId: "restaurant-2",
      activeOnly: false,
      limit: 50,
      offset: 0,
    });

    expect(modelMocks.Coupon.find).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: expect.objectContaining({ value: "restaurant-2" }),
      }),
    );
  });

  it("returns voucher packages with non-null id after create", async () => {
    modelMocks.VoucherPackage.create.mockResolvedValue({ _id: "package-1" });
    modelMocks.VoucherPackage.findById.mockReturnValue(
      mockLeanQuery({
        id: "package-1",
        name: "Goi VIP",
        restaurantId: "restaurant-1",
        voucherIds: ["coupon-1"],
      }),
    );

    const { CouponMutation } = await import(
      "../../graphql/resolvers/coupon/mutation.js"
    );

    const result = await CouponMutation.createVoucherPackage(
      null,
      {
        input: {
          name: "Goi VIP",
          code: "VIP-01",
          voucherIds: ["coupon-1"],
          startAt: "2026-05-01T03:00:00.000Z",
          endAt: "2026-05-05T15:00:00.000Z",
          restaurantId: "restaurant-1",
        },
      },
      { user: { roleName: "manager" } },
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: "package-1",
        restaurantId: "restaurant-1",
        voucherIds: ["coupon-1"],
      }),
    );
  });
});
