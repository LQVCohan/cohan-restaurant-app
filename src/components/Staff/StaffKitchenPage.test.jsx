import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/context/AuthContext";
import StaffKitchenPage from "./StaffKitchenPage";

const mockLoadOrdersNow = vi.fn();
const mockUpdateItemStatus = vi.fn();
let mockOrdersNow = [];
let mockOrdersNowLoading = false;
let mockOrdersNowError = null;

vi.mock("@/hooks/useOrderManagement", () => ({
  default: () => ({
    ordersNow: mockOrdersNow,
    ordersNowLoading: mockOrdersNowLoading,
    ordersNowError: mockOrdersNowError,
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

const renderPage = (roleName = "manager") =>
  render(
    <AuthContext.Provider
      value={{
        user: {
          roleName,
          restaurantForStaff: { id: "restaurant-1", name: "Cohan Test" },
        },
      }}
    >
      <StaffKitchenPage />
    </AuthContext.Provider>,
  );

const getSummaryValue = (label) => {
  const heading = screen
    .getAllByText((content, element) => {
      return element?.tagName?.toLowerCase() === "p" && content.startsWith(label);
    })
    .find(Boolean);
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
    mockOrdersNowLoading = false;
    mockOrdersNowError = null;
    mockLoadOrdersNow.mockClear();
    mockUpdateItemStatus.mockReset();
    mockUpdateItemStatus.mockResolvedValue({ success: true });
  });

  it("renders live station counts, operational summary, notes, and urgency signals", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Một hàng chờ cho toàn bộ khu chế biến" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cập nhật theo order mới")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chế độ bếp chính" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chế độ quầy bar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tổng hợp" })).toBeInTheDocument();
    expect(screen.getByLabelText("1 món cần xử lý")).toBeInTheDocument();
    expect(screen.getAllByLabelText("1 món cần xử lý")).toHaveLength(2);
    expect(screen.getByLabelText("2 món cần xử lý")).toBeInTheDocument();

    expect(getSummaryValue("Cần xử lý")).toHaveTextContent("2");
    expect(getSummaryValue("Chờ nhận")).toHaveTextContent("1");
    expect(getSummaryValue("Đang làm")).toHaveTextContent("1");
    expect(getSummaryValue("Sẵn sàng")).toHaveTextContent("1");
    expect(getSummaryValue("Trễ / quá hạn")).toHaveTextContent("2");

    expect(screen.getByText("Phở bò")).toBeInTheDocument();
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

  it("switches between bar, kitchen, and combined modes", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Chế độ quầy bar" }));
    expect(
      screen.getByRole("heading", { name: "Điều phối quầy bar theo thời gian thực" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Trà đào")).toBeInTheDocument();
    expect(screen.queryByText("Phở bò")).not.toBeInTheDocument();
    expect(getSummaryValue("Cần xử lý")).toHaveTextContent("1");
    expect(getSummaryValue("Chờ nhận")).toHaveTextContent("0");
    expect(getSummaryValue("Đang làm")).toHaveTextContent("1");
    expect(getSummaryValue("Trễ / quá hạn")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Chế độ bếp chính" }));
    expect(
      screen.getByRole("heading", { name: "Ưu tiên món đang chờ bếp" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Phở bò")).toBeInTheDocument();
    expect(screen.queryByText("Trà đào")).not.toBeInTheDocument();
    expect(getSummaryValue("Cần xử lý")).toHaveTextContent("1");
    expect(getSummaryValue("Chờ nhận")).toHaveTextContent("1");
    expect(getSummaryValue("Sẵn sàng")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Tổng hợp" }));
    expect(screen.getByText("Phở bò")).toBeInTheDocument();
    expect(screen.getByText("Trà đào")).toBeInTheDocument();
  });

  it("opens bartender accounts directly in bar mode and hides unrelated modes", () => {
    renderPage("bartender");

    expect(
      screen.getByRole("heading", { name: "Điều phối quầy bar theo thời gian thực" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chế độ quầy bar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chế độ bếp chính" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tổng hợp" })).not.toBeInTheDocument();
    expect(screen.getByText("Trà đào")).toBeInTheDocument();
    expect(screen.queryByText("Phở bò")).not.toBeInTheDocument();
  });

  it("offers a useful reset action when the selected filter is empty", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Chế độ quầy bar" }));
    fireEvent.click(screen.getByRole("button", { name: "Chờ nhận" }));

    expect(screen.getByText("Quầy bar chưa có món chờ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả trạng thái" }));
    expect(screen.getByText("Trà đào")).toBeInTheDocument();
  });

  it("uses station-specific action copy while updating item status", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Nhận vào bếp" }));
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

    fireEvent.click(screen.getByRole("button", { name: "Báo đồ uống sẵn sàng" }));
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

  it("prioritizes urgent work before normal work", () => {
    mockOrdersNow = [
      {
        id: "normal-order",
        orderCode: "NORMAL",
        tableCode: "N1",
        currentStatus: "confirmed",
        orderType: "dine_in",
        createdAt: "2026-06-03T07:00:00.000Z",
        items: [
          {
            _id: "normal-item",
            name: "Món bình thường",
            quantity: 1,
            status: "pending",
            station: "kitchen",
          },
        ],
      },
      {
        id: "urgent-order",
        orderCode: "URGENT",
        tableCode: "U1",
        currentStatus: "confirmed",
        orderType: "dine_in",
        createdAt: "2026-06-03T08:00:00.000Z",
        items: [
          {
            _id: "urgent-item",
            name: "Món quá hạn",
            quantity: 1,
            status: "pending",
            station: "kitchen",
            unaccepted: true,
          },
        ],
      },
    ];

    const { container } = renderPage();
    const titles = [...container.querySelectorAll(".staff-kitchen-page__order-title")].map(
      (element) => element.textContent,
    );

    expect(titles).toEqual(["Bàn U1", "Bàn N1"]);
  });

  it("provides retry when order loading fails", () => {
    mockOrdersNowError = new Error("Mất kết nối thử nghiệm");
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent("Mất kết nối thử nghiệm");
    fireEvent.click(screen.getByRole("button", { name: "Thử tải lại" }));

    expect(mockLoadOrdersNow).toHaveBeenLastCalledWith({
      variables: { restaurantId: "restaurant-1", limit: 100 },
      fetchPolicy: "network-only",
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

    const itemCard = screen.getByText("Món chưa phân khu").closest("li");
    expect(within(itemCard).getByText("Chưa phân khu")).toBeInTheDocument();
    expect(screen.getByText(/Đã chờ|Vừa vào khu chế biến/)).toBeInTheDocument();
  });
});
