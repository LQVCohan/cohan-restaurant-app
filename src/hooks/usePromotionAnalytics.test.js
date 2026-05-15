import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apolloMocks = vi.hoisted(() => ({
  gql: vi.fn((strings) => strings.join("")),
  useQuery: vi.fn(),
}));

vi.mock("@apollo/client", () => apolloMocks);

import { EMPTY_ANALYTICS, usePromotionAnalytics } from "./usePromotionAnalytics";

describe("usePromotionAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries promotionAnalyticsByRestaurant and returns analytics data", () => {
    const refetch = vi.fn();
    apolloMocks.useQuery.mockReturnValue({
      data: {
        promotionAnalyticsByRestaurant: {
          totalPromotions: 4,
          activePromotions: 2,
          scheduledPromotions: 1,
          expiredPromotions: 1,
          totalRedemptions: 5,
          totalPromotionDiscount: 45000,
          totalShippingDiscount: 15000,
          totalDiscountAmount: 60000,
          usageRate: 125,
          topPromotions: [{ promotionId: "promo-1", usageCount: 2 }],
          byType: [{ promotionType: "COMBO", usageCount: 1 }],
        },
      },
      loading: false,
      error: null,
      refetch,
    });

    const { result } = renderHook(() => usePromotionAnalytics("restaurant-1"));

    expect(apolloMocks.useQuery).toHaveBeenCalledWith(
      expect.stringContaining("promotionAnalyticsByRestaurant"),
      expect.objectContaining({
        variables: { restaurantId: "restaurant-1" },
        skip: false,
        fetchPolicy: "cache-and-network",
      }),
    );
    expect(result.current.analytics.totalDiscountAmount).toBe(60000);
    expect(result.current.refetch).toBe(refetch);
  });

  it("returns EMPTY_ANALYTICS defaults and skips when restaurantId is missing", () => {
    apolloMocks.useQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => usePromotionAnalytics(""));

    expect(apolloMocks.useQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        variables: { restaurantId: "" },
        skip: true,
      }),
    );
    expect(result.current.analytics).toBe(EMPTY_ANALYTICS);
  });
});
