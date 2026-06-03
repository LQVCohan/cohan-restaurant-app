import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import StaffKitchenPage from "./StaffKitchenPage";

const mockLoadOrdersNow = vi.fn();
const mockUpdateItemStatus = vi.fn();
let mockOrdersNow = [];

vi.mock("@/hooks/useOrderManagement", () => ({
  default: () => ({
    ordersNow: mockOrdersNow,
    ordersNowLoading: false,
    ordersNowError: null,
    loadOrdersNow: mockLoadOrdersNow,
    updateItemStatus: mockUpdateItemStatus,
  }),
}));

vi.mock("@/hooks/useSocketOrder", () => ({
  default: vi.fn(),
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: vi.fn() }),
}));

const renderPage = () =>
  render(
    <AuthContext.Provider
      value={{
        user: {
          restaurantForStaff: { id: "restaurant-1", name: "Cohan Test" },
        },
      }}
    >
      <StaffKitchenPage />
    </AuthContext.Provider>,
  );

const getSummaryValue = (label) => {
  const heading = screen
    .getAllByText(label)
    .find((element) => element.tagName.toLowerCase() === "p");
  return heading?.nextSibling;
};

const buildOrders = () => [
  {
    id: "order-1",
    orderCode: "ORD-1",
    tableCode: "T1",
    currentStatus: "confirmed",
    orderType: "dine_in",
    createdAt: "2026-06-03T08:00:00.000Z",
    items: [
      {
        _id: "item-kitchen-pending",
        name: "Phở bò",
        quantity: 2,
        status: "pending",
        station: "kitchen",
        note: "Ít hành",
        kitchenEnteredAt: "2026-06-03T08:05:00.000Z",
        targetPrepMinutes: 20,
        unaccepted: true,
        unacceptedAfterMinutes: 5,
        unacceptedReason: "Món chưa được nhận sau ngưỡng thời gian cho phép.",
      },
      {
        _id: "item-cancelled",
        name: "Món hủy",
        quantity: 1,
        status: "cancelled",
        station: "kitchen",
      },
    ],
  },
  {
    id: "order-2",
    orderCode: "ORD-2",
    tableCode: "T2",
    currentStatus: "confirmed",
    orderType: "takeaway",
    createdAt: "2026-06-03T08:10:00.000Z",
    items: [
      {
        _id: "item-bar-preparing",
        name: "Trà đào",
        quantity: 1,
        status: "preparing",
        station: "bar",
        timeLevel: "very_late",
        actualPrepMinutes: 18,
        targetPrepMinutes: 10,
      },
    ],
  },
  {
    id: "order-3",
    orderCode: "ORD-3",
    tableCode: "T3",
    currentStatus: "confirmed",
    orderType: "delivery",
    createdAt: "2026-06-03T08:20:00.000Z",
    items: [
      {
        _id: "item-ready",
        name: "Cơm gà",
        quantity: 1,
        status: "ready",
        station: "kitchen",
      },
    ],
  },
];

describe("StaffKitchenPage", () => {
  beforeEach(() => {
    mockOrdersNow = buildOrders();
    mockLoadOrdersNow.mockClear();
    mockUpdateItemStatus.mockReset();
    mockUpdateItemStatus.mockResolvedValue({ success: true });
  });

  it("renders the kitchen/bar dispatch title, filters, summaries, notes, and late indicators", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Bảng điều phối bếp / bar" })).toBeInTheDocument();
    expect(screen.getByText("Xem món cần chuẩn bị theo khu vực bếp/bar và cập nhật trạng thái chế biến cho nhà hàng được gán.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tất cả khu vực" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bếp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bar" })).toBeInTheDocument();

    expect(getSummaryValue("Cần xử lý")).toHaveTextContent("2");
    expect(getSummaryValue("Chờ nhận")).toHaveTextContent("1");
    expect(getSummaryValue("Đang làm")).toHaveTextContent("1");
    expect(getSummaryValue("Sẵn sàng")).toHaveTextContent("1");
    expect(getSummaryValue("Món trễ / quá thời gian chuẩn bị")).toHaveTextContent("2");

    expect(screen.getByText("x2 Phở bò")).toBeInTheDocument();
    expect(screen.getByText("Ghi chú món: Ít hành")).toBeInTheDocument();
    expect(screen.getByText("Chưa nhận quá hạn")).toBeInTheDocument();
    expect(screen.getByText("Rất trễ")).toBeInTheDocument();
    expect(screen.queryByText("Món hủy")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockLoadOrdersNow).toHaveBeenCalledWith({
        variables: { restaurantId: "restaurant-1", limit: 100 },
        fetchPolicy: "network-only",
      });
    });
  });

  it("filters visible rows and summary counts by station", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Bar" }));
    expect(screen.getByText("x1 Trà đào")).toBeInTheDocument();
    expect(screen.queryByText("x2 Phở bò")).not.toBeInTheDocument();
    expect(getSummaryValue("Cần xử lý")).toHaveTextContent("1");
    expect(getSummaryValue("Chờ nhận")).toHaveTextContent("0");
    expect(getSummaryValue("Đang làm")).toHaveTextContent("1");
    expect(getSummaryValue("Món trễ / quá thời gian chuẩn bị")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Bếp" }));
    expect(screen.getByText("x2 Phở bò")).toBeInTheDocument();
    expect(screen.queryByText("x1 Trà đào")).not.toBeInTheDocument();
    expect(getSummaryValue("Cần xử lý")).toHaveTextContent("1");
    expect(getSummaryValue("Chờ nhận")).toHaveTextContent("1");
    expect(getSummaryValue("Sẵn sàng")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Tất cả khu vực" }));
    expect(screen.getByText("x2 Phở bò")).toBeInTheDocument();
    expect(screen.getByText("x1 Trà đào")).toBeInTheDocument();
  });

  it("filters rows by status while keeping station filter applied", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Bar" }));
    fireEvent.click(screen.getByRole("button", { name: "Chờ nhận" }));
    expect(screen.getByText("Không có món nào trong bộ lọc trạng thái và khu vực hiện tại.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Đang làm" }));
    expect(screen.getByText("x1 Trà đào")).toBeInTheDocument();
  });

  it("updates pending items to preparing and preparing items to ready", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Nhận món vào chế biến" }));
    await waitFor(() => {
      expect(mockUpdateItemStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-1",
          itemKey: "item-kitchen-pending",
          status: "preparing",
          restaurantId: "restaurant-1",
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Báo món đã sẵn sàng" }));
    await waitFor(() => {
      expect(mockUpdateItemStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-2",
          itemKey: "item-bar-preparing",
          status: "ready",
          restaurantId: "restaurant-1",
        }),
      );
    });
  });

  it("does not crash when an item has no station or timing metadata", () => {
    mockOrdersNow = [
      {
        id: "order-no-station",
        orderCode: "ORD-4",
        currentStatus: "confirmed",
        orderType: "dine_in",
        createdAt: "2026-06-03T08:30:00.000Z",
        items: [{ _id: "item-no-station", name: "Món chưa phân khu", quantity: 1, status: "pending" }],
      },
    ];

    renderPage();

    const itemCard = screen.getByText("x1 Món chưa phân khu").closest("div.rounded-lg");
    expect(within(itemCard).getByText("Chưa phân khu")).toBeInTheDocument();
    expect(screen.getByText(/Đã chờ|Mới vào bếp\/bar/)).toBeInTheDocument();
  });
});
