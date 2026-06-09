import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "../context/AuthContext";
import { useAnalyst } from "./useAnalyst";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn(), gql: actual.gql };
});
const { useQuery } = await import("@apollo/client");

const dashboardData = {
  managerDashboard: {
    revenue: 1000, orders: 2, customers: 3,
    statusCounts: { pending: 1, preparing: 2, completed: 4, cancelled: 0 },
    feedbackSummary: { avgRating: 4.5, total: 2, negative: 0, positive: 2 },
    revenueTrend: [], orderTrend: [], topDishes: [], feedbackItems: [], occupancyHeatmap: [], staffPerformance: [], recentOrders: [], lowStockItems: [{ id: "i1" }],
  },
  demandForecast: null,
  staffSchedulingAssistant: null,
  menuEngineeringAssistant: null,
  smartPromotionEngine: null,
};
const operationsData = {
  pendingServiceRequests: [{ requestId: "p", createdAt: "2026-06-09T10:00:00Z" }],
  acknowledgedServiceRequests: [{ requestId: "a", createdAt: "2026-06-09T12:00:00Z" }],
};
const wrapper = ({ children }) => React.createElement(AuthContext.Provider, { value: { restaurants: [{ id: "r1", name: "One" }, { id: "r2", name: "Two" }] } }, children);

describe("useAnalyst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQuery.mockImplementation((query, options) => {
      const source = String(query?.loc?.source?.body || "");
      if (source.includes("GetAnalystOperationsRequests")) return { data: operationsData, loading: false, error: null, refetch: vi.fn() };
      return { data: dashboardData, loading: false, error: null, refetch: vi.fn(), variables: options?.variables };
    });
  });

  it("selects first restaurant and changes week/month range", async () => {
    const { result } = renderHook(() => useAnalyst(), { wrapper });
    await waitFor(() => expect(result.current.restaurantId).toBe("r1"));
    act(() => result.current.setRange("month"));
    expect(result.current.range).toBe("month");
  });

  it("merges service requests sorted by createdAt and builds operationsSummary", async () => {
    const { result } = renderHook(() => useAnalyst(), { wrapper });
    await waitFor(() => expect(result.current.serviceRequests.map((r) => r.requestId)).toEqual(["a", "p"]));
    expect(result.current.operationsSummary).toMatchObject({ processingOrders: 3, pendingRequestsCount: 1, acknowledgedRequestsCount: 1, openRequestsCount: 2, lowStockCount: 1 });
  });

  it("returns fallback analytics objects so widgets do not crash", async () => {
    const { result } = renderHook(() => useAnalyst(), { wrapper });
    await waitFor(() => expect(result.current.demandForecast.meta.fallbackUsed).toBe(true));
    expect(result.current.staffSchedulingAssistant.shifts).toEqual([]);
    expect(result.current.menuEngineeringAssistant.dishes).toEqual([]);
    expect(result.current.smartPromotionEngine.campaigns).toEqual([]);
  });
});
