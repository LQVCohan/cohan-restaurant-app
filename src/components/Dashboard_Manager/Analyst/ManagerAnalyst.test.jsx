import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAnalyst } from "../../../hooks/useAnalyst";
import ManagerAnalyst from "./ManagerAnalyst";
import MenuEngineeringMatrix from "./components/MenuEngineeringMatrix";
import RevenueAnalyticsChart from "./components/RevenueAnalyticsChart";

vi.mock("../../../hooks/useAnalyst", () => ({ useAnalyst: vi.fn() }));
vi.mock("./components/KPIInsightCard", () => ({ default: ({ label, value, period }) => <article><h4>{label}</h4><strong>{value}</strong><p>{period}</p></article> }));
vi.mock("./components/DemandForecastWidget", () => ({ default: ({ forecast, onNavigate }) => <div><span>Dự báo nhu cầu widget</span><span>{forecast?.prepPlan?.[0]?.dishName}</span><button onClick={() => onNavigate("inventory")}>Demand inventory</button><span>Cần kiểm chứng thủ công</span></div> }));
vi.mock("./components/StaffSchedulingAssistantWidget", () => ({ default: ({ assistant, onNavigate }) => <div><span>Gợi ý phân ca widget</span><span>{assistant?.shifts?.[0]?.status}</span><button onClick={() => onNavigate("schedules")}>Staff schedules</button></div> }));
vi.mock("./components/MenuEngineeringAssistantWidget", () => ({ default: ({ assistant, onNavigate }) => <div><span>Trợ lý tối ưu menu widget</span><span>{assistant?.dishes?.[0]?.quadrant}</span><span>{assistant?.recommendations?.[0]}</span><button onClick={() => onNavigate("menu")}>Menu nav</button></div> }));
vi.mock("./components/SmartPromotionEngineWidget", () => ({ default: ({ engine, onNavigate }) => <div><span>Khuyến mãi widget</span><span>{engine?.campaigns?.[0]?.title}</span><span>{engine?.campaigns?.[0]?.guardrails?.[0]}</span><button onClick={() => onNavigate("promotions")}>Promo nav</button></div> }));
vi.mock("./components/SmartFeedbackAnalysis", () => ({ default: () => <div>Feedback widget</div> }));
vi.mock("./components/SmartOccupancyHeatmap", () => ({ default: () => <div>Heatmap widget</div> }));
vi.mock("./components/StaffPerformance", () => ({ default: () => <div>Staff widget</div> }));

const analystData = {
  restaurantId: "res-1", setRestaurantId: vi.fn(), restaurants: [{ id: "res-1", name: "Cơm Nhà Cohan" }], restaurantOptions: [], range: "week", setRange: vi.fn(), loading: false, error: null, refetch: vi.fn(), hasBusinessData: true,
  kpiData: [{ label: "Doanh thu thuần", value: 1000000 }, { label: "Khách", value: 12 }, { label: "Tổng đơn", value: 18 }, { label: "Đánh giá", value: 4.5 }],
  revenueTrend: [{ key: "1", current: 10, previous: 8 }], orderTrend: [{ key: "1", current: 18, previous: 10 }], topDishes: [{ dishId: "d1", dishName: "Bò bía", quantity: 4, revenue: 120000 }],
  feedbackSummary: { total: 4, avgRating: 4.5, negative: 1, positive: 3 }, feedbackItems: [], occupancyHeatmap: [], staffPerformance: [],
  demandForecast: { prepPlan: [{ dishName: "Phở" }], risingDishes: [{ dishName: "Phở" }], summary: { busiestPeriods: ["18:00"], notes: [] }, hourlyForecast: [{ hourLabel: "18:00" }], meta: { fallbackUsed: true, sampleOrders: 3 } },
  staffSchedulingAssistant: { summary: { underStaffedShifts: 1 }, shifts: [{ status: "understaffed" }] },
  menuEngineeringAssistant: { dishes: [{ quadrant: "star" }], recommendations: ["Giữ chuẩn chất lượng"] },
  smartPromotionEngine: { campaigns: [{ title: "Happy Hour", guardrails: ["review thủ công"] }] },
  statusCounts: { pending: 1, preparing: 1 }, recentOrders: [{ id: "o1", orderCode: "O1", total: 10000 }], lowStockItems: [{ id: "flour", name: "Bột gạo", currentStock: 2, unit: "kg" }],
  serviceRequests: [{ requestId: "req1", orderId: "o1", orderCode: "O1", type: "STAFF_CALL", status: "PENDING", tableCode: "A1", message: "Gọi NV", createdAt: "2026-06-09T10:00:00Z" }],
  operationsRequestsLoading: false, operationsRequestsError: null, operationsSummary: {}, refetchOperationsRequests: vi.fn(),
};

describe("ManagerAnalyst decision center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ canvas: document.createElement("canvas"), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(), measureText: vi.fn(() => ({ width: 10 })), setTransform: vi.fn(), resetTransform: vi.fn(), clip: vi.fn(), fillText: vi.fn(), strokeText: vi.fn(), createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })), arc: vi.fn(), closePath: vi.fn(), rect: vi.fn(), translate: vi.fn(), rotate: vi.fn(), scale: vi.fn() }));
    useAnalyst.mockReturnValue(analystData);
  });

  it("renders KPI, trends, analytics widgets and operational queues", () => {
    render(<ManagerAnalyst />);
    expect(screen.getByText("Doanh thu thuần")).toBeInTheDocument();
    expect(screen.getAllByText("Nhịp doanh thu").length).toBeGreaterThan(0);
    expect(screen.getByText("Dự báo nhu cầu widget")).toBeInTheDocument();
    expect(screen.getByText("Phở")).toBeInTheDocument();
    expect(screen.getByText("understaffed")).toBeInTheDocument();
    expect(screen.getByText("star")).toBeInTheDocument();
    expect(screen.getByText("Happy Hour")).toBeInTheDocument();
    expect(screen.getByTestId("low-stock-compact")).toHaveTextContent("Bột gạo");
    expect(screen.getByTestId("customer-request-list")).toHaveTextContent("Gọi NV");
    expect(screen.getByText("Cần kiểm chứng thủ công")).toBeInTheDocument();
  });

  it("dispatches manager:navigate for inventory, schedules, menu, promotions, orders and ai-handoff", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    render(<ManagerAnalyst />);
    fireEvent.click(screen.getByText("Demand inventory"));
    fireEvent.click(screen.getByText("Staff schedules"));
    fireEvent.click(screen.getByText("Menu nav"));
    fireEvent.click(screen.getByText("Promo nav"));
    fireEvent.click(screen.getAllByRole("button", { name: "Xem đơn hàng" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Đi tới xử lý" }));
    const pages = spy.mock.calls.filter(([event]) => event.type === "manager:navigate").map(([event]) => event.detail.page);
    expect(pages).toEqual(expect.arrayContaining(["inventory", "schedules", "menu", "promotions", "orders", "ai-handoff"]));
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
