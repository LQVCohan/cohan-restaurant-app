import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Coupon: { findOne: vi.fn(), find: vi.fn() },
  VoucherPackage: { find: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({ requireRoles: vi.fn() }));
const authorizationMocks = vi.hoisted(() => ({
  requireRestaurantPermission: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../graphql/guards.js", () => guardMocks);
vi.mock("../../src/services/auth/authorization.service.js", () => authorizationMocks);
vi.mock("../../src/constants/permissions.js", () => ({
  PERMISSIONS: { COUPON_READ: "coupon.read" },
}));
vi.mock("../../src/services/checkoutCouponEligibility.service.js", () => ({
  evaluateCheckoutCouponEligibilities: vi.fn(),
}));
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

const mockLeanQuery = (value) => ({ lean: vi.fn().mockResolvedValue(value) });
const mockFindChain = (value) => {
  const chain = {
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn(async () => value),
  };
  return chain;
};

const managerCtx = { user: { id: "manager-1", roleName: "manager" } };

describe("coupon query restaurant scoping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    guardMocks.requireRoles.mockImplementation(() => undefined);
    authorizationMocks.requireRestaurantPermission.mockResolvedValue(true);
  });

  it("requires restaurantId and never falls back to a global code lookup", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    await expect(
      CouponQuery.couponByCode(null, { code: "FOOD10" }, managerCtx),
    ).rejects.toThrow("restaurantId is required for coupon lookup");
    expect(modelMocks.Coupon.findOne).not.toHaveBeenCalled();
  });

  it("rejects malformed restaurantId", async () => {
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    await expect(
      CouponQuery.couponByCode(
        null,
        { code: "FOOD10", restaurantId: "bad-id" },
        managerCtx,
      ),
    ).rejects.toThrow("restaurantId is required for coupon lookup");
    expect(modelMocks.Coupon.findOne).not.toHaveBeenCalled();
  });

  it("allows public browsing of active coupons in one restaurant", async () => {
    modelMocks.Coupon.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.coupons(null, { restaurantId: "valid-r1" }, {});

    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.Coupon.find).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: expect.objectContaining({ value: "valid-r1" }),
        isActive: true,
      }),
    );
  });

  it("requires coupon.read when inactive coupons are requested", async () => {
    modelMocks.Coupon.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.coupons(
      null,
      { restaurantId: "valid-r1", activeOnly: false },
      managerCtx,
    );

    expect(authorizationMocks.requireRestaurantPermission).toHaveBeenCalledWith(
      managerCtx,
      expect.objectContaining({ value: "valid-r1" }),
      "coupon.read",
    );
  });

  it("requires ADMIN for global coupon listings", async () => {
    modelMocks.Coupon.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const adminCtx = { user: { roleName: "admin" } };

    await CouponQuery.coupons(null, {}, adminCtx);
    expect(guardMocks.requireRoles).toHaveBeenCalledWith(adminCtx, ["ADMIN"]);
  });

  it("stops global coupon listing when ADMIN authorization fails", async () => {
    guardMocks.requireRoles.mockImplementation(() => {
      throw new Error("Forbidden");
    });
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await expect(CouponQuery.coupons(null, {}, managerCtx)).rejects.toThrow("Forbidden");
    expect(modelMocks.Coupon.find).not.toHaveBeenCalled();
  });

  it("keeps couponByCode public, restaurant-scoped and active-only", async () => {
    modelMocks.Coupon.findOne.mockReturnValue(mockLeanQuery({ id: "coupon-1" }));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.couponByCode(
      null,
      { code: " food10 ", restaurantId: "valid-r2" },
      {},
    );

    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.Coupon.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FOOD10",
        restaurantId: expect.objectContaining({ value: "valid-r2" }),
        isActive: true,
      }),
    );
  });

  it("allows public browsing of active voucher packages in one restaurant", async () => {
    modelMocks.VoucherPackage.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");

    await CouponQuery.voucherPackages(null, { restaurantId: "valid-r3" }, {});

    expect(authorizationMocks.requireRestaurantPermission).not.toHaveBeenCalled();
    expect(modelMocks.VoucherPackage.find).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: expect.objectContaining({ value: "valid-r3" }),
        isActive: true,
      }),
    );
  });

  it("requires ADMIN for global voucher package listings", async () => {
    modelMocks.VoucherPackage.find.mockReturnValue(mockFindChain([]));
    const { CouponQuery } = await import("../../graphql/resolvers/coupon/query.js");
    const adminCtx = { user: { roleName: "admin" } };

    await CouponQuery.voucherPackages(null, {}, adminCtx);
    expect(guardMocks.requireRoles).toHaveBeenCalledWith(adminCtx, ["ADMIN"]);
  });
});
