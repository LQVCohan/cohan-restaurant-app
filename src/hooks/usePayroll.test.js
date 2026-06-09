import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import usePayroll, {
  MUT_APPLY_PAYROLL_PAYOUT_RESULT,
  MUT_BATCH_MARK_PAYROLL_PAID,
  MUT_CANCEL_PAYROLL_PAYOUT,
  MUT_CREATE_PAYROLL_BATCH_PAYOUT,
  MUT_CREATE_PAYROLL_PAYOUT,
  MUT_FINALIZE_PERIOD,
  MUT_MARK_PAYROLL_ITEM_PAID,
  MUT_RETRY_PAYROLL_PAYOUT,
  QUERY_PAYROLL_EXPORT_ROWS,
  QUERY_PAYROLL_PAYMENTS,
  QUERY_PAYROLL_PAYSLIP,
  QUERY_PAYROLL_PERIOD_DETAIL,
  QUERY_PAYROLL_PERIODS,
  QUERY_PAYROLL_READINESS,
} from "./usePayroll";
import { getPayrollActionErrorMessage } from "@/utils/payrollPerformanceErrorMessages";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: vi.fn(),
    useQuery: vi.fn(),
  };
});

const queryResult = (data = {}, extra = {}) => ({
  data,
  loading: false,
  error: null,
  refetch: vi.fn().mockResolvedValue({ data }),
  ...extra,
});

const buildPayrollItem = (status = "finalized") => ({
  id: `emp-${status}`,
  payrollItemId: `item-${status}`,
  name: "Nguyen A",
  status,
  netSalary: 1000,
  paidAmount: status === "paid" || status === "locked" ? 1000 : 0,
  remainingAmount: status === "paid" || status === "locked" ? 0 : 1000,
});

const setupHookMocks = ({ periodStatus = "finalized", stats, readinessReady = true } = {}) => {
  const period = {
    id: "period-1",
    restaurantId: "restaurant-1",
    status: periodStatus,
    stats: stats || { totalPayroll: 1000, paidAmount: periodStatus === "paid" ? 1000 : 0, remaining: periodStatus === "paid" ? 0 : 1000, progress: periodStatus === "paid" ? 100 : 0 },
  };
  const refetchPayrollReadiness = vi.fn().mockResolvedValue({ data: { payrollReadiness: { periodId: "period-1", readyToFinalize: readinessReady } } });

  useQuery.mockImplementation((query, options = {}) => {
    if (query === QUERY_PAYROLL_PERIODS) return queryResult({ payrollPeriods: [period] });
    if (query === QUERY_PAYROLL_PERIOD_DETAIL) return queryResult({ payrollPeriodDetail: { period, items: [buildPayrollItem(periodStatus)] } });
    if (query === QUERY_PAYROLL_READINESS) return queryResult({ payrollReadiness: { periodId: "period-1", readyToFinalize: readinessReady, sections: {}, issues: [] } }, { refetch: refetchPayrollReadiness });
    if (query === QUERY_PAYROLL_PAYSLIP) return queryResult({ payrollPayslip: { remainingAmount: period.stats.remaining } });
    if (query === QUERY_PAYROLL_PAYMENTS) return queryResult({ payrollPayments: [{ id: "payment-1" }] });
    if (query === QUERY_PAYROLL_EXPORT_ROWS) return queryResult({ payrollExportRows: [{ employeeCode: "NV001" }] });
    if (options?.variables?.periodId) return queryResult({});
    return queryResult({ payrollSettings: { currentPayrollPeriodId: "period-1", restaurantId: "restaurant-1" }, me: { restaurantForStaff: "restaurant-1" }, staffPayrollOverview: { stats: null, items: [] } });
  });

  const mutations = {
    finalizePeriodMutation: vi.fn().mockResolvedValue({ data: { finalizePayrollPeriod: { id: "period-1", status: "finalized" } } }),
    markPayrollItemPaidMutation: vi.fn().mockResolvedValue({ data: { markPayrollItemPaid: { id: "emp-1" } } }),
    batchMarkPayrollPaidMutation: vi.fn().mockResolvedValue({ data: { batchMarkPayrollPaid: { successCount: 1, failedCount: 0, errors: [] } } }),
    createPayrollPayoutMutation: vi.fn().mockResolvedValue({ data: { createPayrollPayout: { id: "payout-1", status: "processing" } } }),
    createPayrollBatchPayoutMutation: vi.fn().mockResolvedValue({ data: { createPayrollBatchPayout: { successCount: 1, processingCount: 2, failedCount: 1, errors: [] } } }),
    retryPayrollPayoutMutation: vi.fn().mockResolvedValue({ data: { retryPayrollPayout: { id: "payout-1", status: "success" } } }),
    cancelPayrollPayoutMutation: vi.fn().mockResolvedValue({ data: { cancelPayrollPayout: { id: "payout-1", status: "cancelled" } } }),
    applyPayrollPayoutResultMutation: vi.fn().mockResolvedValue({ data: { applyPayrollPayoutResult: { id: "payout-1", status: "success" } } }),
  };
  const noopMutation = vi.fn().mockResolvedValue({});
  const mutationMap = new Map([
    [MUT_FINALIZE_PERIOD, mutations.finalizePeriodMutation],
    [MUT_MARK_PAYROLL_ITEM_PAID, mutations.markPayrollItemPaidMutation],
    [MUT_BATCH_MARK_PAYROLL_PAID, mutations.batchMarkPayrollPaidMutation],
    [MUT_CREATE_PAYROLL_PAYOUT, mutations.createPayrollPayoutMutation],
    [MUT_CREATE_PAYROLL_BATCH_PAYOUT, mutations.createPayrollBatchPayoutMutation],
    [MUT_RETRY_PAYROLL_PAYOUT, mutations.retryPayrollPayoutMutation],
    [MUT_CANCEL_PAYROLL_PAYOUT, mutations.cancelPayrollPayoutMutation],
    [MUT_APPLY_PAYROLL_PAYOUT_RESULT, mutations.applyPayrollPayoutResultMutation],
  ]);
  useMutation.mockImplementation((mutation) => [mutationMap.get(mutation) || noopMutation]);
  return { period, refetchPayrollReadiness, mutations };
};

describe("usePayroll payment and payout APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires core payroll queries and exposes payslip/payment/export/readiness aliases", () => {
    const { refetchPayrollReadiness } = setupHookMocks();
    const { result } = renderHook(() => usePayroll({ restaurantId: "restaurant-1", periodId: "period-1" }));

    expect(useQuery).toHaveBeenCalledWith(QUERY_PAYROLL_PERIODS, expect.objectContaining({ variables: expect.objectContaining({ restaurantId: "restaurant-1" }) }));
    expect(useQuery).toHaveBeenCalledWith(QUERY_PAYROLL_PERIOD_DETAIL, expect.objectContaining({ variables: { periodId: "period-1" }, skip: false }));
    expect(useQuery).toHaveBeenCalledWith(QUERY_PAYROLL_READINESS, expect.objectContaining({ variables: { periodId: "period-1" }, skip: false, fetchPolicy: "network-only" }));
    expect(result.current.payrollReadiness).toEqual(expect.objectContaining({ periodId: "period-1", readyToFinalize: true }));
    expect(result.current.refetchPayrollReadiness).toBe(refetchPayrollReadiness);
    expect(result.current.refetchReadiness).toBe(refetchPayrollReadiness);
    expect(result.current.payrollPayslip).toEqual({ remainingAmount: 1000 });
    expect(result.current.payrollPayments).toEqual([{ id: "payment-1" }]);
    expect(result.current.payrollExportRows).toEqual([{ employeeCode: "NV001" }]);
  });

  it("passes payoutId/idempotencyKey through markPayrollItemPaid and exposes payout mutations", async () => {
    const { mutations } = setupHookMocks();
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));

    await result.current.markPayrollItemPaid({ periodId: "period-1", employeeId: "emp-1", amount: 1000, payoutId: "payout-1", idempotencyKey: "pay-key" });
    await result.current.createPayrollPayout({ periodId: "period-1", employeeId: "emp-1", idempotencyKey: "payout-key" });
    await result.current.createPayrollBatchPayout({ periodId: "period-1", employeeIds: ["emp-1"], idempotencyKey: "batch-key" });
    await result.current.retryPayrollPayout({ payoutId: "payout-1", idempotencyKey: "retry-key" });
    await result.current.cancelPayrollPayout({ payoutId: "payout-1", reason: "duplicate" });
    await result.current.applyPayrollPayoutResult({ payoutId: "payout-1", status: "success" });

    expect(mutations.markPayrollItemPaidMutation).toHaveBeenCalledWith({ variables: { input: expect.objectContaining({ payoutId: "payout-1", idempotencyKey: "pay-key" }) } });
    expect(mutations.createPayrollPayoutMutation).toHaveBeenCalledWith({ variables: { input: expect.objectContaining({ idempotencyKey: "payout-key" }) } });
    expect(mutations.createPayrollBatchPayoutMutation).toHaveBeenCalledWith({ variables: { input: expect.objectContaining({ idempotencyKey: "batch-key" }) } });
    expect(mutations.retryPayrollPayoutMutation).toHaveBeenCalledWith({ variables: { payoutId: "payout-1", idempotencyKey: "retry-key" } });
    expect(mutations.cancelPayrollPayoutMutation).toHaveBeenCalledWith({ variables: { payoutId: "payout-1", reason: "duplicate" } });
    expect(mutations.applyPayrollPayoutResultMutation).toHaveBeenCalledWith({ variables: { input: { payoutId: "payout-1", status: "success" } } });
  });

  it("preserves processingCount in batch payout responses instead of folding it into success", async () => {
    const { mutations } = setupHookMocks();
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));

    const response = await result.current.createPayrollBatchPayout({ periodId: "period-1", employeeIds: ["emp-1"], idempotencyKey: "batch-key" });

    expect(response.data.createPayrollBatchPayout).toEqual(expect.objectContaining({ successCount: 1, processingCount: 2, failedCount: 1 }));
    expect(mutations.createPayrollBatchPayoutMutation).toHaveBeenCalledTimes(1);
  });

  it("refetches readiness for the requested selected period before finalizing payroll", async () => {
    const { mutations, refetchPayrollReadiness } = setupHookMocks();
    refetchPayrollReadiness.mockResolvedValueOnce({ data: { payrollReadiness: { periodId: "period-2", readyToFinalize: true } } });
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));

    await result.current.finalizePeriod({ variables: { periodId: "period-2" } });

    expect(refetchPayrollReadiness).toHaveBeenCalledWith({ periodId: "period-2" });
    expect(mutations.finalizePeriodMutation).toHaveBeenCalledWith({ variables: { periodId: "period-2" } });
  });

  it("does not call finalize mutation when readiness blocks finalization", async () => {
    const { mutations, refetchPayrollReadiness } = setupHookMocks();
    refetchPayrollReadiness.mockResolvedValueOnce({ data: { payrollReadiness: { periodId: "period-2", readyToFinalize: false } } });
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));

    await expect(result.current.finalizePeriod({ variables: { periodId: "period-2" } })).rejects.toThrow("PAYROLL_PERIOD_NOT_READY");

    expect(refetchPayrollReadiness).toHaveBeenCalledWith({ periodId: "period-2" });
    expect(mutations.finalizePeriodMutation).not.toHaveBeenCalled();
  });

  it.each([
    ["draft", { canPay: false, canPayout: false, canLock: false, canRecalculate: true }],
    ["finalized", { canPay: true, canPayout: true, canLock: false, canRecalculate: false }],
    ["paying", { canPay: true, canPayout: true, canLock: false, canRecalculate: false }],
    ["paid", { canPay: false, canPayout: false, canLock: true, canRecalculate: false }],
    ["locked", { canPay: false, canPayout: false, canLock: false, canRecalculate: false }],
  ])("derives expected UI lifecycle affordances for %s", (status, expected) => {
    setupHookMocks({ periodStatus: status });
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));
    const period = result.current.periodDetail.period;
    const remaining = Number(period.stats?.remaining || 0);
    const affordances = {
      canPay: ["finalized", "paying"].includes(period.status) && remaining > 0,
      canPayout: ["finalized", "paying"].includes(period.status) && remaining > 0,
      canLock: period.status === "paid",
      canRecalculate: period.status === "draft",
    };
    expect(affordances).toEqual(expected);
  });

  it("maps payroll payout errors to Vietnamese UI messages", () => {
    expect(getPayrollActionErrorMessage(new Error("PAYROLL_PAYOUT_PROVIDER_NOT_CONFIGURED"))).toContain("chưa được cấu hình");
    expect(getPayrollActionErrorMessage(new Error("EMPLOYEE_BANK_ACCOUNT_NOT_VERIFIED"))).toContain("chưa được xác minh");
    expect(getPayrollActionErrorMessage(new Error("PAYROLL_PERIOD_NOT_PAYABLE"))).toContain("chưa ở trạng thái được phép chi trả");
  });
});
