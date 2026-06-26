import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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
  const originalTz = process.env.TZ;

  beforeEach(() => { vi.clearAllMocks(); useQuery.mockReturnValue({ data: { reportsOverview: overview }, loading: false, error: null }); });
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it("renders cards from reportsOverview and section rows", () => {
    wrapper(<ReportsManagement />);
    expect(screen.getByText("Tổng đơn vận hành")).toBeInTheDocument();
    expect(screen.getByText("450.000đ")).toBeInTheDocument();
    expect(screen.getAllByText("Phở bò").length).toBeGreaterThan(0);
    expect(screen.getByText("Trạng thái đơn")).toBeInTheDocument();
  });


  it("uses local calendar dates for quick ranges without UTC drift", async () => {
    process.env.TZ = "Asia/Ho_Chi_Minh";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T01:30:00+07:00"));

    wrapper(<ReportsManagement />);

    let variables = useQuery.mock.calls.at(-1)?.[1]?.variables;
    expect(variables?.startAt).toBe("2026-05-11T00:00:00.000Z");
    expect(variables?.endAt).toBe("2026-06-09T23:59:59.999Z");

    fireEvent.click(screen.getByRole("button", { name: "Hôm nay" }));

    variables = useQuery.mock.calls.at(-1)[1].variables;
    expect(screen.getByLabelText("Ngày bắt đầu")).toHaveValue("2026-06-09");
    expect(screen.getByLabelText("Ngày kết thúc")).toHaveValue("2026-06-09");
    expect(variables.startAt).toBe("2026-06-09T00:00:00.000Z");
    expect(variables.endAt).toBe("2026-06-09T23:59:59.999Z");
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
    expect(csv).toContain("Tổng quan");
    expect(csv).toContain("Doanh thu theo ngày");
    expect(csv).toContain("Trạng thái đơn");
    expect(csv).toContain("Loại đơn");
    expect(csv).toContain("Món bán nổi bật");
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
