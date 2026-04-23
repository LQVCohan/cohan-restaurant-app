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
  payrollSettings: {
    restaurantId: "restaurant-1",
    currentPayrollPeriodId: "period-1",
    standardWorkDaysPerMonth: 26,
    standardHoursPerDay: 8,
    overtimeMultiplierWeekday: 1.5,
    overtimeMultiplierWeekend: 2,
    overtimeMultiplierHoliday: 3,
    latenessPenaltyPerMinute: 0,
    earlyLeavePenaltyPerMinute: 0,
    unpaidLeaveDeductionPerDay: 0,
    defaultAllowance: 0,
    defaultBonus: 0,
    defaultDeduction: 0,
    allowPaidLeaveInWorkDays: true,
    notes: "",
    updatedAt: "2026-04-24T00:00:00.000Z",
  },
  settingsLoading: false,
  settingsError: null,
  loading: false,
  error: null,
  createPeriod: vi.fn(),
  recalculatePeriod: vi.fn(),
  finalizePeriod: vi.fn(),
  lockPeriod: vi.fn(),
  markPaid: vi.fn(),
  updateSettings: vi.fn().mockResolvedValue({ data: { updatePayrollSettings: { restaurantId: "restaurant-1" } } }),
  upsertAdjustment: vi.fn(),
  refetchDetail: vi.fn().mockResolvedValue({}),
  refetchSettings: vi.fn().mockResolvedValue({}),
  ...overrides,
});

describe("PayrollManagement settings modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the settings modal and keeps default form usable when settings are missing", async () => {
    usePayroll.mockReturnValue(
      buildHookValue({
        periods: [],
        currentPeriodId: null,
        periodDetail: null,
        payrollSettings: null,
      }),
    );

    render(<PayrollManagement />);

    fireEvent.click(screen.getByTestId("payroll-settings-open"));

    expect(screen.getByTestId("payroll-settings-modal")).toBeInTheDocument();
    expect(screen.getByText(/Chưa có cấu hình lương/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("26")).toBeInTheDocument();
  });

  it("loads persisted payroll settings into the modal", async () => {
    usePayroll.mockReturnValue(
      buildHookValue({
        payrollSettings: {
          restaurantId: "restaurant-1",
          standardWorkDaysPerMonth: 24,
          standardHoursPerDay: 7.5,
          overtimeMultiplierWeekday: 1.75,
          overtimeMultiplierWeekend: 2.25,
          overtimeMultiplierHoliday: 3,
          latenessPenaltyPerMinute: 10000,
          earlyLeavePenaltyPerMinute: 12000,
          unpaidLeaveDeductionPerDay: 300000,
          defaultAllowance: 500000,
          defaultBonus: 250000,
          defaultDeduction: 150000,
          allowPaidLeaveInWorkDays: false,
          notes: "Existing config",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      }),
    );

    render(<PayrollManagement />);

    fireEvent.click(screen.getByTestId("payroll-settings-open"));

    expect(screen.getByDisplayValue("24")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Existing config")).toBeInTheDocument();
  });

  it("does not close on inner clicks and closes correctly on overlay click", async () => {
    usePayroll.mockReturnValue(buildHookValue());

    render(<PayrollManagement />);

    fireEvent.click(screen.getByTestId("payroll-settings-open"));

    fireEvent.click(screen.getByDisplayValue("26"));
    expect(screen.getByTestId("payroll-settings-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("payroll-settings-modal"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("payroll-settings-modal"),
      ).not.toBeInTheDocument();
    });
  });

  it("closes the modal only after saving settings successfully", async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      data: { updatePayrollSettings: { restaurantId: "restaurant-1" } },
    });
    const refetchDetail = vi.fn().mockResolvedValue({});
    const refetchSettings = vi.fn().mockResolvedValue({});

    usePayroll.mockReturnValue(
      buildHookValue({
        updateSettings,
        refetchDetail,
        refetchSettings,
      }),
    );

    render(<PayrollManagement />);

    fireEvent.click(screen.getByTestId("payroll-settings-open"));
    fireEvent.click(screen.getByTestId("payroll-settings-save"));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        variables: {
          input: expect.objectContaining({
            restaurantId: "restaurant-1",
            standardWorkDaysPerMonth: 26,
          }),
        },
      });
    });

    await waitFor(() => {
      expect(refetchDetail).toHaveBeenCalled();
      expect(refetchSettings).toHaveBeenCalled();
      expect(
        screen.queryByTestId("payroll-settings-modal"),
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the modal open and shows the save error when updatePayrollSettings fails", async () => {
    const updateSettings = vi
      .fn()
      .mockRejectedValue(new Error("Không thể lưu cấu hình lương."));

    usePayroll.mockReturnValue(
      buildHookValue({
        updateSettings,
      }),
    );

    render(<PayrollManagement />);

    fireEvent.click(screen.getByTestId("payroll-settings-open"));
    fireEvent.click(screen.getByTestId("payroll-settings-save"));

    await waitFor(() => {
      expect(screen.getByTestId("payroll-settings-save-error")).toHaveTextContent(
        "Không thể lưu cấu hình lương.",
      );
    });

    expect(screen.getByTestId("payroll-settings-modal")).toBeInTheDocument();
  });
});

describe("PayrollManagement payroll period setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("blocks changing the applied payroll period until the current one is fully paid", async () => {
    const createPeriod = vi.fn();

    usePayroll.mockReturnValue(
      buildHookValue({
        createPeriod,
      }),
    );

    render(<PayrollManagement />);

    const dateInputs = screen.getAllByDisplayValue(/2026-04/);
    fireEvent.change(dateInputs[0], { target: { name: "start", value: "2026-05-01" } });
    fireEvent.change(dateInputs[1], { target: { name: "end", value: "2026-05-31" } });
    fireEvent.click(screen.getByTestId("payroll-period-setup"));

    expect(window.alert).toHaveBeenCalledWith(
      "Chi duoc doi ky luong sau khi ky dang ap dung da tinh xong va da xac nhan tra du.",
    );
    expect(createPeriod).not.toHaveBeenCalled();
  });

  it("allows setting a new applied payroll period after the current one is paid", async () => {
    const createPeriod = vi.fn().mockResolvedValue({
      data: { createPayrollPeriod: { id: "period-2" } },
    });
    const refetchSettings = vi.fn().mockResolvedValue({});

    usePayroll.mockReturnValue(
      buildHookValue({
        periods: [
          {
            id: "period-1",
            name: "Ky 1",
            restaurantId: "restaurant-1",
            startDate: "2026-04-01T00:00:00.000Z",
            endDate: "2026-04-30T00:00:00.000Z",
            status: "paid",
          },
        ],
        currentPeriodId: "period-1",
        periodDetail: {
          period: {
            id: "period-1",
            restaurantId: "restaurant-1",
            startDate: "2026-04-01T00:00:00.000Z",
            endDate: "2026-04-30T00:00:00.000Z",
            status: "paid",
          },
        },
        createPeriod,
        refetchSettings,
      }),
    );

    render(<PayrollManagement />);

    const dateInputs = screen.getAllByDisplayValue(/2026-04/);
    fireEvent.change(dateInputs[0], { target: { name: "start", value: "2026-05-01" } });
    fireEvent.change(dateInputs[1], { target: { name: "end", value: "2026-05-31" } });
    fireEvent.click(screen.getByTestId("payroll-period-setup"));

    await waitFor(() => {
      expect(createPeriod).toHaveBeenCalledWith({
        variables: {
          input: expect.objectContaining({
            startDate: "2026-05-01",
            endDate: "2026-05-31",
          }),
        },
      });
    });

    expect(refetchSettings).toHaveBeenCalled();
  });
});
