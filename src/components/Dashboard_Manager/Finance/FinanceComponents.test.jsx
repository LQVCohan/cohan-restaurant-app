import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FinanceStats,
  ReceivableDebts,
  RevenueChart,
} from "./FinanceComponents";

const formatUsd = (value) => `$${Number(value || 0).toFixed(2)}`;

describe("finance presentation components", () => {
  it("uses the shared formatter and preserves card drill-down queries", () => {
    const onNavigate = vi.fn();
    render(
      <FinanceStats
        summary={{ revenue: 125, payment: 100, primeCostRate: 42.5 }}
        formatMoney={formatUsd}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.getByText("$125.00")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Doanh thu ghi nhận: \$125\.00/i }),
    );
    expect(onNavigate).toHaveBeenCalledWith({
      tab: "journal",
      type: "INFLOW",
      category: "sale",
    });
  });

  it("distinguishes a loss bar and formats chart tooltips consistently", () => {
    const { container } = render(
      <RevenueChart
        trend={[{ key: "07/2026", revenue: 100, expense: 130, profit: -30 }]}
        formatMoney={formatUsd}
      />,
    );

    expect(container.querySelector(".bar.profit.loss")).toBeInTheDocument();
    expect(container.querySelector(".bar.profit.loss")).toHaveAttribute(
      "title",
      "Lỗ: $-30.00",
    );
  });

  it("renders receivable values with the selected display currency", () => {
    render(
      <ReceivableDebts
        debts={[
          {
            id: "invoice-1",
            supplier: "Hóa đơn HD-001",
            amount: 75,
            dueDate: "2026-07-10T00:00:00.000Z",
            status: "UNPAID",
          },
        ]}
        formatMoney={formatUsd}
      />,
    );

    expect(screen.getByText("$75.00")).toBeInTheDocument();
    expect(screen.getByText("Chưa thanh toán")).toBeInTheDocument();
  });
});
