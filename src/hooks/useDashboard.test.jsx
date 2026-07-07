import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { useDashboard } from "./useDashboard";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateMock,
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

const operationName = (document) =>
  document?.definitions?.find((definition) => definition?.name?.value)?.name?.value;

const latestDashboardQueryOptions = () =>
  [...useQuery.mock.calls]
    .reverse()
    .find(([document]) => operationName(document) === "GetManagerDashboard")?.[1];

describe("useDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockClear();
    refetchMock.mockResolvedValue({ data: {} });
    localStorage.removeItem("manager.selectedBrandId");
    localStorage.removeItem("manager.selectedRestaurantId");
    useQuery.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: refetchMock,
    });
  });

  it("waits for the current account scope before querying a restored restaurant id", async () => {
    localStorage.setItem("manager.selectedRestaurantId", "restaurant-from-old-session");
    let contextValue = {
      user: { id: "manager-1", roleName: "manager" },
      restaurants: [],
      restaurantsLoading: true,
    };
    const { result, rerender } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(() => contextValue),
    });

    expect(result.current.selectedRestaurantId).toBe("restaurant-from-old-session");
    expect(latestDashboardQueryOptions()?.skip).toBe(true);

    contextValue = {
      ...contextValue,
      restaurants: [{ id: "restaurant-current", name: "Cohan hiện tại" }],
      restaurantsLoading: false,
    };
    rerender();

    await waitFor(() =>
      expect(result.current.selectedRestaurantId).toBe("restaurant-current"),
    );
    await waitFor(() => expect(latestDashboardQueryOptions()?.skip).toBe(false));
    expect(latestDashboardQueryOptions()?.variables).toMatchObject({
      restaurantId: "restaurant-current",
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

  it("opens POS with the selected dashboard restaurant in the URL", async () => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(() => ({
        restaurants: [{ id: "res-1", name: "Cohan Quận 1" }],
        restaurantsLoading: false,
      })),
    });

    await waitFor(() => expect(result.current.selectedRestaurantId).toBe("res-1"));

    act(() => result.current.handleSwitchToPOS());

    expect(navigateMock).toHaveBeenCalledWith(
      "/manager/dashboard/POS?restaurantId=res-1",
    );
  });
});
