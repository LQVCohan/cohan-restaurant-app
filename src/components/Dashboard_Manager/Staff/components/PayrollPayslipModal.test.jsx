import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PayrollPayslipModal from "./PayrollPayslipModal";

const payslip = {
  remainingAmount: 1500000,
  canMarkPaid: true,
  period: {
    id: "period-1",
    name: "Kỳ tháng 4",
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-04-30T00:00:00.000Z",
    status: "finalized",
  },
  employee: {
    id: "emp-1",
    name: "Nguyễn Văn A",
    code: "NV001",
    department: "Bếp",
    role: "Chef",
  },
  item: { netSalary: 5000000, status: "finalized" },
  breakdown: {
    baseSalary: 6000000,
    actualWorkDays: 24,
    totalHours: 192,
    overtimeNormalHours: 4,
    overtimeWeekendHours: 2,
    overtimeHolidayHours: 0,
    nightHours: 8,
    grossIncome: 6500000,
    allowance: 500000,
    bonus: 1000000,
    deduction: 200000,
    insuranceTotal: 700000,
    personalIncomeTax: 300000,
    netSalary: 5000000,
  },
};

const renderModal = (props = {}) =>
  render(
    <PayrollPayslipModal
      open
      onClose={vi.fn()}
      periodId="period-1"
      employeeId="emp-1"
      payrollPayslip={payslip}
      payrollPayments={[]}
      markPayrollItemPaid={vi.fn().mockResolvedValue({})}
      loading={false}
      onPaidSuccess={vi.fn().mockResolvedValue({})}
      {...props}
    />,
  );

describe("PayrollPayslipModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows payslip net salary and remaining amount", () => {
    renderModal();

    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByTestId("payslip-netSalary")).toHaveTextContent("5.000.000");
    expect(screen.getByTestId("payslip-remainingAmount")).toHaveTextContent("1.500.000");
  });

  it("shows payment history and empty state", () => {
    const { rerender } = renderModal();
    expect(screen.getByTestId("payroll-payment-empty")).toHaveTextContent("Chưa có thanh toán nào.");

    rerender(
      <PayrollPayslipModal
        open
        onClose={vi.fn()}
        periodId="period-1"
        employeeId="emp-1"
        payrollPayslip={payslip}
        payrollPayments={[{ id: "pay-1", amount: 1000000, method: "cash", paidAt: "2026-05-01T00:00:00.000Z", note: "Đợt 1", referenceCode: "REF-1" }]}
        markPayrollItemPaid={vi.fn()}
        loading={false}
      />,
    );

    expect(screen.getByText("REF-1")).toBeInTheDocument();
    expect(screen.getByText("Đợt 1")).toBeInTheDocument();
  });

  it("submits mark paid with the expected mutation input", async () => {
    const markPayrollItemPaid = vi.fn().mockResolvedValue({});
    const onPaidSuccess = vi.fn().mockResolvedValue({});
    renderModal({ markPayrollItemPaid, onPaidSuccess });

    fireEvent.change(screen.getByLabelText("Số tiền"), { target: { value: "1200000" } });
    fireEvent.change(screen.getByLabelText("Phương thức"), { target: { value: "bank_transfer" } });
    fireEvent.change(screen.getByLabelText("Mã tham chiếu"), { target: { value: "BANK-01" } });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Chuyển khoản" } });
    fireEvent.click(screen.getByText("Xác nhận thanh toán"));

    await waitFor(() => {
      expect(markPayrollItemPaid).toHaveBeenCalledWith(expect.objectContaining({
        periodId: "period-1",
        employeeId: "emp-1",
        amount: 1200000,
        method: "bank_transfer",
        referenceCode: "BANK-01",
        note: "Chuyển khoản",
      }));
      expect(onPaidSuccess).toHaveBeenCalled();
    });
  });

  it("hides mark paid form for locked periods", () => {
    renderModal({ payrollPayslip: { ...payslip, canMarkPaid: false, period: { ...payslip.period, status: "locked" } } });

    expect(screen.queryByText("Xác nhận thanh toán")).not.toBeInTheDocument();
  });
});
