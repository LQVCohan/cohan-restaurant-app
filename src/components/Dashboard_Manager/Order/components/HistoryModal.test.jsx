import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const loadOrdersAll = vi.hoisted(() => vi.fn());

vi.mock("../../../../hooks/useOrderManagement", () => ({
  default: () => ({ loadOrdersAll }),
}));

import HistoryModal from "./HistoryModal";

describe("HistoryModal", () => {
  it("uses the summary as filters and shows plain promotion wording", async () => {
    loadOrdersAll.mockResolvedValue({
      data: {
        ordersByRestaurant: {
          edges: [
            { node: {
              id: "order-1",
              orderCode: "POS-01",
              currentStatus: "served",
              orderType: "dine_in",
              tableCode: "T101",
              createdAt: "2026-07-13T08:00:00.000Z",
              items: [{ name: "Cơm gà", quantity: 1 }],
              totals: { grandTotal: 59000, voucherCode: "HE2026", promotionId: "promotion-1" },
            } },
            { node: {
              id: "order-2",
              orderCode: "POS-02",
              currentStatus: "cancelled",
              orderType: "dine_in",
              tableCode: "T102",
              createdAt: "2026-07-13T09:00:00.000Z",
              items: [],
              totals: { grandTotal: 0 },
            } },
          ],
          pageInfo: { endCursor: null, hasNextPage: false },
        },
      },
    });

    render(
      <HistoryModal restaurantId="restaurant-1" onClose={vi.fn()} onViewOrder={vi.fn()} />,
    );

    await waitFor(() => expect(screen.getByText("#POS-01")).toBeInTheDocument());
    expect(screen.getByText("Mã ưu đãi HE2026")).toBeInTheDocument();
    expect(screen.getByText("Ưu đãi tự động")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tổng 2/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /Đã hủy 1/ }));
    expect(screen.queryByText("#POS-01")).not.toBeInTheDocument();
    expect(screen.getByText("#POS-02")).toBeInTheDocument();
  });
});
