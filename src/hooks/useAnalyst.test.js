import React from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../context/AuthContext";
import { useAnalyst } from "./useAnalyst";

const mocks = vi.hoisted(() => ({
  setSelectedRestaurantId: vi.fn(),
  dashboardRefetch: vi.fn(),
  operationsRefetch: vi.fn(),
  selection: {},
  dashboardResult: {},
  operationsResult: {},
}));

vi.mock("./useManagerRestaurantSelection", () => ({
  default: () => mocks.selection,
  getRestaurantId: (restaurant) =>
    String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? ""),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn(), gql: actual.gql };
});

const { useQuery } = await import("@apollo/client");

const dashboardData = {
  managerDashboard: {
    restaurantId: "r2",
    revenue: 1000,
    orders: 2,
    customers: 3,
    statusCounts: {
      pending: 1,
      preparing: 2,
      completed: 4,
      cancelled: 0,
    },
    feedbackSummary: {
      avgRating: 4.5,
      total: 2,
      negative: 0,
      positive: 2,
    },
    revenueTrend: [],
    orderTrend: [],
    topDishes: [],
    feedbackItems: [],
    occupancyHeatmap: [{ dayLabel: "T2", hourLabel: "18:00" }],
    staffPerformance: [{ staffId: "s1", fullName: "Nhân viên A" }],
    recentOrders: [],
    lowStockItems: [{ id: "i1" }],
  },
  demandForecast: null,
  staffSchedulingAssistant: null,
  menuEngineeringAssistant: null,
  smartPromotionEngine: null,
};

const operationsData = {
  pendingServiceRequests: [
    { requestId: "p", createdAt: "2026-06-09T10:00:00Z" },
  ],
  acknowledgedServiceRequests: [
    { requestId: "a", createdAt: "2026-06-09T12:00:00Z" },
  ],
};

const createWrapper = (user = { id: "manager-1", roleName: "manager" }) =>
  function Wrapper({ children }) {
    return React.createElement(
      AuthContext.Provider,
      { value: { user } },
      children,
    );
  };

const querySource = (query) => String(query?.loc?.source?.body || "");
const findLatestQueryOptions = (operationName) =>
  [...useQuery.mock.calls]
    .reverse()
    .find(([query]) => querySource(query).includes(operationName))?.[1];

describe("useAnalyst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selection = {
      restaurantOptions: [
        { id: "r1", name: "One" },
        { id: "r2", name: "Two" },
      ],
      selectedRestaurantId: "r2",
      setSelectedRestaurantId: mocks.setSelectedRestaurantId,
      selectedRestaurant: { id: "r2", name: "Two" },
      restaurantsLoading: false,
      error: null,
    };
    mocks.dashboardResult = {
      data: dashboardData,
      loading: false,
      error: null,
      refetch: mocks.dashboardRefetch,
    };
    mocks.operationsResult = {
      data: operationsData,
      loading: false,
      error: null,
      refetch: mocks.operationsRefetch,
    };
    useQuery.mockImplementation((query) =>
      querySource(query).includes("GetAnalystOperationsRequests")
        ? mocks.operationsResult
        : mocks.dashboardResult,
    );
  });

  it("uses the shared manager restaurant scope and requests a branch identity", () => {
    const { result } = renderHook(() => useAnalyst(), {
      wrapper: createWrapper(),
    });

    expect(result.current.restaurantId).toBe("r2");
    expect(result.current.selectedRestaurant).toEqual(
      expect.objectContaining({ id: "r2" }),
    );
    expect(result.current.occupancyHeatmap).toHaveLength(1);
    expect(result.current.staffPerformance).toHaveLength(1);

    const options = findLatestQueryOptions("GetAnalystDashboard");
    expect(options).toMatchObject({
      skip: false,
      errorPolicy: "all",
      variables: {
        restaurantId: "r2",
        range: "week",
        includeStaffScheduling: true,
      },
    });
    expect(querySource(useQuery.mock.calls[0][0])).toContain("restaurantId");
  });

  it("keeps valid core data when an optional analytics field fails", () => {
    mocks.dashboardResult = {
      ...mocks.dashboardResult,
      error: {
        graphQLErrors: [
          {
            message: "promotion service unavailable",
            path: ["smartPromotionEngine"],
          },
        ],
      },
    };

    const { result } = renderHook(() => useAnalyst(), {
      wrapper: createWrapper(),
    });

    expect(result.current.error).toBeNull();
    expect(result.current.kpiData[0].value).toBe(1000);
    expect(result.current.partialErrorSections).toEqual([
      "Khuyến mãi thông minh",
    ]);
    expect(result.current.smartPromotionEngine.campaigns).toEqual([]);
  });

  it("does not expose a late response from another restaurant", () => {
    mocks.dashboardResult = {
      ...mocks.dashboardResult,
      data: {
        ...dashboardData,
        managerDashboard: {
          ...dashboardData.managerDashboard,
          restaurantId: "r1",
        },
      },
    };

    const { result } = renderHook(() => useAnalyst(), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.kpiData[0].value).toBe(0);
    expect(result.current.revenueTrend).toEqual([]);
  });

  it("skips protected operations and scheduling branches for report-only users", () => {
    const reportOnlyUser = {
      id: "accountant-1",
      roleName: "accountant",
      effectivePermissionCodes: ["report.read"],
    };
    const { result } = renderHook(() => useAnalyst(), {
      wrapper: createWrapper(reportOnlyUser),
    });

    const dashboardOptions = findLatestQueryOptions("GetAnalystDashboard");
    const operationsOptions = findLatestQueryOptions(
      "GetAnalystOperationsRequests",
    );
    expect(dashboardOptions.variables.includeStaffScheduling).toBe(false);
    expect(operationsOptions.skip).toBe(true);
    expect(result.current.canReadOperationsRequests).toBe(false);
    expect(result.current.refetchOperationsRequests).toBeNull();
    expect(result.current.operationsRequestsError).toBeNull();
    expect(result.current.serviceRequests).toEqual([]);
  });

  it("merges requests, returns safe fallbacks and refreshes both allowed queries", async () => {
    const { result } = renderHook(() => useAnalyst(), {
      wrapper: createWrapper(),
    });

    expect(result.current.serviceRequests.map((request) => request.requestId)).toEqual([
      "a",
      "p",
    ]);
    expect(result.current.operationsSummary).toMatchObject({
      processingOrders: 3,
      pendingRequestsCount: 1,
      acknowledgedRequestsCount: 1,
      openRequestsCount: 2,
      lowStockCount: 1,
    });
    expect(result.current.demandForecast.meta.fallbackUsed).toBe(true);
    expect(result.current.staffSchedulingAssistant.shifts).toEqual([]);
    expect(result.current.menuEngineeringAssistant.dishes).toEqual([]);
    expect(result.current.smartPromotionEngine.campaigns).toEqual([]);

    await act(async () => {
      await result.current.refetch();
    });
    expect(mocks.dashboardRefetch).toHaveBeenCalledWith({
      restaurantId: "r2",
      range: "week",
      includeStaffScheduling: true,
    });
    expect(mocks.operationsRefetch).toHaveBeenCalledWith({ restaurantId: "r2" });
  });
});
