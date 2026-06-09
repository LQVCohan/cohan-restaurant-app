import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import StaffPayslipsPage from "./StaffPayslipsPage";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return { ...actual, useQuery: vi.fn() };
});

vi.mock("@/components/Dashboard_Manager/Staff/components/PayrollPayslipModal", () => ({
  default: ({ open, payrollPayslip, payrollPayments }) => open ? (
    <div data-testid="staff-payslip-detail">
      <span>{payrollPayslip?.employee?.name}</span>
      <span>{payrollPayments?.[0]?.referenceCode}</span>
      <span>{payrollPayments?.[0]?.amount}</span>
    </div>
  ) : null,
}));

const listResult = {
  loading: false,
  error: null,
  data: {
    myPayslips: [{
      id: "emp-1",
      payrollItemId: "item-1",
      periodId: "period-1",
      periodName: "Kỳ tháng 5",
      periodStatus: "paid",
      netSalary: 1000000,
      paidAmount: 1000000,
      remainingAmount: 0,
      paidAt: "2026-05-31T00:00:00.000Z",
    }],
  },
};

const detailResult = {
  loading: false,
  data: {
    myPayslip: {
      period: { id: "period-1", name: "Kỳ tháng 5", status: "paid", stats: { totalPayroll: 1000000, paidAmount: 1000000, remaining: 0, progress: 100 } },
      employee: { id: "emp-1", name: "Nguyen A" },
      item: { id: "emp-1", netSalary: 1000000, paidAmount: 1000000, remainingAmount: 0 },
      breakdown: { netSalary: 1000000 },
      payments: [{ id: "pay-1", amount: 1000000, referenceCode: "PAY-001", method: "cash" }],
      remainingAmount: 0,
      canMarkPaid: false,
      canEdit: false,
    },
  },
};

describe("StaffPayslipsPage", () => {
  it("renders personal payslip list and opens detail with real payment history", () => {
    useQuery.mockImplementation((_, options = {}) => (options.variables?.limit ? listResult : detailResult));

    render(<StaffPayslipsPage />);
    expect(screen.getByText("Kỳ tháng 5")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Xem chi tiết"));
    expect(screen.getByTestId("staff-payslip-detail")).toHaveTextContent("Nguyen A");
    expect(screen.getByTestId("staff-payslip-detail")).toHaveTextContent("PAY-001");
    expect(screen.getByTestId("staff-payslip-detail")).toHaveTextContent("1000000");
  });
});
