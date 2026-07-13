import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  confirmOrder: vi.fn(),
  rejectOrder: vi.fn(),
  setProofWaiver: vi.fn(),
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
const orderId = "64b000000000000000000002";
const itemId = "64b000000000000000000003";

const qrOrder = {
  id: orderId,
  orderCode: "QR-20260710-A01-ABC123",
  tableCode: "A01",
  currentStatus: "pending",
  createdAt: "2026-07-10T12:00:00.000Z",
  note: "Không hành",
  clientMeta: { source: "customer_table_qr" },
  totals: { grandTotal: 50000 },
  items: [
    {
      _id: itemId,
      name: "Cơm gà",
      quantity: 1,
      unit: "portion",
      weightGrams: null,
      proofImages: [],
      note: "Ít cay",
      servingVariant: { mode: "PORTION", sellUnit: "portion" },
    },
  ],
};

const weightedItem = {
  ...qrOrder.items[0],
  _id: itemId,
  name: "Cua cân ký",
  unit: "kg",
  weightGrams: 850,
  proofImages: [],
  servingVariant: { mode: "BY_WEIGHT", sellUnit: "kg" },
};

const accessRequest = {
  requestId: "request-1",
  requestLabel: "A1B2",
  tableId: "64b000000000000000000009",
  tableCode: "B03",
  requestedAt: "2026-07-10T12:01:00.000Z",
  expiresAt: "2026-07-10T12:06:00.000Z",
  confirmationCode: "493201",
};

function setQueryData({ requests = [], orders = [qrOrder] } = {}) {
  mocks.useQuery.mockReturnValue({
    data: {
      tableQrOrderAccessRequests: requests,
      ordersByRestaurantNow: {
        edges: [
          ...orders.map((order) => ({ node: order })),
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
}

describe("PosIncomingTableOrderQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
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
    mocks.setProofWaiver.mockResolvedValue({
      data: {
        setOrderItemProofWaiver: {
          order: { id: qrOrder.id, clientMeta: {} },
        },
      },
    });
    setQueryData();
    mocks.useMutation.mockImplementation((document) => {
      const name = operationName(document);
      if (name === "ConfirmPosTableOrder") return [mocks.confirmOrder];
      if (name === "RejectPosTableOrder") return [mocks.rejectOrder];
      if (name === "SetPosOrderItemProofWaiver") return [mocks.setProofWaiver];
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

  it("blocks handoff and lets POS record that the customer does not need proof", async () => {
    setQueryData({
      orders: [{ ...qrOrder, items: [weightedItem] }],
    });

    render(<PosIncomingTableOrderQueue restaurantId={restaurantId} />);

    expect(
      screen.getByText("Cần ảnh minh chứng trước khi chuyển bếp"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bổ sung ảnh Cua cân ký" }),
    ).toBeEnabled();
    const waiverButton = screen.getByRole("button", {
      name: "Khách không cần ảnh Cua cân ký",
    });
    expect(waiverButton).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Nhận & chuyển bếp" }),
    ).toBeDisabled();

    fireEvent.click(waiverButton);

    await waitFor(() => expect(mocks.setProofWaiver).toHaveBeenCalledOnce());
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Thao tác này sẽ được ghi lại"),
    );
    expect(mocks.setProofWaiver).toHaveBeenCalledWith({
      variables: {
        input: {
          restaurantId,
          orderId,
          orderItemId: itemId,
          waived: true,
          reason: "Khách hàng xác nhận không cần ảnh minh chứng.",
        },
      },
    });
  });

  it("allows handoff after the customer waiver is persisted", async () => {
    setQueryData({
      orders: [
        {
          ...qrOrder,
          clientMeta: {
            source: "customer_table_qr",
            proofWaivers: {
              [itemId]: {
                waived: true,
                waivedBy: "staff-1",
                waivedAt: "2026-07-14T02:00:00.000Z",
                reason: "Khách hàng xác nhận không cần ảnh minh chứng.",
              },
            },
          },
          items: [weightedItem],
        },
      ],
    });

    render(<PosIncomingTableOrderQueue restaurantId={restaurantId} />);

    expect(
      screen.getByText("Khách đã xác nhận không cần ảnh minh chứng"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Yêu cầu lại ảnh Cua cân ký" }),
    ).toBeEnabled();
    const confirmButton = screen.getByRole("button", {
      name: "Nhận & chuyển bếp",
    });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    await waitFor(() => expect(mocks.confirmOrder).toHaveBeenCalledOnce());
  });

  it("keeps the table confirmation code hidden until staff reaches the table", () => {
    setQueryData({ requests: [accessRequest], orders: [] });

    render(<PosIncomingTableOrderQueue restaurantId={restaurantId} />);

    expect(screen.getByText("Bàn B03")).toBeInTheDocument();
    expect(screen.getByText("#A1B2", { selector: "em" })).toBeInTheDocument();
    expect(screen.queryByText("493201")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Đã tới đúng bàn – hiện mã" }),
    );

    expect(screen.getByText("493201")).toBeInTheDocument();
    expect(
      screen.getByText(/Chỉ đọc cho khách đang cầm thiết bị/i),
    ).toBeInTheDocument();
  });
});
