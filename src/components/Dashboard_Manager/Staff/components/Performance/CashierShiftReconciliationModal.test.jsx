import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffPerformanceOperationsPage from "./StaffPerformanceOperationsPage";
import useCashierShiftReconciliation from "@/hooks/useCashierShiftReconciliation";

vi.mock("@/hooks/useCashierShiftReconciliation", () => ({
  default: vi.fn(),
}));
vi.mock("./StaffPerformancePolicyPage", () => ({
  default: () => <div data-testid="policy-performance-page">Performance page</div>,
}));
vi.mock("./StaffPerformancePage", () => ({
  resolveEffectivePerformanceRestaurantId: (value) => {
    if (!value || String(value).toLowerCase() === "all") return null;
    return String(value);
  },
}));

const submittedItem = {
  id: "reconciliation-1",
  restaurantId: "restaurant-1",
  cashierId: "cashier-1",
  cashierName: "Nguyễn Thu Ngân",
  cashierCode: "NV001",
  registerCode: "MAIN",
  status: "SUBMITTED",
  openedAt: "2026-07-12T01:00:00.000Z",
  closedAt: "2026-07-12T09:00:00.000Z",
  openingCash: 500000,
  actualCash: 1450000,
  cashSalesAmount: 1000000,
  cashRefundAmount: 0,
  movementNetAmount: 0,
  managerAdjustmentAmount: 0,
  expectedCash: 1500000,
  varianceAmount: -50000,
  varianceRate: 50000 / 1500000,
  attributableToCashier: false,
  movements: [],
  transactionIds: ["transaction-1"],
  refundIds: [],
  auditTrail: [],
};

const renderPage = (overrides = {}) =>
  render(
    <StaffPerformanceOperationsPage
      employees={[
        {
          id: "cashier-1",
          name: "Nguyễn Thu Ngân",
          code: "NV001",
          department: "cashier",
          role: "Thu ngân",
        },
      ]}
      selectedRestaurant="restaurant-1"
      restaurantList={[{ id: "restaurant-1", name: "Cohan Central" }]}
      searchQuery=""
      {...overrides}
    />,
  );

describe("cashier shift reconciliation manager flow", () => {
  const openReconciliation = vi.fn();
  const reviewReconciliation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    openReconciliation.mockResolvedValue({
      data: { openCashierShiftReconciliation: { ...submittedItem, status: "OPEN" } },
    });
    reviewReconciliation.mockResolvedValue({
      data: {
        reviewCashierShiftReconciliation: {
          ...submittedItem,
          status: "APPROVED",
          attributableToCashier: true,
        },
      },
    });
    useCashierShiftReconciliation.mockReturnValue({
      items: [submittedItem],
      loading: false,
      error: null,
      actionLoading: false,
      actionError: null,
      openReconciliation,
      addMovement: vi.fn(),
      refreshReconciliation: vi.fn(),
      submitReconciliation: vi.fn(),
      reviewReconciliation,
    });
  });

  it("requires a concrete restaurant before opening cash controls", () => {
    renderPage({ selectedRestaurant: "all" });

    expect(
      screen.getByRole("button", { name: "Quản lý chốt quỹ" }),
    ).toBeDisabled();
  });

  it("opens an accessible modal and creates a cashier shift", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Quản lý chốt quỹ" }));

    expect(
      screen.getByRole("dialog", { name: "Đối soát ca thu ngân" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở ca mới" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Tiền đầu ca" }), {
      target: { value: "700000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mở ca" }));

    await waitFor(() => {
      expect(openReconciliation).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "restaurant-1",
          cashierId: "cashier-1",
          registerCode: "MAIN",
          openingCash: 700000,
        }),
      );
    });
  });

  it("sends responsibility attribution only through manager review", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Quản lý chốt quỹ" }));

    expect(
      await screen.findByText("Quản lý xác nhận trách nhiệm"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Xác nhận chênh lệch thuộc trách nhiệm thu ngân/,
      }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Lý do quyết định" }), {
      target: { value: "Đã kiểm đếm lại và xác nhận thiếu tiền tại két." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Duyệt kết quả" }));

    await waitFor(() => {
      expect(reviewReconciliation).toHaveBeenCalledWith({
        reconciliationId: "reconciliation-1",
        decision: "APPROVE",
        attributableToCashier: true,
        managerAdjustmentAmount: 0,
        note: "Đã kiểm đếm lại và xác nhận thiếu tiền tại két.",
      });
    });
  });
});
