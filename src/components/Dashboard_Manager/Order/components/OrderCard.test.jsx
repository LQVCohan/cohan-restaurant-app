import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderCard from "./OrderCard";

const baseOrder = {
  id: "64f9-raw-internal-id",
  orderCode: "ORD-2026-0007",
  orderType: "dine_in",
  tableCode: "B12",
  currentStatus: "pending",
  priority: "medium",
  createdAt: new Date().toISOString(),
  customerInfo: { name: "Nguyễn An" },
  items: [{ dishId: "dish-1", name: "Phở bò", quantity: 2, status: "pending" }],
  totals: { grandTotal: 120000 },
};

describe("OrderCard operations UI", () => {
  it("renders orderCode instead of the raw id when orderCode is available", () => {
    render(<OrderCard order={baseOrder} />);

    expect(screen.getByText("ORD-2026-0007")).toBeInTheDocument();
    expect(screen.queryByText("64f9-raw-internal-id")).not.toBeInTheDocument();
  });

  it("renders a readable status badge", () => {
    render(<OrderCard order={baseOrder} />);

    expect(screen.getByText("Chờ xử lý")).toBeInTheDocument();
  });

  it("calls the status update callback from the primary action", async () => {
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
    render(<OrderCard order={baseOrder} onUpdateStatus={onUpdateStatus} />);

    fireEvent.click(screen.getByRole("button", { name: /nhận đơn/i }));

    await waitFor(() =>
      expect(onUpdateStatus).toHaveBeenCalledWith(baseOrder.id, "preparing"),
    );
  });

  it("starts preparation from a confirmed order using its action order id", async () => {
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
    render(
      <OrderCard
        order={{
          ...baseOrder,
          currentStatus: "confirmed",
          actionOrderId: "confirmed-action-order-7",
        }}
        onUpdateStatus={onUpdateStatus}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /bắt đầu chế biến/i }),
    );

    await waitFor(() =>
      expect(onUpdateStatus).toHaveBeenCalledWith(
        "confirmed-action-order-7",
        "preparing",
      ),
    );
  });

  it("calls the reject callback from a remote pending order", () => {
    const onRejectOrder = vi.fn();
    render(
      <OrderCard
        order={{
          ...baseOrder,
          actionOrderId: "action-order-7",
          orderType: "delivery",
          clientMeta: { chatThreadId: "thread-1" },
        }}
        isRemoteStaffPending
        onRejectOrder={onRejectOrder}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /từ chối đơn/i }));

    expect(onRejectOrder).toHaveBeenCalledWith("action-order-7");
  });
});
