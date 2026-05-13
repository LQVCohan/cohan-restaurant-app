import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  CouponRedemption: { find: vi.fn() },
}));

const guardMocks = vi.hoisted(() => ({
  requireAuth: vi.fn((ctx) => {
    if (!ctx?.user?.id) throw new Error("UNAUTHENTICATED");
  }),
  requireRestaurantAccess: vi.fn(async () => undefined),
}));

vi.mock("../models/index.js", () => modelMocks);
vi.mock("../graphql/guards.js", () => guardMocks);

import CouponRedemptionResolvers from "../graphql/resolvers/couponRedemption/index.js";

const USER_ID = "507f1f77bcf86cd799439011";
const OTHER_USER_ID = "507f1f77bcf86cd799439012";
const COUPON_ID = "507f1f77bcf86cd799439021";
const RESTAURANT_ID = "507f1f77bcf86cd799439031";

function chain(result = []) {
  const query = {
    populate: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
  return query;
}

describe("CouponRedemption resolvers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("myCouponRedemptions requires auth and filters to the current user", async () => {
    const query = chain([{ userId: USER_ID, couponId: COUPON_ID }]);
    modelMocks.CouponRedemption.find.mockReturnValue(query);

    const result = await CouponRedemptionResolvers.Query.myCouponRedemptions(
      {},
      { restaurantId: RESTAURANT_ID, couponId: COUPON_ID },
      { user: { id: USER_ID } },
    );

    expect(guardMocks.requireAuth).toHaveBeenCalled();
    expect(String(modelMocks.CouponRedemption.find.mock.calls[0][0].userId)).toBe(USER_ID);
    expect(String(modelMocks.CouponRedemption.find.mock.calls[0][0].restaurantId)).toBe(RESTAURANT_ID);
    expect(String(modelMocks.CouponRedemption.find.mock.calls[0][0].couponId)).toBe(COUPON_ID);
    expect(query.populate).toHaveBeenCalledWith("couponId");
    expect(query.sort).toHaveBeenCalledWith({ redeemedAt: -1, createdAt: -1 });
    expect(result).toEqual([{ userId: USER_ID, couponId: COUPON_ID }]);
  });

  it("myCouponRedemptions does not expose another user's records", async () => {
    const query = chain([]);
    modelMocks.CouponRedemption.find.mockReturnValue(query);

    await CouponRedemptionResolvers.Query.myCouponRedemptions(
      {},
      {},
      { user: { id: OTHER_USER_ID } },
    );

    expect(String(modelMocks.CouponRedemption.find.mock.calls[0][0].userId)).toBe(OTHER_USER_ID);
  });

  it("couponRedemptionsByRestaurant requires restaurant access and paginates", async () => {
    const query = chain([{ restaurantId: RESTAURANT_ID }]);
    modelMocks.CouponRedemption.find.mockReturnValue(query);

    await CouponRedemptionResolvers.Query.couponRedemptionsByRestaurant(
      {},
      { restaurantId: RESTAURANT_ID, couponId: COUPON_ID, limit: 500, offset: 3 },
      { user: { id: USER_ID, roleName: "manager" } },
    );

    expect(guardMocks.requireRestaurantAccess).toHaveBeenCalled();
    expect(String(modelMocks.CouponRedemption.find.mock.calls[0][0].restaurantId)).toBe(RESTAURANT_ID);
    expect(String(modelMocks.CouponRedemption.find.mock.calls[0][0].couponId)).toBe(COUPON_ID);
    expect(query.skip).toHaveBeenCalledWith(3);
    expect(query.limit).toHaveBeenCalledWith(100);
  });
});
