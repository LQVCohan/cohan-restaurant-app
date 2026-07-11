import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = vi.hoisted(() => ({
  periodId: "507f1f77bcf86cd799439011",
  restaurantId: "507f1f77bcf86cd799439012",
  employeeId: "507f1f77bcf86cd799439013",
  employeeId2: "507f1f77bcf86cd799439014",
  itemId: "507f1f77bcf86cd799439015",
  actorId: "507f1f77bcf86cd799439016",
}));
const sessionMocks = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  endSession: vi.fn(),
}));
const startSessionMock = vi.hoisted(() => vi.fn());
const modelMocks = vi.hoisted(() => ({
  PayrollPeriod: { findById: vi.fn(), findByIdAndUpdate: vi.fn() },
  PayrollItem: {
    findOne: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  PayrollPayment: {
    aggregate: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  },
  Cashflow: { findOne: vi.fn(), create: vi.fn() },
  Staff: { findById: vi.fn() },
}));

vi.mock("mongoose", () => {
  function ObjectId(value) {
    this.value = String(value);
    this.toString = () => this.value;
  }
  return {
    default: {
      isValidObjectId: vi.fn(() => true),
      Types: { ObjectId },
      startSession: startSessionMock,
    },
  };
});
vi.mock("../../models/index.js", () => ({
  ...modelMocks,
  Shift: {},
  Timesheet: {},
  LeaveRequest: {},
  Restaurant: {},
  PayrollSetting: {},
  PayrollAdjustment: {},
}));

const queryResult = (value) => {
  const query = {
    session: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    lean: vi.fn().mockResolvedValue(value),
  };
  query.session.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  return query;
};

const aggregateResult = (value) => {
  const promise = Promise.resolve(value);
  return {
    session: vi.fn().mockResolvedValue(value),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  };
};

function period(status = "finalized") {
  return {
    _id: ids.periodId,
    restaurantId: ids.restaurantId,
    name: "May 2026",
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-31"),
    status,
    statsSnapshot: {
      totalPayroll: 1000,
      paidAmount: 0,
      remaining: 1000,
      progress: 0,
    },
  };
}

function item(
  employeeId = ids.employeeId,
  status = "finalized",
  netSalary = 1000,
) {
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
      paidAmount: status === "paid" ? netSalary : 0,
      remainingAmount: status === "paid" ? 0 : netSalary,
    },
    status,
    paidAt: status === "paid" ? new Date("2026-05-10") : null,
  };
}

describe("payroll payment workflow service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sessionMocks.withTransaction.mockImplementation(async (callback) =>
      callback(),
    );
    sessionMocks.endSession.mockResolvedValue();
    startSessionMock.mockResolvedValue(sessionMocks);

    modelMocks.PayrollPeriod.findById.mockReturnValue(queryResult(period()));
    modelMocks.PayrollPeriod.findByIdAndUpdate.mockResolvedValue(period());
    modelMocks.PayrollItem.findOne.mockReturnValue(queryResult(item()));
    modelMocks.PayrollItem.findById.mockReturnValue(queryResult(item()));
    modelMocks.PayrollItem.find.mockReturnValue(queryResult([item()]));
    modelMocks.PayrollItem.findOneAndUpdate.mockReturnValue(
      queryResult(item(ids.employeeId, "paid")),
    );
    modelMocks.PayrollPayment.aggregate.mockReturnValue(aggregateResult([]));
    modelMocks.PayrollPayment.create.mockImplementation(
      async ([payload]) => [{ _id: "payment-1", ...payload }],
    );
    modelMocks.PayrollPayment.find.mockReturnValue(queryResult([]));
    modelMocks.PayrollPayment.findOne.mockReturnValue(queryResult(null));
    modelMocks.Cashflow.findOne.mockReturnValue(queryResult(null));
    modelMocks.Cashflow.create.mockImplementation(
      async ([payload]) => [{ _id: "cashflow-1", ...payload }],
    );
    modelMocks.Staff.findById.mockReturnValue(
      queryResult({
        _id: ids.employeeId,
        fullName: "A",
        employeeCode: "E1",
      }),
    );
  });

  it("returns payslip item, breakdown, payments and remaining amount", async () => {
    modelMocks.PayrollPayment.find.mockReturnValue(
      queryResult([
        {
          _id: "507f1f77bcf86cd799439099",
          periodId: ids.periodId,
          restaurantId: ids.restaurantId,
          employeeId: ids.employeeId,
          payrollItemId: ids.itemId,
          amount: 250,
          paidAt: new Date("2026-05-11"),
        },
      ]),
    );
    const { getPayrollPayslip } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );
    const payslip = await getPayrollPayslip({
      periodId: ids.periodId,
      employeeId: ids.employeeId,
    });

    expect(payslip.item.netSalary).toBe(1000);
    expect(payslip.breakdown.overtimeHolidayHours).toBe(3);
    expect(payslip.payments).toHaveLength(1);
    expect(payslip.remainingAmount).toBe(750);
  });

  it("does not create payment for draft or locked periods", async () => {
    const { markPayrollItemPaid } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );

    modelMocks.PayrollPeriod.findById.mockReturnValue(
      queryResult(period("draft")),
    );
    await expect(
      markPayrollItemPaid({
        input: { periodId: ids.periodId, employeeId: ids.employeeId },
        actorId: ids.actorId,
      }),
    ).rejects.toThrow("PAYROLL_PERIOD_NOT_FINALIZED");

    modelMocks.PayrollPeriod.findById.mockReturnValue(
      queryResult(period("locked")),
    );
    await expect(
      markPayrollItemPaid({
        input: { periodId: ids.periodId, employeeId: ids.employeeId },
        actorId: ids.actorId,
      }),
    ).rejects.toThrow("PAYROLL_PERIOD_LOCKED");

    expect(modelMocks.PayrollPayment.create).not.toHaveBeenCalled();
    expect(sessionMocks.endSession).toHaveBeenCalledTimes(2);
  });

  it("batch mark paid reports partial success", async () => {
    modelMocks.PayrollItem.findOne
      .mockReturnValueOnce(queryResult(item(ids.employeeId)))
      .mockReturnValueOnce(queryResult(null));
    const { batchMarkPayrollPaid } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );
    const result = await batchMarkPayrollPaid({
      input: {
        periodId: ids.periodId,
        employeeIds: [ids.employeeId, ids.employeeId2],
      },
      actorId: ids.actorId,
    });

    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors[0].code).toBe("PAYROLL_ITEM_NOT_FOUND");
  });

  it("payment history sorts newest first", async () => {
    const newer = {
      _id: "507f1f77bcf86cd799439091",
      periodId: ids.periodId,
      restaurantId: ids.restaurantId,
      employeeId: ids.employeeId,
      payrollItemId: ids.itemId,
      amount: 10,
      paidAt: new Date("2026-05-12"),
    };
    const historyQuery = queryResult([newer]);
    modelMocks.PayrollPayment.find.mockReturnValue(historyQuery);
    const { listPayrollPayments } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );
    const rows = await listPayrollPayments({
      periodId: ids.periodId,
      employeeId: ids.employeeId,
    });

    expect(historyQuery.sort).toHaveBeenCalledWith({
      paidAt: -1,
      createdAt: -1,
    });
    expect(rows[0].paidAt).toEqual(new Date("2026-05-12"));
  });

  it("export rows use saved payroll items and payment history", async () => {
    const itemQuery = queryResult([item()]);
    modelMocks.PayrollItem.find.mockReturnValue(itemQuery);
    modelMocks.PayrollPayment.aggregate.mockReturnValue(
      aggregateResult([{ _id: ids.employeeId, amount: 400 }]),
    );
    const { buildPayrollExportRows } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );
    const rows = await buildPayrollExportRows({ periodId: ids.periodId });

    expect(itemQuery.sort).toHaveBeenCalledWith({ employeeName: 1 });
    expect(rows[0]).toMatchObject({
      overtimeHolidayHours: 3,
      paidAmount: 400,
      remainingAmount: 600,
    });
  });
});
