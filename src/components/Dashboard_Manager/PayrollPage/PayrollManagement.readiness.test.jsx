import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PayrollManagement from "./PayrollManagement";
import usePayroll from "@/hooks/usePayroll";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useLocation: () => ({ search: "" }),
  };
});

vi.mock("@/hooks/usePayroll", () => ({
  default: vi.fn(),
}));

vi.mock("@/hooks/useManagerRestaurantSelection", () => ({
  default: () => ({
    restaurantOptions: [{ id: "restaurant-1", name: "Cohan" }],
    selectedRestaurantId: "restaurant-1",
    setSelectedRestaurantId: vi.fn(),
    selectedRestaurant: { id: "restaurant-1", name: "Cohan" },
    restaurantsLoading: false,
    hasRestaurants: true,
  }),
}));

const emptySection = {
  status: "ready",
  blockingCount: 0,
  warningCount: 0,
  metrics: {},
  issues: [],
};

const readyReadiness = {
  periodId: "period-1",
  restaurantId: "restaurant-1",
  status: "draft",
  readyToFinalize: true,
  blockingCount: 0,
  warningCount: 0,
  sections: {
    schedule: emptySection,
    attendance: emptySection,
    approvals: emptySection,
    payroll: emptySection,
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
          targetRoute: "off_schedule",
        },
      ],
    },
  },
  issues: [],
};

const buildHookValue = (overrides = {}) => ({
  periods: [
    {
      id: "period-1",
      name: "Ky 1",
      restaurantId: "restaurant-1",
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2026-04-30T00:00:00.000Z",
      status: "draft",
    },
    {
      id: "period-2",
      name: "Ky 2",
      restaurantId: "restaurant-1",
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-31T00:00:00.000Z",
      status: "draft",
    },
  ],
  currentPeriodId: "period-1",
  periodDetail: {
    period: {
      id: "period-1",
      restaurantId: "restaurant-1",
      startDate: "2026-04-01T00:00:00.000Z",
      endDate: "2026-04-30T00:00:00.000Z",
      status: "draft",
    },
  },
  payrollItems: [],
  payrollStats: null,
  payrollSettings: { restaurantId: "restaurant-1", currentPayrollPeriodId: "period-1" },
  settingsLoading: false,
  settingsError: null,
  loading: false,
  error: null,
  createPeriod: vi.fn(),
  recalculatePeriod: vi.fn(),
  finalizePeriod: vi.fn().mockResolvedValue({}),
  lockPeriod: vi.fn(),
  markPayrollItemPaid: vi.fn(),
  batchMarkPayrollPaid: vi.fn(),
  payrollPayslip: null,
  payrollPayments: [],
  refetchPayrollPayslip: vi.fn().mockResolvedValue({}),
  refetchPayrollPayments: vi.fn().mockResolvedValue({}),
  refetchPayrollExportRows: vi.fn().mockResolvedValue({ data: { payrollExportRows: [] } }),
  updateSettings: vi.fn(),
  upsertAdjustment: vi.fn(),
  validationResult: { errorCount: 0, warningCount: 0, issues: [] },
  payrollReadiness: readyReadiness,
  readinessLoading: false,
  readinessError: null,
  refetchValidation: vi.fn().mockResolvedValue({}),
  refetchPayrollReadiness: vi.fn().mockResolvedValue({ data: { payrollReadiness: readyReadiness } }),
  refetchDetail: vi.fn().mockResolvedValue({}),
  refetchPayrollPeriodDetail: vi.fn().mockResolvedValue({}),
  refetchPeriods: vi.fn().mockResolvedValue({}),
  refetchPayrollPeriods: vi.fn().mockResolvedValue({}),
  refetchSettings: vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe("PayrollManagement readiness panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("opens readiness panel and refetches readiness plus validation", async () => {
    const refetchPayrollReadiness = vi.fn().mockResolvedValue({ data: { payrollReadiness: readyReadiness } });
    const refetchValidation = vi.fn().mockResolvedValue({});
    usePayroll.mockReturnValue(buildHookValue({ refetchPayrollReadiness, refetchValidation }));

    render(<PayrollManagement />);

    fireEvent.click(screen.getByText("Kiểm tra trước khi chốt"));

    expect(screen.getByText("Sẵn sàng chốt lương")).toBeInTheDocument();
    await waitFor(() => {
      expect(refetchPayrollReadiness).toHaveBeenCalledTimes(1);
      expect(refetchValidation).toHaveBeenCalledTimes(1);
    });
  });

  it("disables finalize with React state when readiness is blocked", () => {
    usePayroll.mockReturnValue(
      buildHookValue({ payrollReadiness: blockedReadiness }),
    );

    render(<PayrollManagement />);

    expect(screen.getByText("Kỳ lương chưa sẵn sàng chốt. Vui lòng xử lý các lỗi trong bảng kiểm tra.")).toBeInTheDocument();
    expect(screen.getByText("Chốt kỳ")).toBeDisabled();
  });

  it("dispatches manager:navigate and skips alert for non-payroll readiness issue", () => {
    usePayroll.mockReturnValue(buildHookValue({ payrollReadiness: blockedReadiness }));
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<PayrollManagement />);
    fireEvent.click(screen.getByText("Kiểm tra trước khi chốt"));

    fireEvent.click(screen.getByText("Duyệt công ngoài lịch"));

    const navCall = dispatchSpy.mock.calls.find(([arg]) => arg?.type === "manager:navigate");
    expect(navCall).toBeTruthy();
    expect(navCall[0].detail).toMatchObject({
      page: "staff",
      query: {
        staffPage: "attendance",
        attendanceTab: "off_schedule",
        offScheduleStatus: "pending",
      },
    });
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("finalizes the currently selected period rather than the current applied period", async () => {
    const finalizePeriod = vi.fn().mockResolvedValue({});
    usePayroll.mockReturnValue(
      buildHookValue({
        finalizePeriod,
        periods: [
          {
            id: "period-1",
            name: "Ky 1",
            restaurantId: "restaurant-1",
            startDate: "2026-04-01T00:00:00.000Z",
            endDate: "2026-04-30T00:00:00.000Z",
            status: "paid",
          },
          {
            id: "period-2",
            name: "Ky 2",
            restaurantId: "restaurant-1",
            startDate: "2026-05-01T00:00:00.000Z",
            endDate: "2026-05-31T00:00:00.000Z",
            status: "draft",
          },
        ],
      }),
    );

    render(<PayrollManagement />);

    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "period-2" } });
    fireEvent.click(screen.getByText("Chốt kỳ"));

    await waitFor(() => {
      expect(finalizePeriod).toHaveBeenCalledWith({
        variables: { periodId: "period-2" },
      });
    });
  });
});
