import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = vi.hoisted(() => ({
  periodId: "507f1f77bcf86cd799439011",
  restaurantId: "507f1f77bcf86cd799439012",
  employeeId: "507f1f77bcf86cd799439013",
  employeeId2: "507f1f77bcf86cd799439014",
  itemId: "507f1f77bcf86cd799439015",
  actorId: "507f1f77bcf86cd799439016",
}));

const modelMocks = vi.hoisted(() => ({
  PayrollPeriod: { findById: vi.fn(), findByIdAndUpdate: vi.fn() },
  PayrollItem: { findOne: vi.fn(), find: vi.fn(), findByIdAndUpdate: vi.fn() },
  PayrollPayment: { aggregate: vi.fn(), create: vi.fn(), find: vi.fn() },
  Staff: { findById: vi.fn() },
}));

vi.mock("../../models/index.js", () => ({
  ...modelMocks,
  Shift: {},
  Timesheet: {},
  LeaveRequest: {},
  Restaurant: {},
  PayrollSetting: {},
  PayrollAdjustment: {},
}));

const leanChain = (value) => ({ lean: vi.fn(async () => value) });
const selectLeanChain = (value) => ({ select: vi.fn(() => leanChain(value)), lean: vi.fn(async () => value) });
const sortLeanChain = (value) => ({ sort: vi.fn(() => leanChain(value)), lean: vi.fn(async () => value) });

function period(status = "finalized") {
  return {
    _id: ids.periodId,
    restaurantId: ids.restaurantId,
    name: "May 2026",
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-31"),
    status,
    statsSnapshot: { totalPayroll: 1000, paidAmount: 0, remaining: 1000, progress: 0 },
  };
}

function item(employeeId = ids.employeeId, status = "finalized", netSalary = 1000) {
  return {
    _id: ids.itemId,
    periodId: ids.periodId,
    restaurantId: ids.restaurantId,
    employeeId,
    employeeName: employeeId === ids.employeeId2 ? "B" : "A",
    employeeCode: "E1",
    role: "Server",
    department: "Service",
    breakdown: {
      baseSalary: 1000,
      actualWorkDays: 20,
      totalHours: 160,
      overtimeNormalHours: 1,
      overtimeWeekendHours: 2,
      overtimeHolidayHours: 3,
      nightHours: 4,
      grossIncome: 1200,
      allowance: 10,
      bonus: 20,
      deduction: 5,
      insuranceTotal: 30,
      personalIncomeTax: 40,
      netSalary,
    },
    status,
    paidAt: null,
  };
}

describe("payroll payment workflow service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    modelMocks.PayrollPeriod.findById.mockReturnValue(leanChain(period()));
    modelMocks.PayrollPeriod.findByIdAndUpdate.mockResolvedValue(period());
    modelMocks.PayrollItem.findOne.mockResolvedValue(item());
    modelMocks.PayrollItem.find.mockReturnValue(leanChain([item()]));
    modelMocks.PayrollItem.findByIdAndUpdate.mockResolvedValue({ ...item(), status: "paid", paidAt: new Date("2026-05-10") });
    modelMocks.PayrollPayment.aggregate.mockResolvedValue([{ _id: ids.employeeId, amount: 0 }]);
    modelMocks.PayrollPayment.create.mockResolvedValue({});
    modelMocks.PayrollPayment.find.mockReturnValue(sortLeanChain([]));
    modelMocks.Staff.findById.mockReturnValue(selectLeanChain({ _id: ids.employeeId, fullName: "A", employeeCode: "E1" }));
  });

  it("returns payslip item, breakdown, payments and remaining amount", async () => {
    modelMocks.PayrollPayment.find.mockReturnValue(sortLeanChain([
      { _id: "507f1f77bcf86cd799439099", periodId: ids.periodId, restaurantId: ids.restaurantId, employeeId: ids.employeeId, payrollItemId: ids.itemId, amount: 250, paidAt: new Date("2026-05-11") },
    ]));
    const { getPayrollPayslip } = await import("../../src/services/payroll/payrollPayment.service.js");
    const payslip = await getPayrollPayslip({ periodId: ids.periodId, employeeId: ids.employeeId });
    expect(payslip.item.netSalary).toBe(1000);
    expect(payslip.breakdown.overtimeHolidayHours).toBe(3);
    expect(payslip.payments).toHaveLength(1);
    expect(payslip.remainingAmount).toBe(750);
  });

  it("mark paid creates PayrollPayment and updates PayrollItem paid status", async () => {
    const { markPayrollItemPaid } = await import("../../src/services/payroll/payrollPayment.service.js");
    const paid = await markPayrollItemPaid({ input: { periodId: ids.periodId, employeeId: ids.employeeId, method: "cash" }, actorId: ids.actorId });
    expect(modelMocks.PayrollPayment.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, method: "cash" }));
    expect(modelMocks.PayrollItem.findByIdAndUpdate).toHaveBeenCalledWith(ids.itemId, expect.objectContaining({ $set: expect.objectContaining({ status: "paid" }) }), { new: true });
    expect(paid.status).toBe("paid");
  });

  it("does not mark paid if period is draft", async () => {
    modelMocks.PayrollPeriod.findById.mockReturnValue(leanChain(period("draft")));
    const { markPayrollItemPaid } = await import("../../src/services/payroll/payrollPayment.service.js");
    await expect(markPayrollItemPaid({ input: { periodId: ids.periodId, employeeId: ids.employeeId }, actorId: ids.actorId })).rejects.toThrow("PAYROLL_PERIOD_NOT_FINALIZED");
    expect(modelMocks.PayrollPayment.create).not.toHaveBeenCalled();
  });

  it("does not mark paid if period is locked", async () => {
    modelMocks.PayrollPeriod.findById.mockReturnValue(leanChain(period("locked")));
    const { markPayrollItemPaid } = await import("../../src/services/payroll/payrollPayment.service.js");
    await expect(markPayrollItemPaid({ input: { periodId: ids.periodId, employeeId: ids.employeeId }, actorId: ids.actorId })).rejects.toThrow("PAYROLL_PERIOD_LOCKED");
  });

  it("does not allow overpay", async () => {
    const { markPayrollItemPaid } = await import("../../src/services/payroll/payrollPayment.service.js");
    await expect(markPayrollItemPaid({ input: { periodId: ids.periodId, employeeId: ids.employeeId, amount: 1001 }, actorId: ids.actorId })).rejects.toThrow("PAYROLL_PAYMENT_OVERPAY");
    expect(modelMocks.PayrollPayment.create).not.toHaveBeenCalled();
  });

  it("batch mark paid reports partial success", async () => {
    modelMocks.PayrollItem.findOne
      .mockResolvedValueOnce(item(ids.employeeId))
      .mockResolvedValueOnce(null);
    const { batchMarkPayrollPaid } = await import("../../src/services/payroll/payrollPayment.service.js");
    const result = await batchMarkPayrollPaid({ input: { periodId: ids.periodId, employeeIds: [ids.employeeId, ids.employeeId2] }, actorId: ids.actorId });
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors[0].code).toBe("PAYROLL_ITEM_NOT_FOUND");
  });

  it("payment history sorts newest first", async () => {
    const newer = { _id: "507f1f77bcf86cd799439091", periodId: ids.periodId, restaurantId: ids.restaurantId, employeeId: ids.employeeId, payrollItemId: ids.itemId, amount: 10, paidAt: new Date("2026-05-12") };
    modelMocks.PayrollPayment.find.mockReturnValue(sortLeanChain([newer]));
    const { listPayrollPayments } = await import("../../src/services/payroll/payrollPayment.service.js");
    const rows = await listPayrollPayments({ periodId: ids.periodId, employeeId: ids.employeeId });
    expect(modelMocks.PayrollPayment.find().sort).toHaveBeenCalledWith({ paidAt: -1, createdAt: -1 });
    expect(rows[0].paidAt).toEqual(new Date("2026-05-12"));
  });

  it("export rows use PayrollItem breakdown without runtime recalculation", async () => {
    modelMocks.PayrollItem.find.mockReturnValue(sortLeanChain([item()]));
    modelMocks.PayrollPayment.aggregate.mockResolvedValue([{ _id: ids.employeeId, amount: 400 }]);
    const { buildPayrollExportRows } = await import("../../src/services/payroll/payrollPayment.service.js");
    const rows = await buildPayrollExportRows({ periodId: ids.periodId });
    expect(rows[0]).toMatchObject({ overtimeHolidayHours: 3, paidAmount: 400, remainingAmount: 600 });
    expect(modelMocks.PayrollItem.find).toHaveBeenCalled();
  });
});
