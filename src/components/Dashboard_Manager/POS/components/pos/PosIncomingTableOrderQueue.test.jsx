import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  confirmOrder: vi.fn(),
  rejectOrder: vi.fn(),
  refetch: vi.fn(),
  showNotification: vi.fn(),
}));

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useQuery: mocks.useQuery,
    useMutation: mocks.useMutation,
  };
});

vi.mock("@/hooks/useSocketOrder", () => ({
  default: vi.fn(),
}));

vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: mocks.showNotification }),
}));

import PosIncomingTableOrderQueue from "./PosIncomingTableOrderQueue";

const operationName = (document) =>
  document?.definitions?.find((definition) => definition?.name?.value)?.name?.value;

const restaurantId = "64b000000000000000000001";

const qrOrder = {
  id: "64b000000000000000000002",
  orderCode: "QR-20260710-A01-ABC123",
  tableCode: "A01",
  currentStatus: "pending",
  createdAt: "2026-07-10T12:00:00.000Z",
  note: "Không hành",
  clientMeta: { source: "customer_table_qr" },
  totals: { grandTotal: 50000 },
  items: [
    {
      _id: "64b000000000000000000003",
      name: "Cơm gà",
      quantity: 1,
      unit: "portion",
      weightGrams: null,
      note: "Ít cay",
      servingVariant: { mode: "PORTION", sellUnit: "portion" },
    },
  ],
};

describe("PosIncomingTableOrderQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.refetch.mockResolvedValue({});
    mocks.confirmOrder.mockResolvedValue({
      data: {
        confirmIncomingOrder: {
          order: { id: qrOrder.id, currentStatus: "confirmed" },
        },
      },
    });
    mocks.rejectOrder.mockResolvedValue({
      data: {
        rejectIncomingOrder: {
          order: { id: qrOrder.id, currentStatus: "cancelled" },
        },
      },
    });
    mocks.useQuery.mockReturnValue({
      data: {
        ordersByRestaurantNow: {
          edges: [
            { node: qrOrder },
            {
              node: {
                ...qrOrder,
                id: "64b000000000000000000004",
                tableCode: "B02",
                clientMeta: { source: "pos" },
              },
            },
          ],
        },
      },
      loading: false,
      refetch: mocks.refetch,
    });
    mocks.useMutation.mockImplementation((document) => {
      const name = operationName(document);
      if (name === "ConfirmPosTableOrder") return [mocks.confirmOrder];
      if (name === "RejectPosTableOrder") return [mocks.rejectOrder];
      return [vi.fn()];
    });
  });

  it("shows only pending QR orders and confirms the selected table", async () => {
    render(<PosIncomingTableOrderQueue restaurantId={restaurantId} />);

    expect(screen.getByText("A01")).toBeInTheDocument();
    expect(screen.queryByText("B02")).not.toBeInTheDocument();
    expect(screen.getByText("Cơm gà")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nhận & chuyển bếp" }));

    await waitFor(() => expect(mocks.confirmOrder).toHaveBeenCalledOnce());
    expect(mocks.confirmOrder).toHaveBeenCalledWith({
      variables: {
        input: { id: qrOrder.id, restaurantId },
      },
    });
    expect(mocks.showNotification).toHaveBeenCalledWith(
      "Đã nhận order của bàn A01 và chuyển món vào bếp.",
      "success",
    );
  });
});
