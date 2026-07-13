import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import OrderModal, { buildReturnReasonFromForm } from "./OrderModal";

vi.mock("@apollo/client", async (importOriginal) => ({
  ...(await importOriginal()),
  useMutation: () => [vi.fn()],
}));

vi.mock("./OrderTrackingQrCard", () => ({
  default: () => null,
}));

describe("OrderModal return reason preset builder", () => {
  it("uses selected preset reason (Món nguội)", () => {
    expect(buildReturnReasonFromForm({ reasonPreset: "Món nguội", reason: "" })).toContain("Món nguội");
  });

  it("requires custom reason when preset is Khác", () => {
    expect(() => buildReturnReasonFromForm({ reasonPreset: "Khác", reason: "" })).toThrow(
      "Vui lòng nhập lý do trả lại món.",
    );
  });

  it("uses customer preset reason (Khách đổi ý)", () => {
    expect(buildReturnReasonFromForm({ reasonPreset: "Khách đổi ý", reason: "" })).toContain("Khách đổi ý");
  });

  it("requires reason when missing both preset and custom text", () => {
    expect(() => buildReturnReasonFromForm({ reasonPreset: "", reason: "" })).toThrow(
      "Vui lòng chọn hoặc nhập lý do trả lại món.",
    );
  });
});

describe("OrderModal immediate item cancellation", () => {
  it("requires a reason and submits the selected item once", async () => {
    const onCancelItem = vi.fn(async () => undefined);
    render(
      <OrderModal
        order={{
          id: "order-1",
          orderCode: "ORD-01",
          currentStatus: "preparing",
          createdAt: new Date().toISOString(),
          items: [
            {
              _id: "item-1",
              name: "Cá hấp",
              quantity: 2,
              unitPrice: 95000,
              status: "preparing",
              voidRequests: [],
              returnRequests: [],
            },
          ],
        }}
        onClose={vi.fn()}
        onCancelItem={onCancelItem}
      />,
    );

    expect(screen.getByText("Tình trạng món")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Báo món đã sẵn sàng" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hủy món" }));
    fireEvent.change(screen.getByLabelText("Lý do chính"), {
      target: { value: "Món cháy / khét" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(onCancelItem).toHaveBeenCalledTimes(1));
    expect(onCancelItem).toHaveBeenCalledWith({
      orderId: "order-1",
      orderItemId: "item-1",
      quantity: 1,
      reason: "Món cháy / khét",
    });
  });

  it("shows one explicit next kitchen action instead of a status menu", async () => {
    const onUpdateItemStatus = vi.fn(async () => undefined);
    render(
      <OrderModal
        order={{
          id: "order-2",
          orderCode: "ORD-02",
          currentStatus: "confirmed",
          createdAt: new Date().toISOString(),
          payment: { status: "pending", method: "cash" },
          items: [
            {
              _id: "item-2",
              name: "Cơm gà",
              quantity: 1,
              unitPrice: 59000,
              status: "pending",
              voidRequests: [],
              returnRequests: [],
            },
          ],
        }}
        onClose={vi.fn()}
        onUpdateItemStatus={onUpdateItemStatus}
      />,
    );

    expect(screen.getByText("Chưa thanh toán · Tiền mặt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu chế biến" }));
    await waitFor(() =>
      expect(onUpdateItemStatus).toHaveBeenCalledWith("order-2", 0, "preparing"),
    );
  });
});
