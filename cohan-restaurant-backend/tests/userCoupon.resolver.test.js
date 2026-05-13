import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => {
  const UserCouponCtor = {
    find: vi.fn(),
    findOne: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    deleteOne: vi.fn(),
  };

  return {
    Coupon: { findById: vi.fn() },
    UserCoupon: UserCouponCtor,
  };
});

const guardMocks = vi.hoisted(() => ({
  requireAuth: vi.fn((ctx) => {
    if (!ctx?.user?.id) throw new Error("UNAUTHENTICATED");
  }),
  requireRestaurantAccess: vi.fn(),
}));

vi.mock("../models/index.js", () => modelMocks);
vi.mock("../graphql/guards.js", () => guardMocks);

import UserCouponResolvers from "../graphql/resolvers/userCoupon/index.js";

const USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";
const COUPON_ID = "507f1f77bcf86cd799439021";
const RESTAURANT_ID = "507f1f77bcf86cd799439031";

const ctx = (userId = USER_ID) => ({ user: { id: userId, roleName: "customer" } });

function activeCoupon(overrides = {}) {
  return {
    _id: COUPON_ID,
    restaurantId: RESTAURANT_ID,
    isActive: true,
    publishAt: new Date("2026-01-01T00:00:00.000Z"),
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: new Date("2026-12-31T00:00:00.000Z"),
    maxUsage: 10,
    used: 0,
    ...overrides,
  };
}

describe("UserCoupon resolvers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardMocks.requireRestaurantAccess.mockResolvedValue(true);
  });

  it("fails saveCoupon for unauthenticated users", async () => {
    await expect(
      UserCouponResolvers.Mutation.saveCoupon({}, { couponId: COUPON_ID }, { user: null }),
    ).rejects.toThrow("UNAUTHENTICATED");
  });

  it("saves an active coupon for the current user", async () => {
    modelMocks.Coupon.findById.mockResolvedValue(activeCoupon());
    modelMocks.UserCoupon.findOne.mockResolvedValue(null);
    const created = {
      _id: "507f1f77bcf86cd799439041",
      userId: USER_ID,
      couponId: COUPON_ID,
      restaurantId: RESTAURANT_ID,
      status: "saved",
      populate: vi.fn().mockResolvedValue({ id: "uc-1", couponId: activeCoupon() }),
    };
    modelMocks.UserCoupon.create.mockResolvedValue(created);

    const result = await UserCouponResolvers.Mutation.saveCoupon(
      {},
      { couponId: COUPON_ID },
      ctx(),
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalledWith(
      ctx(),
      RESTAURANT_ID,
    );
    expect(modelMocks.UserCoupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "saved",
        restaurantId: RESTAURANT_ID,
      }),
    );
    expect(result).toEqual({ id: "uc-1", couponId: activeCoupon() });
  });

  it("prevents duplicate saves", async () => {
    modelMocks.Coupon.findById.mockResolvedValue(activeCoupon());
    modelMocks.UserCoupon.findOne.mockResolvedValue({
      userId: USER_ID,
      couponId: COUPON_ID,
      status: "saved",
    });

    await expect(
      UserCouponResolvers.Mutation.saveCoupon({}, { couponId: COUPON_ID }, ctx()),
    ).rejects.toThrow("Coupon already saved");
  });

  it.each([
    ["inactive", { isActive: false }, "Coupon is not active"],
    ["unpublished", { publishAt: new Date("2099-01-01T00:00:00.000Z") }, "Coupon is not published yet"],
    ["not started", { startAt: new Date("2099-01-01T00:00:00.000Z") }, "Coupon is not active yet"],
    ["expired", { endAt: new Date("2020-01-01T00:00:00.000Z") }, "Coupon has expired"],
    ["out of usage", { maxUsage: 5, used: 5 }, "Coupon usage limit reached"],
  ])("rejects %s coupons", async (_, overrides, message) => {
    modelMocks.Coupon.findById.mockResolvedValue(activeCoupon(overrides));

    await expect(
      UserCouponResolvers.Mutation.saveCoupon({}, { couponId: COUPON_ID }, ctx()),
    ).rejects.toThrow(message);
  });

  it("returns only the current user's saved coupons", async () => {
    const lean = vi.fn().mockResolvedValue([
      { id: "uc-1", userId: USER_ID, couponId: COUPON_ID, status: "saved" },
    ]);
    const sort = vi.fn().mockReturnValue({ lean });
    const populate = vi.fn().mockReturnValue({ sort });
    modelMocks.UserCoupon.find.mockReturnValue({ populate });

    const result = await UserCouponResolvers.Query.myCoupons(
      {},
      { restaurantId: RESTAURANT_ID, status: "saved" },
      ctx(),
    );

    expect(modelMocks.UserCoupon.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: "saved" }),
    );
    expect(String(modelMocks.UserCoupon.find.mock.calls[0][0].userId)).toBe(USER_ID);
    expect(String(modelMocks.UserCoupon.find.mock.calls[0][0].restaurantId)).toBe(RESTAURANT_ID);
    expect(result).toHaveLength(1);
  });

  it("does not expose another user's saved state through isCouponSaved", async () => {
    modelMocks.UserCoupon.exists.mockResolvedValue(null);

    const result = await UserCouponResolvers.Query.isCouponSaved(
      {},
      { couponId: COUPON_ID },
      ctx(OTHER_USER_ID),
    );

    expect(result).toBe(false);
    expect(String(modelMocks.UserCoupon.exists.mock.calls[0][0].userId)).toBe(OTHER_USER_ID);
  });

  it("removes only coupons with saved status", async () => {
    const deleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
    modelMocks.UserCoupon.findOne.mockResolvedValue({
      _id: "507f1f77bcf86cd799439041",
      userId: USER_ID,
      couponId: COUPON_ID,
      status: "saved",
      deleteOne,
    });

    await expect(
      UserCouponResolvers.Mutation.removeSavedCoupon({}, { couponId: COUPON_ID }, ctx()),
    ).resolves.toBe(true);
    expect(deleteOne).toHaveBeenCalled();
  });

  it("rejects removing used coupons", async () => {
    modelMocks.UserCoupon.findOne.mockResolvedValue({
      userId: USER_ID,
      couponId: COUPON_ID,
      status: "used",
    });

    await expect(
      UserCouponResolvers.Mutation.removeSavedCoupon({}, { couponId: COUPON_ID }, ctx()),
    ).rejects.toThrow("Used coupons cannot be removed");
  });
});
