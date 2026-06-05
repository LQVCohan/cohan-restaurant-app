import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { useDashboard } from "./useDashboard";

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

const refetchMock = vi.fn().mockResolvedValue({ data: {} });

const createWrapper = (getContextValue) =>
  function Wrapper({ children }) {
    return (
      <MemoryRouter>
        <AuthContext.Provider value={getContextValue()}>{children}</AuthContext.Provider>
      </MemoryRouter>
    );
  };

describe("useDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetchMock.mockResolvedValue({ data: {} });
    useQuery.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: refetchMock,
    });
  });

  it("auto-selects the first restaurant after admin restaurants load asynchronously", async () => {
    let contextValue = { restaurants: [], restaurantsLoading: true };
    const { result, rerender } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(() => contextValue),
    });

    expect(result.current.selectedRestaurantId).toBe("");

    contextValue = {
      restaurants: [
        { id: 101, name: "Cohan Quận 1" },
        { _id: "res-2", name: "Cohan Quận 3" },
      ],
      restaurantsLoading: false,
    };
    rerender();

    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("101"));
    expect(result.current.selectedRestaurant).toMatchObject({
      id: "101",
      name: "Cohan Quận 1",
    });
  });

  it("does not expose stale dashboard metrics when the returned restaurantId differs from the selected restaurant", async () => {
    useQuery.mockReturnValue({
      data: {
        managerDashboard: {
          restaurantId: "res-old",
          revenue: 999000,
          orders: 42,
          customers: 9,
          statusCounts: { pending: 4, preparing: 3, completed: 2, cancelled: 1 },
        },
      },
      loading: false,
      error: null,
      refetch: refetchMock,
    });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(() => ({
        restaurants: [{ id: "res-new", name: "Cohan mới" }],
        restaurantsLoading: false,
      })),
    });

    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("res-new"));

    expect(result.current.loading).toBe(true);
    expect(result.current.stats.orders).toBe(0);
    expect(result.current.stats.customers).toBe(0);
    expect(result.current.stats.statusCounts).toEqual({
      pending: 0,
      preparing: 0,
      completed: 0,
      cancelled: 0,
    });
  });
});
