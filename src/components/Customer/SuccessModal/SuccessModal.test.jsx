import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SuccessModal from "./SuccessModal";

vi.mock("@/components/common/Modal", () => {
  const MockModal = ({ isOpen, title, children }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h1>{title}</h1>
        {children}
      </div>
    ) : null;
  MockModal.Footer = ({ children }) => <footer>{children}</footer>;
  return { default: MockModal };
});

describe("SuccessModal", () => {
  it("shows the booking, linked dishes and deposit confirmation in one mobile-friendly summary", () => {
    const onClose = vi.fn();

    render(
      <SuccessModal
        isOpen
        onClose={onClose}
        booking={{
          id: "reservation-1",
          orderCode: "RSV-240711-01",
          restaurantName: "COHAN Central",
          tableCode: "A12",
          customerName: "Nguyễn An",
          customerPhone: "0901234567",
          customerEmail: "an@example.com",
          partySize: 4,
          timeTo: "2026-07-12T12:30:00.000Z",
          depositAmount: 350000,
          linkedMenuSubtotal: 500000,
          linkedCartItems: [
            { id: "item-1", quantity: 2 },
            { id: "item-2", quantity: 1 },
          ],
          linkedOrders: [{ id: "order-1", orderCode: "ORD-240711-01" }],
        }}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Đặt bàn và món thành công" }),
    ).toBeInTheDocument();
    expect(screen.getByText("RSV-240711-01")).toBeInTheDocument();
    expect(screen.getByText("COHAN Central")).toBeInTheDocument();
    expect(screen.getByText("A12")).toBeInTheDocument();
    expect(screen.getByText(/3 món · 500\.000/)).toBeInTheDocument();
    expect(screen.getByText("ORD-240711-01")).toBeInTheDocument();
    expect(screen.getByText(/350\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hoàn tất" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the order-mode confirmation concise and understandable", () => {
    render(
      <SuccessModal
        isOpen
        mode="order"
        onClose={vi.fn()}
        order={{
          orderCode: "ORD-02",
          customerName: "Trần Bình",
          phone: "0912345678",
          email: "binh@example.com",
          paymentMethod: "wallet",
          status: "Đã xác nhận",
          total: 245000,
        }}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Đặt món thành công" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ORD-02")).toBeInTheDocument();
    expect(screen.getByText("Ví nội bộ")).toBeInTheDocument();
    expect(screen.getByText(/245\.000/)).toBeInTheDocument();
  });
});
