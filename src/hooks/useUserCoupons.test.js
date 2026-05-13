import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";

import useUserCoupons, {
  MY_COUPONS,
  REMOVE_SAVED_COUPON,
  SAVE_COUPON,
} from "./useUserCoupons";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: vi.fn(),
    useQuery: vi.fn(),
  };
});

describe("useUserCoupons", () => {
  const saveMutation = vi.fn();
  const removeMutation = vi.fn();
  const refetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockReturnValue({
      data: {
        myCoupons: [
          { id: "uc-1", couponId: "coupon-1", status: "saved" },
          { id: "uc-2", coupon: { id: "coupon-2" }, status: "saved" },
        ],
      },
      loading: false,
      error: null,
      refetch,
    });
    saveMutation.mockResolvedValue({ data: { saveCoupon: { id: "uc-3" } } });
    removeMutation.mockResolvedValue({ data: { removeSavedCoupon: true } });
    useMutation
      .mockReturnValueOnce([saveMutation, { loading: false }])
      .mockReturnValueOnce([removeMutation, { loading: false }]);
  });

  it("queries current user's saved coupons for a restaurant", () => {
    const { result } = renderHook(() =>
      useUserCoupons({ restaurantId: "restaurant-1" }),
    );

    expect(useQuery).toHaveBeenCalledWith(
      MY_COUPONS,
      expect.objectContaining({
        variables: { restaurantId: "restaurant-1", status: "saved" },
        skip: false,
      }),
    );
    expect(result.current.myCoupons).toHaveLength(2);
    expect(result.current.savedCouponIds).toEqual(["coupon-1", "coupon-2"]);
  });

  it("skips querying when requested", () => {
    renderHook(() => useUserCoupons({ restaurantId: "restaurant-1", skip: true }));

    expect(useQuery).toHaveBeenCalledWith(
      MY_COUPONS,
      expect.objectContaining({ skip: true }),
    );
  });

  it("saves and removes coupons with refetchable mutations", async () => {
    const { result } = renderHook(() =>
      useUserCoupons({ restaurantId: "restaurant-1" }),
    );

    expect(useMutation).toHaveBeenCalledWith(
      SAVE_COUPON,
      expect.objectContaining({ awaitRefetchQueries: true }),
    );
    expect(useMutation).toHaveBeenCalledWith(
      REMOVE_SAVED_COUPON,
      expect.objectContaining({ awaitRefetchQueries: true }),
    );

    await act(async () => {
      await result.current.saveCoupon("coupon-3");
      await result.current.removeSavedCoupon("coupon-1");
    });

    expect(saveMutation).toHaveBeenCalledWith({ variables: { couponId: "coupon-3" } });
    expect(removeMutation).toHaveBeenCalledWith({ variables: { couponId: "coupon-1" } });
  });
});
