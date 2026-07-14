import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apolloMocks = vi.hoisted(() => ({
  enqueuePrintJob: vi.fn(),
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useMutation: vi.fn(() => [apolloMocks.enqueuePrintJob]),
  };
});

import InvoiceReceiptModal from "./InvoiceReceiptModal";

const receiptData = {
  invoice: {
    id: "invoice-1",
    number: "INV-001",
    tableCode: "T1",
    issuedAt: "2026-07-14T00:00:00.000Z",
    paid: 100000,
    totals: {
      grandTotal: 100000,
      discount: 0,
    },
    lines: [
      {
        name: "Món test",
        quantity: 1,
        unitPrice: 100000,
        subtotal: 100000,
      },
    ],
  },
  transaction: {
    method: "cash",
    paidAmount: 100000,
  },
};

describe("InvoiceReceiptModal printing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apolloMocks.enqueuePrintJob.mockResolvedValue({
      data: {
        enqueuePrintJob: {
          id: "job-1",
          status: "pending",
          error: null,
        },
      },
    });
    window.print = vi.fn();
  });

  afterEach(() => cleanup());

  it("uses the cashier station and the existing receipt template", async () => {
    render(
      <InvoiceReceiptModal
        isOpen
        receiptData={receiptData}
        restaurantId="restaurant-1"
        table={{ code: "T1" }}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "In hóa đơn" }));

    await waitFor(() => expect(apolloMocks.enqueuePrintJob).toHaveBeenCalledTimes(1));
    expect(apolloMocks.enqueuePrintJob).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          restaurantId: "restaurant-1",
          printerId: null,
          stationId: "cashier",
          printType: "invoice_print_now",
          templateKey: "receipt",
        }),
      },
    });
    expect(await screen.findByText("Đã tạo lệnh in #job-1.")).toBeInTheDocument();
    expect(window.print).not.toHaveBeenCalled();
  });

  it("falls back to browser printing when the configured printer is offline", async () => {
    apolloMocks.enqueuePrintJob.mockResolvedValue({
      data: {
        enqueuePrintJob: {
          id: "job-offline",
          status: "failed",
          error: "Printer is not configured or available",
        },
      },
    });

    render(
      <InvoiceReceiptModal
        isOpen
        receiptData={receiptData}
        restaurantId="restaurant-1"
        table={{ code: "T1" }}
        onClose={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "In hóa đơn" }));

    expect(
      await screen.findByText("Printer is not configured or available"),
    ).toBeInTheDocument();
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1));
  });
});
