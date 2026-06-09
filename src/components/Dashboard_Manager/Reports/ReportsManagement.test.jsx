import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import ReportsManagement, { buildReportsCsv } from "./ReportsManagement";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn() };
});
const { useQuery } = await import("@apollo/client");

const overview = {
  totalOrders: 3,
  grossRevenue: 450000,
  byStatus: [{ key: "completed", label: "completed", count: 2 }],
  byOrderType: [{ key: "dine_in", label: "dine_in", count: 3 }],
  topDishes: [{ name: "Phở bò", quantity: 5, revenue: 250000 }],
  revenueByDay: [{ date: "2026-06-09", orders: 2, grossRevenue: 300000 }],
};
const wrapper = (ui) => render(<AuthContext.Provider value={{ restaurants: [{ id: "r1", name: "Cohan" }] }}>{ui}</AuthContext.Provider>);

describe("ReportsManagement", () => {
  beforeEach(() => { vi.clearAllMocks(); useQuery.mockReturnValue({ data: { reportsOverview: overview }, loading: false, error: null }); });

  it("renders cards from reportsOverview and section rows", () => {
    wrapper(<ReportsManagement />);
    expect(screen.getByText("Tổng đơn vận hành")).toBeInTheDocument();
    expect(screen.getByText("450.000đ")).toBeInTheDocument();
    expect(screen.getAllByText("Phở bò").length).toBeGreaterThan(0);
    expect(screen.getByText("Phân bổ trạng thái")).toBeInTheDocument();
  });

  it("quick range and custom date update query variables", () => {
    wrapper(<ReportsManagement />);
    fireEvent.click(screen.getByRole("button", { name: "7 ngày" }));
    let variables = useQuery.mock.calls.at(-1)[1].variables;
    expect(variables.startAt).toMatch(/T00:00:00.000Z$/);
    fireEvent.change(screen.getByLabelText("Ngày bắt đầu"), { target: { value: "2026-06-01" } });
    variables = useQuery.mock.calls.at(-1)[1].variables;
    expect(variables.startAt).toBe("2026-06-01T00:00:00.000Z");
    expect(screen.getByRole("button", { name: "Tùy chọn" })).toHaveClass("is-active");
  });

  it("exports CSV with all sections", () => {
    const csv = buildReportsCsv(overview, { restaurantId: "r1", dateRange: { start: "2026-06-01", end: "2026-06-09" } });
    expect(csv).toContain("SUMMARY");
    expect(csv).toContain("REVENUE_BY_DAY");
    expect(csv).toContain("BY_STATUS");
    expect(csv).toContain("BY_ORDER_TYPE");
    expect(csv).toContain("TOP_DISHES");
  });

  it("empty state and CTA dispatch manager:navigate orders", () => {
    useQuery.mockReturnValue({ data: { reportsOverview: { totalOrders: 0, grossRevenue: 0, byStatus: [], byOrderType: [], topDishes: [], revenueByDay: [] } }, loading: false, error: null });
    const spy = vi.spyOn(window, "dispatchEvent");
    wrapper(<ReportsManagement />);
    expect(screen.getByText("Chưa có đơn vận hành trong kỳ.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem đơn hàng liên quan" }));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "manager:navigate" }));
    expect(spy.mock.calls.at(-1)[0].detail.page).toBe("orders");
  });
});
