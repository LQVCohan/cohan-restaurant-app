import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PayrollManagementWithReadiness from "./PayrollManagementWithReadiness";
import usePayroll from "@/hooks/usePayroll";

vi.mock("@/hooks/usePayroll", () => ({
  default: vi.fn(),
}));

vi.mock("./PayrollManagement.jsx", () => ({
  default: () => (
    <div className="payroll-page-compact">
      <button type="button">Chốt kỳ</button>
    </div>
  ),
}));

const readyReadiness = {
  periodId: "period-1",
  restaurantId: "restaurant-1",
  status: "draft",
  readyToFinalize: true,
  blockingCount: 0,
  warningCount: 0,
  sections: {
    schedule: { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] },
    attendance: { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] },
    approvals: { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] },
    payroll: { status: "ready", blockingCount: 0, warningCount: 0, metrics: {}, issues: [] },
  },
  issues: [],
};

const blockedReadiness = {
  ...readyReadiness,
  readyToFinalize: false,
  blockingCount: 1,
  sections: {
    ...readyReadiness.sections,
    approvals: {
      status: "blocked",
      blockingCount: 1,
      warningCount: 0,
      metrics: {},
      issues: [
        {
          code: "OFF_SCHEDULE_ATTENDANCE_PENDING",
          severity: "error",
          message: "Còn công ngoài lịch chưa được duyệt.",
          suggestedAction: "Duyệt hoặc từ chối công ngoài lịch trước khi chốt lương.",
          targetRoute: "off_schedule",
        },
      ],
    },
  },
};

const buildHookValue = (overrides = {}) => ({
  currentPeriodId: "period-1",
  payrollReadiness: readyReadiness,
  readinessLoading: false,
  readinessError: null,
  refetchPayrollReadiness: vi.fn().mockResolvedValue({ data: { payrollReadiness: readyReadiness } }),
  refetchValidation: vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe("PayrollManagementWithReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the readiness panel and refreshes readiness when clicking check", async () => {
    const refetchPayrollReadiness = vi.fn().mockResolvedValue({ data: { payrollReadiness: readyReadiness } });
    const refetchValidation = vi.fn().mockResolvedValue({});
    usePayroll.mockReturnValue(buildHookValue({ refetchPayrollReadiness, refetchValidation }));

    render(<PayrollManagementWithReadiness />);

    fireEvent.click(screen.getByText("Kiểm tra trước khi chốt"));

    expect(screen.getByText("Sẵn sàng chốt lương")).toBeInTheDocument();
    await waitFor(() => {
      expect(refetchPayrollReadiness).toHaveBeenCalledTimes(1);
      expect(refetchValidation).toHaveBeenCalledTimes(1);
    });
  });

  it("shows blocked hint and disables finalize button when readiness is blocked", () => {
    usePayroll.mockReturnValue(buildHookValue({ payrollReadiness: blockedReadiness }));

    render(<PayrollManagementWithReadiness />);

    expect(screen.getByText("Chưa sẵn sàng chốt lương")).toBeInTheDocument();
    expect(screen.getByText("Kỳ lương chưa sẵn sàng chốt. Vui lòng xử lý các lỗi trong bảng kiểm tra.")).toBeInTheDocument();
    expect(screen.getByText("Chốt kỳ")).toBeDisabled();
  });
});
