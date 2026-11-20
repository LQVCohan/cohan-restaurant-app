import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import { useDashboard } from "@/hooks/useDashboard";
import { useDashboardActionQueue } from "@/hooks/useDashboardActionQueue";
import Dashboard from "./Dashboard";

vi.mock("@/hooks/useDashboard", () => ({
  useDashboard: vi.fn(),
}));

vi.mock("@/hooks/useDashboardActionQueue", () => ({
  useDashboardActionQueue: vi.fn(),
}));

vi.mock("@/hooks/useManagerPerformanceDashboard", () => ({
  useManagerPerformanceDashboard: vi.fn(() => ({
    dashboard: null,
    loading: false,
    error: null,
    isEmpty: true,
  })),
}));

const baseDashboard = {
  selectedRestaurant: { id: "res-1", name: "Cơm Nhà Cohan" },
  restaurants: [{ id: "res-1", name: "Cơm Nhà Cohan" }],
  selectedRestaurantId: "res-1",
  stats: {
    revenue: "12.500.000 ₫",
    orders: 18,
    customers: 4,
    tables: 12,
    menuItems: 24,
    promotions: 1,
    staff: 8,
    statusCounts: {
      pending: 2,
      preparing: 3,
      completed: 10,
      cancelled: 1,
    },
  },
  handleRestaurantChange: vi.fn(),
  handleSwitchToPOS: vi.fn(),
  handleGenerateReport: vi.fn(),
  loading: false,
  restaurantsLoading: false,
  error: null,
  range: "week",
  setRange: vi.fn(),
  revenueTrend: [],
  recentOrders: [
    {
      id: "raw-order-id",
      orderCode: "ORD-1001",
      status: "preparing",
      total: 320000,
      createdAt: "2026-06-03T10:30:00.000Z",
      customerName: "Anh Minh",
      tableCode: "Bàn 4",
    },
  ],
  topDishes: [],
  lowStockItems: [],
  pendingOrders: [],
  pendingReservations: [],
  pendingSupportRequests: [],
  pendingOrderCount: 0,
  pendingReservationCount: 0,
  pendingSupportRequestCount: 0,
  refetchDashboard: vi.fn(),
};

const renderDashboard = (overrides = {}, canOpenInventory = false) => {
  useDashboard.mockReturnValue({ ...baseDashboard, ...overrides });
  useDashboardActionQueue.mockReturnValue({
    busyKey: "",
    confirmOrder: vi.fn(),
    rejectOrder: vi.fn(),
    confirmReservation: vi.fn(),
    cancelReservation: vi.fn(),
    acknowledgeSupport: vi.fn(),
    resolveSupport: vi.fn(),
  });

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: { fullName: "Quản lý ca" } }}>
        <Dashboard canOpenInventory={canOpenInventory} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
};

describe("Dashboard manager command center", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the manager title, filters, and clear operational sections", () => {
    renderDashboard();

    expect(
      screen.getByRole("heading", { name: "Tổng quan quản lý" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Chọn nhà hàng")).toBeInTheDocument();
    expect(screen.getByLabelText("Chọn khoảng thời gian")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Yêu cầu chờ xác nhận",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Yêu cầu hỗ trợ khách hàng" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Đơn hàng gần đây" }),
    ).toBeInTheDocument();
    expect(screen.getByText("320.000 ₫")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.getByText("#ORD-1001")).toBeInTheDocument();
    expect(screen.queryByText("#raw-order-id")).not.toBeInTheDocument();
  });

  it("groups branch, period, refresh status, and actions in one toolbar", () => {
    const handleRestaurantChange = vi.fn();
    const setRange = vi.fn();
    const handleGenerateReport = vi.fn();
    const handleSwitchToPOS = vi.fn();
    renderDashboard({
      restaurants: [...baseDashboard.restaurants, { id: "res-2", name: "Cohan 2" }],
      handleRestaurantChange,
      setRange,
      handleGenerateReport,
      handleSwitchToPOS,
    });

    const tools = within(screen.getByRole("group", { name: "Công cụ tổng quan" }));
    expect(tools.getByText("Tự cập nhật mỗi 30 giây")).toBeVisible();
    fireEvent.change(tools.getByLabelText("Chọn nhà hàng"), { target: { value: "res-2" } });
    fireEvent.change(tools.getByLabelText("Chọn khoảng thời gian"), { target: { value: "month" } });
    fireEvent.click(tools.getByRole("button", { name: "Làm mới" }));
    fireEvent.click(tools.getByRole("button", { name: "Mở bán hàng" }));

    expect(handleRestaurantChange).toHaveBeenCalledWith("res-2");
    expect(setRange).toHaveBeenCalledWith("month");
    expect(handleGenerateReport).toHaveBeenCalledOnce();
    expect(handleSwitchToPOS).toHaveBeenCalledOnce();
  });

  it("shows the waiting state when there is no branch", () => {
    renderDashboard({ restaurants: [], selectedRestaurant: null, selectedRestaurantId: "" });

    const tools = within(screen.getByRole("group", { name: "Công cụ tổng quan" }));
    expect(tools.getByText("Chờ chi nhánh")).toBeVisible();
    expect(tools.getByRole("button", { name: "Làm mới" })).toBeDisabled();
    expect(tools.getByRole("button", { name: "Mở bán hàng" })).toBeDisabled();
  });

  it("groups the queues and stock alerts before the statistics", () => {
    renderDashboard();

    const priority = screen.getByRole("region", { name: "Cần xử lý" });
    for (const name of [
      "Yêu cầu chờ xác nhận",
      "Yêu cầu hỗ trợ khách hàng",
      "Cảnh báo tồn kho",
    ]) {
      expect(within(priority).getByRole("heading", { name })).toBeVisible();
    }
    expect(priority.compareDocumentPosition(
      screen.getByRole("heading", { name: "Thông tin vận hành" }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("links low-stock alerts to inventory for permitted users", () => {
    const alerts = { lowStockItems: [{ id: "stock-1", name: "Gạo", onHand: 2 }] };
    const { unmount } = renderDashboard(alerts);
    expect(screen.queryByRole("button", { name: "Mở quản lý kho" })).toBeNull();
    unmount();

    const previousUrl = window.location.href;
    const onNavigate = vi.fn();
    window.addEventListener("manager:navigate", onNavigate);
    try {
      renderDashboard(alerts, true);
      expect(screen.getByText("1 cảnh báo")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Mở quản lý kho" }));
      expect(onNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ detail: expect.objectContaining({ page: "inventory" }) }),
      );
    } finally {
      window.removeEventListener("manager:navigate", onNavigate);
      window.history.replaceState(null, "", previousUrl);
    }
  });

  it("uses one full-width queue section when only orders are waiting", () => {
    renderDashboard({
      pendingOrders: [
        {
          id: "pending-1",
          orderCode: "POS-2001",
          customerName: "Vương",
          orderType: "DINE_IN",
          tableCode: "T101",
          total: 118000,
          createdAt: "2026-07-12T00:10:00.000Z",
          itemNames: ["Cơm gà"],
        },
      ],
      pendingReservations: [],
      pendingOrderCount: 1,
      pendingReservationCount: 0,
    });

    const summary = screen.getByLabelText("Tổng yêu cầu chờ xác nhận");
    expect(summary).toHaveTextContent("1");
    expect(summary).toHaveTextContent("đơn món");
    expect(summary).toHaveTextContent("0");
    expect(summary).toHaveTextContent("đặt bàn");

    const orderHeading = screen.getByRole("heading", { name: "Đơn đặt món" });
    expect(orderHeading.closest(".dashboard-queue-sections")).toHaveClass(
      "dashboard-queue-sections--single",
    );
    expect(
      screen.queryByRole("heading", { name: "Đặt bàn" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("#POS-2001")).toBeInTheDocument();
    expect(screen.getByText("118.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("Cơm gà")).toBeInTheDocument();
  });

  it("groups revenue and recent orders under the selected period", () => {
    renderDashboard({
      range: "month",
      revenueTrend: [
        { key: "2026-05-25", current: 0, previous: 0 },
        { key: "2026-06-23", current: 0, previous: 0 },
      ],
    });

    const period = screen.getByRole("region", { name: "Doanh thu và đơn hàng" });
    expect(within(period).getByText("30 ngày gần nhất")).toBeVisible();
    expect(within(period).getByText("25/05/2026 – 23/06/2026")).toBeVisible();
    expect(within(period).getByRole("heading", { name: "Xu hướng doanh thu" })).toBeVisible();
    expect(within(period).getByRole("heading", { name: "Đơn hàng gần đây" })).toBeVisible();
    expect(period.compareDocumentPosition(
      screen.getByRole("heading", { name: "Món bán chạy" }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows meaningful empty revenue copy instead of fake trend data when revenueTrend is empty", () => {
    renderDashboard({ revenueTrend: [] });

    expect(
      screen.getByText("Chưa có doanh thu trong khoảng thời gian này."),
    ).toBeInTheDocument();
    expect(screen.queryByText("0.0%")).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa có kỳ đối chiếu")).not.toBeInTheDocument();
  });

  it("distinguishes a successful empty result from a clear work queue", () => {
    renderDashboard({ recentOrders: [] });

    expect(screen.getByText("Không có yêu cầu nào đang chờ").closest(".dashboard-state"))
      .toHaveClass("dashboard-state--clear");
    expect(screen.getByText("Chưa có đơn hàng trong thời gian đã chọn").closest(".dashboard-state"))
      .toHaveClass("dashboard-state--empty");
    expect(screen.getByRole("region", { name: "Các số liệu vận hành cơ bản" }))
      .toBeVisible();
  });

  it("renders loading skeleton states without replacing the whole dashboard with a spinner", () => {
    renderDashboard({ loading: true, recentOrders: [], revenueTrend: [] });

    expect(
      screen.getByRole("heading", { name: "Tổng quan quản lý" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Đang tải dữ liệu doanh thu..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Đang tải dữ liệu đơn hàng")).toBeInTheDocument();
    expect(screen.getByText("Đang cập nhật")).toBeVisible();
  });

  it("shows restaurant loading copy before empty assigned state", () => {
    renderDashboard({
      restaurants: [],
      selectedRestaurant: null,
      selectedRestaurantId: "",
      restaurantsLoading: true,
    });

    const restaurantSelect = screen.getByLabelText("Chọn nhà hàng");
    expect(restaurantSelect).toBeDisabled();
    expect(screen.getAllByText("Đang tải nhà hàng...").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Không có nhà hàng được gán"),
    ).not.toBeInTheDocument();
  });

  it("renders error state with retry action", () => {
    renderDashboard({ error: new Error("Mất kết nối") });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Không thể tải dữ liệu tổng quan",
    );
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.getByText("Lỗi tải dữ liệu", { exact: true })).toBeVisible();
    expect(screen.getByText("Không thể tải thông tin vận hành.").closest(".dashboard-state"))
      .toHaveClass("dashboard-state--error");
    expect(screen.getByText("Không thể tải món bán chạy.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Các số liệu vận hành cơ bản" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Tồn kho ổn định")).not.toBeInTheDocument();
  });
});
