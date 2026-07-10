import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  updateRestaurant: vi.fn(),
  refetch: vi.fn(),
  getUsdToVndRate: vi.fn(),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: mocks.useQuery,
    useMutation: mocks.useMutation,
  };
});

vi.mock("@/utils/currency", async () => {
  const actual = await vi.importActual("@/utils/currency");
  return {
    ...actual,
    getUsdToVndRate: mocks.getUsdToVndRate,
  };
});

const hookPromise = import("./useRestaurantCurrency");

const wrapperFor = (user) =>
  function CurrencyTestWrapper({ children }) {
    return (
      <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
    );
  };

describe("useRestaurantCurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refetch.mockResolvedValue(null);
    mocks.updateRestaurant.mockResolvedValue({
      data: { updateRestaurant: { id: "restaurant-1" } },
    });
    mocks.useMutation.mockReturnValue([mocks.updateRestaurant]);
    mocks.getUsdToVndRate.mockResolvedValue({
      rate: 25500,
      source: "network",
    });
  });

  it("skips restaurant settings for an accountant without restaurant.read", async () => {
    mocks.useQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: null,
      refetch: mocks.refetch,
    });
    const { useRestaurantCurrency } = await hookPromise;

    renderHook(() => useRestaurantCurrency("restaurant-1"), {
      wrapper: wrapperFor({ roleName: "accountant" }),
    });

    expect(mocks.useQuery.mock.calls[0][1]).toEqual(
      expect.objectContaining({ skip: true }),
    );
  });

  it("uses the network rate when no manual rate exists", async () => {
    mocks.useQuery.mockReturnValue({
      data: {
        restaurant: {
          id: "restaurant-1",
          defaultCurrency: "VND",
          manualUsdToVndRate: null,
        },
      },
      loading: false,
      error: null,
      refetch: mocks.refetch,
    });
    const { useRestaurantCurrency } = await hookPromise;

    renderHook(() => useRestaurantCurrency("restaurant-1"), {
      wrapper: wrapperFor({ roleName: "manager" }),
    });

    await waitFor(() =>
      expect(mocks.getUsdToVndRate).toHaveBeenCalledWith(
        expect.objectContaining({ manualRate: undefined }),
      ),
    );
  });

  it("does not persist the fallback rate when only currency changes", async () => {
    mocks.useQuery.mockReturnValue({
      data: {
        restaurant: {
          id: "restaurant-1",
          defaultCurrency: "VND",
          manualUsdToVndRate: null,
        },
      },
      loading: false,
      error: null,
      refetch: mocks.refetch,
    });
    const { useRestaurantCurrency } = await hookPromise;
    const { result } = renderHook(
      () => useRestaurantCurrency("restaurant-1"),
      { wrapper: wrapperFor({ roleName: "manager" }) },
    );

    await act(async () => {
      await result.current.persistSettings({ defaultCurrency: "USD" });
    });

    expect(mocks.updateRestaurant).toHaveBeenCalledWith({
      variables: {
        id: "restaurant-1",
        input: { defaultCurrency: "USD" },
      },
    });
  });
});
