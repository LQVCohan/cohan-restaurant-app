import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  setRestaurantId: vi.fn(),
  persistSettings: vi.fn(),
}));

vi.mock("@/hooks/useFinance", () => ({
  toLocalDateInputValue: () => "2026-07-10",
  useFinance: () => ({
    range: "month",
    setRange: vi.fn(),
    dateFrom: "2026-07-01",
    setDateFrom: vi.fn(),
    dateTo: "2026-07-31",
    setDateTo: vi.fn(),
    summary: {
      revenue: 1000,
      expense: 400,
      profit: 600,
      payment: 900,
      refund: 50,
      cashIn: 1000,
      cashOut: 400,
      receivable: 100,
      payable: 80,
      settlement: 900,
      primeCostRate: 32,
    },
    trend: [],
    debts: [],
    reconciliations: [],
    reconciliationSummary: { matched: 2, amountMismatch: 1, unmatched: 3 },
    costBreakdown: { cogs: 200, labor: 100, operations: 50, other: 50 },
    loading: false,
    error: null,
    validationError: "",
    canQuery: true,
    refetch: mocks.refetch,
    restaurantId: "restaurant-b",
    setRestaurantId: mocks.setRestaurantId,
    restaurants: [
      { id: "restaurant-a", name: "Chi nhánh A" },
      { id: "restaurant-b", name: "Chi nhánh B" },
    ],
  }),
}));

vi.mock("@/hooks/useRestaurantCurrency", () => ({
  useRestaurantCurrency: () => ({
    activeCurrency: "VND",
    setActiveCurrency: vi.fn(),
    usdToVndRate: 26000,
    rateSource: "fallback",
    manualUsdToVndRate: null,
    displayedUsdToVndRate: 26000,
    persistSettings: mocks.persistSettings,
    canPersistSettings: true,
    loading: false,
    error: null,
  }),
}));

const dashboardPromise = import("./FinanceDashboard");

describe("FinanceDashboard drill-down scope", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends the selected restaurant with card navigation", async () => {
    const FinanceDashboard = (await dashboardPromise).default;
    const listener = vi.fn();
    window.addEventListener("manager:navigate", listener);

    render(
      <AuthContext.Provider value={{ user: { roleName: "manager" } }}>
        <FinanceDashboard />
      </AuthContext.Provider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Doanh thu ghi nhận/i }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual(
      expect.objectContaining({
        page: "transactions",
        query: expect.objectContaining({
          tab: "journal",
          type: "INFLOW",
          category: "sale",
          restaurantId: "restaurant-b",
        }),
      }),
    );

    window.removeEventListener("manager:navigate", listener);
  });
});
