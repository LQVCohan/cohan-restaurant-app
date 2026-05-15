import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "@apollo/client";
import usePayroll, {
  MUT_BATCH_MARK_PAYROLL_PAID,
  MUT_FINALIZE_PERIOD,
  MUT_MARK_PAYROLL_ITEM_PAID,
  QUERY_PAYROLL_EXPORT_ROWS,
  QUERY_PAYROLL_PAYMENTS,
  QUERY_PAYROLL_PAYSLIP,
  QUERY_PAYROLL_READINESS,
} from "./usePayroll";

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

describe("usePayroll payment APIs", () => {
  let markPayrollItemPaidMutation;
  let batchMarkPayrollPaidMutation;
  let finalizePeriodMutation;
  let refetchPayrollReadiness;

  beforeEach(() => {
    vi.clearAllMocks();

    refetchPayrollReadiness = vi.fn().mockResolvedValue({
      data: { payrollReadiness: { periodId: "period-1", readyToFinalize: true } },
    });

    useQuery
      .mockReturnValueOnce(queryResult({ payrollPeriods: [{ id: "period-1", restaurantId: "restaurant-1" }] }))
      .mockReturnValueOnce(queryResult({ payrollSettings: { currentPayrollPeriodId: "period-1", restaurantId: "restaurant-1" } }))
      .mockReturnValueOnce(queryResult({ me: { restaurantForStaff: "restaurant-1" } }))
      .mockReturnValueOnce(queryResult({ payrollPeriodDetail: { period: { id: "period-1" }, items: [] } }))
      .mockReturnValueOnce(queryResult({ validatePayrollPeriod: { errorCount: 0, warningCount: 0, issues: [] } }))
      .mockReturnValueOnce(queryResult({ payrollReadiness: { periodId: "period-1", readyToFinalize: true, sections: {}, issues: [] } }, { refetch: refetchPayrollReadiness }))
      .mockReturnValueOnce(queryResult({ payrollPayslip: { remainingAmount: 1000 } }))
      .mockReturnValueOnce(queryResult({ payrollPayments: [{ id: "payment-1" }] }))
      .mockReturnValueOnce(queryResult({ payrollExportRows: [{ employeeCode: "NV001" }] }))
      .mockReturnValueOnce(queryResult({ staffPayrollOverview: { stats: null, items: [] } }));

    const noopMutation = vi.fn().mockResolvedValue({});
    finalizePeriodMutation = vi.fn().mockResolvedValue({ data: { finalizePayrollPeriod: { id: "period-1", status: "finalized" } } });
    markPayrollItemPaidMutation = vi.fn().mockResolvedValue({ data: { markPayrollItemPaid: { id: "emp-1" } } });
    batchMarkPayrollPaidMutation = vi.fn().mockResolvedValue({ data: { batchMarkPayrollPaid: { successCount: 1, failedCount: 0 } } });

    useMutation
      .mockReturnValueOnce([noopMutation])
      .mockReturnValueOnce([noopMutation])
      .mockReturnValueOnce([finalizePeriodMutation])
      .mockReturnValueOnce([noopMutation])
      .mockReturnValueOnce([noopMutation])
      .mockReturnValueOnce([markPayrollItemPaidMutation])
      .mockReturnValueOnce([batchMarkPayrollPaidMutation])
      .mockReturnValueOnce([noopMutation])
      .mockReturnValueOnce([noopMutation])
      .mockReturnValueOnce([noopMutation]);
  });

  it("exposes payslip, payments, export rows, readiness and refetch aliases", () => {
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));

    expect(useQuery).toHaveBeenCalledWith(QUERY_PAYROLL_READINESS, expect.objectContaining({ variables: { periodId: "period-1" }, skip: false, fetchPolicy: "network-only" }));
    expect(useQuery).toHaveBeenCalledWith(QUERY_PAYROLL_PAYSLIP, expect.objectContaining({ skip: true }));
    expect(useQuery).toHaveBeenCalledWith(QUERY_PAYROLL_PAYMENTS, expect.objectContaining({ variables: { periodId: "period-1" } }));
    expect(useQuery).toHaveBeenCalledWith(QUERY_PAYROLL_EXPORT_ROWS, expect.objectContaining({ variables: { periodId: "period-1" } }));
    expect(result.current.payrollReadiness).toEqual(expect.objectContaining({ periodId: "period-1", readyToFinalize: true }));
    expect(result.current.refetchPayrollReadiness).toBe(refetchPayrollReadiness);
    expect(result.current.refetchReadiness).toBe(refetchPayrollReadiness);
    expect(result.current.payrollPayslip).toEqual({ remainingAmount: 1000 });
    expect(result.current.payrollPayments).toEqual([{ id: "payment-1" }]);
    expect(result.current.payrollExportRows).toEqual([{ employeeCode: "NV001" }]);
    expect(result.current.refetchPayrollPeriods).toBe(result.current.refetchPeriods);
    expect(result.current.refetchPayrollPeriodDetail).toBe(result.current.refetchDetail);
  });

  it("wraps single and batch mark paid mutations with the expected input shape", async () => {
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));

    await result.current.markPayrollItemPaid({
      periodId: "period-1",
      employeeId: "emp-1",
      amount: 1000,
      method: "cash",
      paidAt: "2026-05-01T00:00:00.000Z",
      note: "ok",
      referenceCode: "REF-1",
    });
    await result.current.batchMarkPayrollPaid({
      periodId: "period-1",
      employeeIds: ["emp-1"],
      method: "cash",
      paidAt: "2026-05-01T00:00:00.000Z",
      note: "batch",
    });

    expect(useMutation).toHaveBeenCalledWith(MUT_MARK_PAYROLL_ITEM_PAID);
    expect(useMutation).toHaveBeenCalledWith(MUT_BATCH_MARK_PAYROLL_PAID);
    expect(markPayrollItemPaidMutation).toHaveBeenCalledWith({ variables: { input: expect.objectContaining({ employeeId: "emp-1", referenceCode: "REF-1" }) } });
    expect(batchMarkPayrollPaidMutation).toHaveBeenCalledWith({ variables: { input: expect.objectContaining({ employeeIds: ["emp-1"], note: "batch" }) } });
  });

  it("refetches readiness before finalizing payroll", async () => {
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));

    await result.current.finalizePeriod({ variables: { periodId: "period-1" } });

    expect(useMutation).toHaveBeenCalledWith(MUT_FINALIZE_PERIOD);
    expect(refetchPayrollReadiness).toHaveBeenCalledWith({ periodId: "period-1" });
    expect(finalizePeriodMutation).toHaveBeenCalledWith({ variables: { periodId: "period-1" } });
  });

  it("does not call finalize mutation when readiness blocks finalization", async () => {
    refetchPayrollReadiness.mockResolvedValueOnce({
      data: { payrollReadiness: { periodId: "period-1", readyToFinalize: false } },
    });
    const { result } = renderHook(() => usePayroll({ periodId: "period-1" }));

    await expect(
      result.current.finalizePeriod({ variables: { periodId: "period-1" } }),
    ).rejects.toThrow("PAYROLL_PERIOD_NOT_READY");

    expect(refetchPayrollReadiness).toHaveBeenCalledWith({ periodId: "period-1" });
    expect(finalizePeriodMutation).not.toHaveBeenCalled();
  });
});
