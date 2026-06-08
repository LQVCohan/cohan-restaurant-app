import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAnalyst } from "../../../hooks/useAnalyst";
import ManagerAnalyst from "./ManagerAnalyst";
import MenuEngineeringMatrix from "./components/MenuEngineeringMatrix";
import RevenueAnalyticsChart from "./components/RevenueAnalyticsChart";

vi.mock("../../../hooks/useAnalyst", () => ({
  useAnalyst: vi.fn(),
}));

vi.mock("./components/KPIInsightCard", () => ({ default: ({ label, value, period }) => <article><h4>{label}</h4><strong>{value}</strong><p>{period}</p></article> }));
vi.mock("./components/DemandForecastWidget", () => ({ default: () => <div>Dự báo nhu cầu widget</div> }));
vi.mock("./components/StaffSchedulingAssistantWidget", () => ({ default: () => <div>Gợi ý phân ca widget</div> }));
vi.mock("./components/MenuEngineeringAssistantWidget", () => ({ default: () => <div>Trợ lý tối ưu menu widget</div> }));
vi.mock("./components/SmartPromotionEngineWidget", () => ({ default: () => <div>Khuyến mãi widget</div> }));
vi.mock("./components/SmartFeedbackAnalysis", () => ({ default: () => <div>Feedback widget</div> }));
vi.mock("./components/SmartOccupancyHeatmap", () => ({ default: () => <div>Heatmap widget</div> }));
vi.mock("./components/StaffPerformance", () => ({ default: () => <div>Staff widget</div> }));

const analystData = {
  restaurantId: "res-1",
  setRestaurantId: vi.fn(),
  restaurants: [{ id: "res-1", name: "Cơm Nhà Cohan" }],
  restaurantOptions: [],
  range: "week",
  setRange: vi.fn(),
  loading: false,
  error: null,
  refetch: vi.fn(),
  hasBusinessData: true,
  kpiData: [
    { label: "Doanh thu thuần", value: 0 },
    { label: "Khách", value: 0 },
    { label: "Tổng đơn", value: 0 },
    { label: "Đánh giá", value: 0 },
  ],
  revenueTrend: [],
  orderTrend: [],
  topDishes: [],
  feedbackSummary: { total: 0, avgRating: 0 },
  feedbackItems: [],
  occupancyHeatmap: [],
  staffPerformance: [],
  demandForecast: {},
  staffSchedulingAssistant: { summary: { underStaffedShifts: 0 } },
  menuEngineeringAssistant: {},
  smartPromotionEngine: {},
  statusCounts: { pending: 0, preparing: 0 },
  recentOrders: [],
  lowStockItems: [],
  serviceRequests: [],
  operationsRequestsLoading: false,
  operationsRequestsError: null,
  operationsSummary: {},
  refetchOperationsRequests: vi.fn(),
};

describe("ManagerAnalyst cockpit states", () => {
  it("shows low stock warning in Action Center when lowStockItems has data", () => {
    useAnalyst.mockReturnValue({
      ...analystData,
      lowStockItems: [{ id: "flour", name: "Bột gạo", currentStock: 2, unit: "kg" }],
    });

    render(<ManagerAnalyst />);

    expect(screen.getByText("1 nguyên liệu tồn kho thấp")).toBeInTheDocument();
    expect(screen.getAllByText("Kiểm tra tồn kho").length).toBeGreaterThan(0);
    expect(screen.getByTestId("low-stock-compact")).toHaveTextContent("Bột gạo");
  });
});

describe("analytics compact empty states", () => {
  it("renders compact revenue empty state without a giant placeholder", () => {
    render(<RevenueAnalyticsChart data={[]} orderData={[]} rangeLabel="Tuần này" loading={false} />);

    expect(screen.getByTestId("revenue-empty-compact")).toBeInTheDocument();
    expect(screen.getByText("Chưa có doanh thu trong kỳ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem đơn hàng" })).toBeInTheDocument();
  });

  it("uses mini BCG insight instead of full matrix when menu data is sparse", () => {
    render(<MenuEngineeringMatrix dishes={[{ dishId: "d1", dishName: "Bò bía", quantity: 4, revenue: 120000 }]} />);

    expect(screen.getByTestId("mini-bcg-insight")).toBeInTheDocument();
    expect(screen.getByText("Bò bía")).toBeInTheDocument();
    expect(screen.queryByText("Độ phổ biến cao")).not.toBeInTheDocument();
  });
});
