import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  markPayrollItemPaid: vi.fn().mockResolvedValue({}),
  batchMarkPayrollPaid: vi.fn().mockResolvedValue({ data: { batchMarkPayrollPaid: { successCount: 1, processingCount: 0, failedCount: 0, errors: [] } } }),
  createPayrollPayout: vi.fn().mockResolvedValue({ data: { createPayrollPayout: { id: "payout-1", status: "success" } } }),
  retryPayrollPayout: vi.fn().mockResolvedValue({ data: { retryPayrollPayout: { id: "payout-1", status: "success" } } }),
  cancelPayrollPayout: vi.fn().mockResolvedValue({ data: { cancelPayrollPayout: { id: "payout-1", status: "cancelled" } } }),
  upsertEmployeeBankAccount: vi.fn().mockResolvedValue({}),
  verifyEmployeeBankAccount: vi.fn().mockResolvedValue({}),
  upsertRestaurantPayoutAccount: vi.fn().mockResolvedValue({}),
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
            restaurantId: "restaurant-1",
            startDate: "2026-05-01",
            endDate: "2026-05-31",
          }),
        },
      });
    });

    expect(refetchSettings).toHaveBeenCalled();
  });
});

describe("PayrollManagement payroll payment UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    global.URL.createObjectURL = vi.fn(() => "blob:payroll");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const finalizedPayrollItems = [
    {
      id: "emp-1",
      name: "Nguyen A",
      code: "NV001",
      department: "Kitchen",
      role: "Chef",
      baseSalary: 6000000,
      actualWorkDays: 24,
      workDays: 26,
      totalHours: 192,
      overtime: 300000,
      totalIncome: 6500000,
      totalDeduction: 1000000,
      netSalary: 5500000,
      status: "finalized",
    },
    {
      id: "emp-2",
      name: "Tran B",
      code: "NV002",
      department: "Service",
      baseSalary: 5000000,
      actualWorkDays: 25,
      workDays: 26,
      totalHours: 200,
      overtime: 0,
      totalIncome: 5000000,
      totalDeduction: 500000,
      netSalary: 4500000,
      status: "finalized",
    },
  ];

  const buildFinalizedHookValue = (overrides = {}) =>
    buildHookValue({
      periods: [{ id: "period-1", name: "Ky 1", status: "finalized", startDate: "2026-04-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" }],
      periodDetail: { period: { id: "period-1", name: "Ky 1", status: "finalized", startDate: "2026-04-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" } },
      payrollItems: finalizedPayrollItems,
      payrollPayslip: {
        remainingAmount: 1500000,
        canMarkPaid: true,
        period: { id: "period-1", name: "Ky 1", status: "finalized", startDate: "2026-04-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" },
        employee: { id: "emp-1", name: "Nguyen A", code: "NV001", department: "Kitchen", role: "Chef" },
        item: { netSalary: 5500000, status: "finalized" },
        breakdown: { netSalary: 5500000, baseSalary: 6000000 },
      },
      payrollPayments: [{ id: "pay-1", employeeId: "emp-1", amount: 4000000, method: "cash", paidAt: "2026-05-01T00:00:00.000Z", note: "Đợt 1", referenceCode: "REF-1" }],
      refetchPayrollPayslip: vi.fn().mockResolvedValue({}),
      refetchPayrollPayments: vi.fn().mockResolvedValue({}),
      refetchPayrollPeriodDetail: vi.fn().mockResolvedValue({}),
      refetchPayrollPeriods: vi.fn().mockResolvedValue({}),
      markPayrollItemPaid: vi.fn().mockResolvedValue({}),
      batchMarkPayrollPaid: vi.fn().mockResolvedValue({ data: { batchMarkPayrollPaid: { successCount: 2, failedCount: 0, errors: [] } } }),
      refetchPayrollExportRows: vi.fn().mockResolvedValue({ data: { payrollExportRows: [{ employeeCode: "NV001", employeeName: "Nguyen A", status: "finalized" }] } }),
      ...overrides,
    });

  it("renders payslip action and opens the payslip modal", async () => {
    usePayroll.mockReturnValue(buildFinalizedHookValue());

    render(<PayrollManagement />);

    expect(screen.getAllByText("Xem phiếu lương")).toHaveLength(2);
    fireEvent.click(screen.getAllByText("Xem phiếu lương")[0]);

    await waitFor(() => {
      expect(screen.getByTestId("payroll-payslip-modal")).toBeInTheDocument();
      expect(screen.getByText("REF-1")).toBeInTheDocument();
    });
  });

  it("calls batch mark paid with selected employee ids", async () => {
    const batchMarkPayrollPaid = vi.fn().mockResolvedValue({ data: { batchMarkPayrollPaid: { successCount: 2, failedCount: 0, errors: [] } } });
    usePayroll.mockReturnValue(buildFinalizedHookValue({ batchMarkPayrollPaid }));

    render(<PayrollManagement />);

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getAllByRole("checkbox")[2]);
    fireEvent.click(screen.getByTestId("batch-payroll-paid-open"));
    fireEvent.click(screen.getByTestId("batch-payroll-paid-submit"));

    await waitFor(() => {
      expect(batchMarkPayrollPaid).toHaveBeenCalledWith(expect.objectContaining({
        periodId: "period-1",
        employeeIds: ["emp-1", "emp-2"],
        method: "cash",
      }));
    });
  });

  it("shows partial batch failure errors", async () => {
    usePayroll.mockReturnValue(buildFinalizedHookValue({
      batchMarkPayrollPaid: vi.fn().mockResolvedValue({ data: { batchMarkPayrollPaid: { successCount: 1, failedCount: 1, errors: [{ employeeId: "emp-2", code: "PAYROLL_PAYMENT_OVERPAY", message: "Overpay" }] } } }),
    }));

    render(<PayrollManagement />);

    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByTestId("batch-payroll-paid-open"));
    fireEvent.click(screen.getByTestId("batch-payroll-paid-submit"));

    expect(await screen.findByText(/PAYROLL_PAYMENT_OVERPAY/)).toBeInTheDocument();
  });

  it("exports CSV from payrollExportRows", async () => {
    const linkClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") element.click = linkClick;
      return element;
    });
    const refetchPayrollExportRows = vi.fn().mockResolvedValue({ data: { payrollExportRows: [{ employeeCode: "NV001", employeeName: "Nguyen, A", status: "finalized" }] } });
    usePayroll.mockReturnValue(buildFinalizedHookValue({ refetchPayrollExportRows }));

    render(<PayrollManagement />);

    fireEvent.click(screen.getByText("Xuất CSV"));

    await waitFor(() => {
      expect(refetchPayrollExportRows).toHaveBeenCalledWith({ periodId: "period-1" });
      expect(linkClick).toHaveBeenCalled();
    });
  });

  it("disables payment actions for locked periods", () => {
    usePayroll.mockReturnValue(buildFinalizedHookValue({
      periods: [{ id: "period-1", name: "Ky 1", status: "locked", startDate: "2026-04-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" }],
      periodDetail: { period: { id: "period-1", name: "Ky 1", status: "locked", startDate: "2026-04-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" } },
    }));

    render(<PayrollManagement />);

    expect(screen.getByTestId("batch-payroll-paid-open")).toBeDisabled();
    expect(screen.getAllByRole("checkbox")[1]).toBeDisabled();
  });
});

describe("PayrollManagement UC17 payout and lifecycle coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:payroll");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const payrollItemWithStatus = (status, overrides = {}) => ({
    id: `emp-${status}`,
    name: `Nhan vien ${status}`,
    code: `NV-${status}`,
    department: "Kitchen",
    role: "Chef",
    baseSalary: 6000000,
    actualWorkDays: 24,
    workDays: 26,
    totalHours: 192,
    overtime: 0,
    totalIncome: 6000000,
    totalDeduction: 500000,
    netSalary: 5500000,
    paidAmount: status === "paid" || status === "locked" ? 5500000 : 1000000,
    remainingAmount: status === "paid" || status === "locked" ? 0 : 4500000,
    status,
    ...overrides,
  });

  const hookForPeriodStatus = (status, overrides = {}) => buildHookValue({
    periods: [{ id: "period-1", name: "Ky 1", restaurantId: "restaurant-1", status, startDate: "2026-04-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" }],
    periodDetail: { period: { id: "period-1", name: "Ky 1", restaurantId: "restaurant-1", status, startDate: "2026-04-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" } },
    payrollStats: { totalPayroll: 5500000, paidAmount: status === "paid" ? 5500000 : 1000000, remaining: status === "paid" ? 0 : 4500000, progress: status === "paid" ? 100 : 18 },
    payrollItems: [payrollItemWithStatus(status === "paid" ? "paid" : status === "locked" ? "locked" : "pending_payment")],
    ...overrides,
  });

  it("renders period/item lifecycle statuses and paid/remaining columns", () => {
    usePayroll.mockReturnValue(hookForPeriodStatus("paying", {
      payrollItems: [
        payrollItemWithStatus("pending_payment"),
        payrollItemWithStatus("processing_payment"),
        payrollItemWithStatus("payment_failed"),
        payrollItemWithStatus("paid"),
        payrollItemWithStatus("locked"),
      ],
    }));

    render(<PayrollManagement />);

    expect(screen.getByText("Đang chi trả")).toBeInTheDocument();
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(screen.getByText("Đang xử lý")).toBeInTheDocument();
    expect(screen.getByText("Thanh toán lỗi")).toBeInTheDocument();
    expect(screen.getAllByText("Đã thanh toán").length).toBeGreaterThan(0);
    expect(screen.getByText("Đã khóa")).toBeInTheDocument();
    expect(screen.getAllByText(/1.000.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/4.500.000/).length).toBeGreaterThan(0);
  });

  it.each([
    ["draft", { payDisabled: true, payoutVisible: false, lockDisabled: true }],
    ["finalized", { payDisabled: false, payoutVisible: true, lockDisabled: true }],
    ["paying", { payDisabled: false, payoutVisible: true, lockDisabled: true }],
    ["paid", { payDisabled: true, payoutVisible: false, lockDisabled: false }],
    ["locked", { payDisabled: true, payoutVisible: false, lockDisabled: true }],
  ])("enables actions according to period status %s", (status, expected) => {
    usePayroll.mockReturnValue(hookForPeriodStatus(status));

    render(<PayrollManagement />);

    expect(screen.getAllByRole("checkbox")[1].disabled).toBe(expected.payDisabled);
    expect(screen.getByTestId("full-period-payroll-paid-open").disabled).toBe(expected.payDisabled);
    expect(screen.getByText("Khóa kỳ").disabled).toBe(expected.lockDisabled);
    if (expected.payoutVisible) expect(screen.getByText("Tạo payout")).toBeInTheDocument();
    else expect(screen.queryByText("Tạo payout")).not.toBeInTheDocument();
  });

  it("submits full-period payment with backend batch result including processingCount", async () => {
    const batchMarkPayrollPaid = vi.fn().mockResolvedValue({
      data: { batchMarkPayrollPaid: { successCount: 1, processingCount: 2, failedCount: 1, errors: [{ employeeId: "emp-2", code: "EMPLOYEE_BANK_ACCOUNT_NOT_VERIFIED", message: "Need verified bank" }] } },
    });
    usePayroll.mockReturnValue(hookForPeriodStatus("finalized", { batchMarkPayrollPaid }));

    render(<PayrollManagement />);
    fireEvent.click(screen.getByText("Thanh toán toàn bộ kỳ"));
    fireEvent.click(screen.getByTestId("batch-payroll-paid-submit"));

    await waitFor(() => expect(batchMarkPayrollPaid).toHaveBeenCalledWith(expect.objectContaining({ employeeIds: [] })));
    expect(screen.getByTestId("batch-payroll-paid-result")).toHaveTextContent("Thành công: 1");
    expect(screen.getByTestId("batch-payroll-paid-result")).toHaveTextContent("Đang xử lý: 2");
    expect(screen.getByTestId("batch-payroll-paid-result")).toHaveTextContent("Lỗi: 1");
    expect(screen.getByText(/EMPLOYEE_BANK_ACCOUNT_NOT_VERIFIED/)).toBeInTheDocument();
  });

  it("opens bank account/source account modals and does not render raw account after save", async () => {
    const upsertEmployeeBankAccount = vi.fn().mockResolvedValue({ data: { upsertEmployeeBankAccount: { accountNumberMasked: "****6789" } } });
    const verifyEmployeeBankAccount = vi.fn().mockResolvedValue({});
    const upsertRestaurantPayoutAccount = vi.fn().mockResolvedValue({ data: { upsertRestaurantPayoutAccount: { accountNumberMasked: "****2222" } } });
    usePayroll.mockReturnValue(hookForPeriodStatus("finalized", { upsertEmployeeBankAccount, verifyEmployeeBankAccount, upsertRestaurantPayoutAccount }));

    render(<PayrollManagement />);
    fireEvent.click(screen.getByText("Tài khoản NH"));
    expect(screen.getByTestId("employee-bank-account-modal")).toBeInTheDocument();
    fireEvent.change(screen.getByText("Số tài khoản").parentElement.querySelector("input"), { target: { value: "123456789" } });
    fireEvent.click(screen.getByText("Lưu & xác minh"));
    await waitFor(() => expect(upsertEmployeeBankAccount).toHaveBeenCalledWith(expect.objectContaining({ accountNumber: "123456789" })));
    expect(verifyEmployeeBankAccount).toHaveBeenCalledWith(expect.objectContaining({ verificationStatus: "verified" }));
    await waitFor(() => expect(screen.queryByTestId("employee-bank-account-modal")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("123456789")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("🏦 Tài khoản nguồn"));
    expect(screen.getByTestId("restaurant-payout-account-modal")).toBeInTheDocument();
    const accountInputs = screen.getByTestId("restaurant-payout-account-modal").querySelectorAll("input");
    fireEvent.change(accountInputs[3], { target: { value: "9999000011112222" } });
    fireEvent.click(screen.getByText("Lưu tài khoản nguồn"));
    await waitFor(() => expect(upsertRestaurantPayoutAccount).toHaveBeenCalledWith(expect.objectContaining({ accountNumber: "9999000011112222", payoutEnabled: true })));
    await waitFor(() => expect(screen.queryByTestId("restaurant-payout-account-modal")).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue("9999000011112222")).not.toBeInTheDocument();
  });

  it("creates payout, displays processing/failed states, and supports retry/cancel controls", async () => {
    const createPayrollPayout = vi.fn().mockResolvedValueOnce({ data: { createPayrollPayout: { id: "payout-1", status: "processing", failureReason: "" } } })
      .mockResolvedValueOnce({ data: { createPayrollPayout: { id: "payout-2", status: "failed", failureReason: "Mock payout failed" } } });
    const retryPayrollPayout = vi.fn().mockResolvedValue({ data: { retryPayrollPayout: { id: "payout-2", status: "success" } } });
    const cancelPayrollPayout = vi.fn().mockResolvedValue({ data: { cancelPayrollPayout: { id: "payout-1", status: "cancelled" } } });
    usePayroll.mockReturnValue(hookForPeriodStatus("finalized", { createPayrollPayout, retryPayrollPayout, cancelPayrollPayout }));

    render(<PayrollManagement />);
    fireEvent.click(screen.getByText("Tạo payout"));
    fireEvent.click(screen.getByText("Xác nhận payout"));
    await waitFor(() => expect(createPayrollPayout).toHaveBeenCalled());
    expect(screen.getByText(/Trạng thái payout:/)).toHaveTextContent("processing");
    fireEvent.click(screen.getByText("Hủy payout"));
    await waitFor(() => expect(cancelPayrollPayout).toHaveBeenCalledWith(expect.objectContaining({ payoutId: "payout-1", reason: "Hủy theo yêu cầu" })));

    fireEvent.click(screen.getByText("Xác nhận payout"));
    await waitFor(() => expect(screen.getByText(/Trạng thái payout:/)).toHaveTextContent("failed"));
    fireEvent.click(screen.getByText("Retry payout"));
    await waitFor(() => expect(retryPayrollPayout).toHaveBeenCalledWith(expect.objectContaining({ payoutId: "payout-2" })));
  });

  it("disables payout action for unverified bank accounts and shows provider-not-configured error", async () => {
    const createPayrollPayout = vi.fn().mockRejectedValue(new Error("PAYROLL_PAYOUT_PROVIDER_NOT_CONFIGURED"));
    usePayroll.mockReturnValue(hookForPeriodStatus("finalized", {
      createPayrollPayout,
      payrollItems: [payrollItemWithStatus("pending_payment", { bankAccountVerificationStatus: "pending" })],
    }));

    const { rerender } = render(<PayrollManagement />);
    expect(screen.getByText("Tạo payout")).toBeDisabled();

    usePayroll.mockReturnValue(hookForPeriodStatus("finalized", { createPayrollPayout }));
    rerender(<PayrollManagement />);
    fireEvent.click(screen.getByText("Tạo payout"));
    fireEvent.click(screen.getByText("Xác nhận payout"));
    expect(await screen.findByText(/Nhà cung cấp payout\/chuyển khoản chưa được cấu hình/)).toBeInTheDocument();
  });

  it("renders row-level retry/cancel payout actions from latest payout status", async () => {
    const retryPayrollPayout = vi.fn().mockResolvedValue({ data: { retryPayrollPayout: { id: "payout-failed", status: "success" } } });
    const cancelPayrollPayout = vi.fn().mockResolvedValue({ data: { cancelPayrollPayout: { id: "payout-processing", status: "cancelled" } } });
    usePayroll.mockReturnValue(hookForPeriodStatus("finalized", {
      retryPayrollPayout,
      cancelPayrollPayout,
      payrollItems: [
        payrollItemWithStatus("payment_failed", { id: "emp-failed", latestPayout: { id: "payout-failed", status: "failed" } }),
        payrollItemWithStatus("processing_payment", { id: "emp-processing", latestPayout: { id: "payout-processing", status: "processing" } }),
        payrollItemWithStatus("paid", { id: "emp-success", latestPayout: { id: "payout-success", status: "success" } }),
      ],
    }));

    render(<PayrollManagement />);
    fireEvent.click(screen.getByText("Retry payout"));
    fireEvent.click(screen.getByText("Hủy payout"));

    await waitFor(() => expect(retryPayrollPayout).toHaveBeenCalledWith(expect.objectContaining({ payoutId: "payout-failed" })));
    await waitFor(() => expect(cancelPayrollPayout).toHaveBeenCalledWith(expect.objectContaining({ payoutId: "payout-processing" })));
    expect(screen.queryByText("payout-success")).not.toBeInTheDocument();
  });
});
