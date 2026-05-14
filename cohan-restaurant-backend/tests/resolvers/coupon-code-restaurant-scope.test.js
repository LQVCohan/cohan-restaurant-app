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


  it("requires restaurantId and does not fallback to global code lookup", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await expect(
      CouponQuery.couponByCode(null, { code: "FOOD10" }, { user: { roleName: "manager" } }),
    ).rejects.toThrow("restaurantId is required for coupon lookup");

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Coupon.findOne).not.toHaveBeenCalled();
  });

  it("rejects malformed restaurantId and does not fallback to global code lookup", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await expect(
      CouponQuery.couponByCode(
        null,
        { code: "FOOD10", restaurantId: "bad-id" },
        { user: { roleName: "manager" } },
      ),
    ).rejects.toThrow("restaurantId is required for coupon lookup");

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Coupon.findOne).not.toHaveBeenCalled();
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

  it("couponByCode is public but remains restaurant-scoped and active-only", async () => {
    modelMocks.Coupon.findOne.mockReturnValue(mockLeanQuery({ id: "coupon-1" }));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const ctx = { user: { roleName: "manager" } };

    await CouponQuery.couponByCode(null, { code: " food10 ", restaurantId: "valid-r2" }, ctx);

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.Coupon.findOne).toHaveBeenCalledWith(expect.objectContaining({
      code: "FOOD10",
      restaurantId: expect.objectContaining({ value: "valid-r2" }),
      isActive: true,
    }));
  });

  it("voucherPackages with restaurantId is public but filters active packages", async () => {
    modelMocks.VoucherPackage.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const ctx = { user: { roleName: "manager" } };

    await CouponQuery.voucherPackages(null, { restaurantId: "valid-r3" }, ctx);

    expect(guardMocks.requireRestaurantAccess).not.toHaveBeenCalled();
    expect(modelMocks.VoucherPackage.find).toHaveBeenCalledWith({
      restaurantId: expect.objectContaining({ value: "valid-r3" }),
      isActive: true,
    });
  });

  it("voucherPackages without restaurantId calls requireRoles ADMIN", async () => {
    modelMocks.VoucherPackage.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const ctx = { user: { roleName: "admin" } };

    await CouponQuery.voucherPackages(null, {}, ctx);

    expect(guardMocks.requireRoles).toHaveBeenCalledWith(ctx, ["ADMIN"]);
  });
});
