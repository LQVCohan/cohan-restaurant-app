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

const guardMocks = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  requireRoles: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
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

const mockFindChain = (value) => ({
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

describe("coupon query restaurant scoping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(undefined);
    guardMocks.requireRoles.mockImplementation(() => undefined);
  });

  it("coupons with restaurantId calls requireRestaurantAccess and Coupon.find", async () => {
    modelMocks.Coupon.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const ctx = { user: { roleName: "manager" } };

    await CouponQuery.coupons(null, { restaurantId: "valid-r1" }, ctx);

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(ctx, expect.objectContaining({ value: "valid-r1" }));
    expect(modelMocks.Coupon.find).toHaveBeenCalled();
  });

  it("coupons without restaurantId calls requireRoles ADMIN", async () => {
    modelMocks.Coupon.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const ctx = { user: { roleName: "admin" } };

    await CouponQuery.coupons(null, {}, ctx);

    expect(guardMocks.requireRoles).toHaveBeenCalledWith(ctx, ["ADMIN"]);
  });

  it("coupons without restaurantId blocks when requireRoles throws", async () => {
    guardMocks.requireRoles.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await expect(CouponQuery.coupons(null, {}, { user: { roleName: "manager" } })).rejects.toThrow("Forbidden");
    expect(modelMocks.Coupon.find).not.toHaveBeenCalled();
  });

  it("couponByCode calls requireRestaurantAccess before findOne", async () => {
    modelMocks.Coupon.findOne.mockReturnValue(mockLeanQuery({ id: "coupon-1" }));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const ctx = { user: { roleName: "manager" } };

    await CouponQuery.couponByCode(null, { code: " food10 ", restaurantId: "valid-r2" }, ctx);

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(ctx, expect.objectContaining({ value: "valid-r2" }));
    expect(modelMocks.Coupon.findOne).toHaveBeenCalledWith({
      code: "FOOD10",
      restaurantId: expect.objectContaining({ value: "valid-r2" }),
    });
  });

  it("voucherPackages with restaurantId calls requireRestaurantAccess", async () => {
    modelMocks.VoucherPackage.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const ctx = { user: { roleName: "manager" } };

    await CouponQuery.voucherPackages(null, { restaurantId: "valid-r3" }, ctx);

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(ctx, expect.objectContaining({ value: "valid-r3" }));
  });

  it("voucherPackages without restaurantId calls requireRoles ADMIN", async () => {
    modelMocks.VoucherPackage.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const ctx = { user: { roleName: "admin" } };

    await CouponQuery.voucherPackages(null, {}, ctx);

    expect(guardMocks.requireRoles).toHaveBeenCalledWith(ctx, ["ADMIN"]);
  });
});
