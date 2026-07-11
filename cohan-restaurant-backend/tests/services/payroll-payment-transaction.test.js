import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  withTransaction: vi.fn(),
  endSession: vi.fn(),
}));
const startSessionMock = vi.hoisted(() => vi.fn());
const modelMocks = vi.hoisted(() => ({
  PayrollPeriod: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
  PayrollItem: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
  },
  PayrollPayment: {
    findOne: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
  },
  Cashflow: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
  Staff: { findById: vi.fn() },
}));
const runtimeMocks = vi.hoisted(() => ({
  mapPayrollDocToGql: vi.fn((row) => ({
    id: String(row.employeeId),
    payrollItemId: String(row._id),
    status: row.status,
    paidAmount: Number(row.breakdown?.paidAmount || 0),
    remainingAmount: Number(row.breakdown?.remainingAmount || 0),
    netSalary: Number(row.breakdown?.netSalary || 0),
  })),
  summarize: vi.fn(() => ({
    totalPayroll: 1_000_000,
    paidAmount: 0,
    remaining: 1_000_000,
    progress: 0,
  })),
}));
const lockMocks = vi.hoisted(() => ({
  assertPayrollPeriodCanMarkPaid: vi.fn(),
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
vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/payroll/payrollRuntime.service.js", () =>
  runtimeMocks,
);
vi.mock("../../src/services/payroll/payrollLockGuard.service.js", () =>
  lockMocks,
);

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

const aggregateResult = (value) => ({
  session: vi.fn().mockResolvedValue(value),
});

const period = {
  _id: "period-1",
  restaurantId: "restaurant-1",
  name: "Kỳ tháng 7",
  status: "finalized",
};
const item = {
  _id: "item-1",
  periodId: "period-1",
  restaurantId: "restaurant-1",
  employeeId: "employee-1",
  employeeName: "Nhân viên A",
  status: "pending_payment",
  breakdown: {
    netSalary: 1_000_000,
    paidAmount: 0,
    remainingAmount: 1_000_000,
  },
};

describe("transactional payroll payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMocks.withTransaction.mockImplementation(async (callback) =>
      callback(),
    );
    sessionMocks.endSession.mockResolvedValue();
    startSessionMock.mockResolvedValue(sessionMocks);
    lockMocks.assertPayrollPeriodCanMarkPaid.mockReturnValue();

    modelMocks.PayrollPeriod.findById.mockReturnValue(queryResult(period));
    modelMocks.PayrollPeriod.findByIdAndUpdate.mockResolvedValue(period);
    modelMocks.PayrollItem.findOne.mockReturnValue(queryResult(item));
    modelMocks.PayrollItem.findById.mockReturnValue(queryResult(item));
    modelMocks.PayrollPayment.aggregate.mockReturnValue(
      aggregateResult([]),
    );
    modelMocks.PayrollPayment.findOne.mockReturnValue(queryResult(null));
    modelMocks.Cashflow.findOne.mockReturnValue(queryResult(null));
    modelMocks.PayrollPayment.create.mockImplementation(
      async ([payload]) => [{ _id: "payment-1", ...payload }],
    );
    modelMocks.Cashflow.create.mockImplementation(
      async ([payload]) => [{ _id: "cashflow-1", ...payload }],
    );
    modelMocks.PayrollItem.findOneAndUpdate.mockReturnValue(
      queryResult({
        ...item,
        status: "pending_payment",
        breakdown: {
          ...item.breakdown,
          paidAmount: 400_000,
          remainingAmount: 600_000,
        },
      }),
    );
  });

  it("creates payment, cashflow and item update in one transaction", async () => {
    const { markPayrollItemPaid } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );

    await expect(
      markPayrollItemPaid({
        input: {
          periodId: "period-1",
          employeeId: "employee-1",
          amount: 400_000,
          method: "bank_transfer",
          idempotencyKey: "salary-payment-1",
        },
        actorId: "manager-1",
        refreshPeriod: false,
      }),
    ).resolves.toMatchObject({
      status: "pending_payment",
      paidAmount: 400_000,
      remainingAmount: 600_000,
    });

    expect(sessionMocks.withTransaction).toHaveBeenCalledTimes(1);
    expect(modelMocks.PayrollPayment.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          amount: 400_000,
          method: "bank_transfer",
          idempotencyKey: "salary-payment-1",
        }),
      ],
      { session: sessionMocks },
    );
    expect(modelMocks.Cashflow.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: "OUTFLOW",
          amount: 400_000,
          category: "payroll",
          subcategory: "labor",
        }),
      ],
      { session: sessionMocks },
    );
    expect(modelMocks.PayrollItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "item-1",
        status: { $nin: ["paid", "locked"] },
      }),
      {
        $set: expect.objectContaining({
          "breakdown.paidAmount": 400_000,
          "breakdown.remainingAmount": 600_000,
        }),
      },
      { new: true, session: sessionMocks },
    );
    expect(sessionMocks.endSession).toHaveBeenCalledTimes(1);
  });

  it("rejects overpayment before any transaction write", async () => {
    modelMocks.PayrollPayment.aggregate.mockReturnValue(
      aggregateResult([{ _id: null, amount: 900_000 }]),
    );
    const { markPayrollItemPaid } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );

    await expect(
      markPayrollItemPaid({
        input: {
          periodId: "period-1",
          employeeId: "employee-1",
          amount: 200_000,
        },
        refreshPeriod: false,
      }),
    ).rejects.toThrow("PAYROLL_PAYMENT_OVERPAY");

    expect(modelMocks.PayrollPayment.create).not.toHaveBeenCalled();
    expect(modelMocks.Cashflow.create).not.toHaveBeenCalled();
    expect(modelMocks.PayrollItem.findOneAndUpdate).not.toHaveBeenCalled();
    expect(sessionMocks.endSession).toHaveBeenCalledTimes(1);
  });

  it("returns the existing result for a matching idempotency key", async () => {
    const existingPayment = {
      _id: "payment-1",
      periodId: "period-1",
      restaurantId: "restaurant-1",
      employeeId: "employee-1",
      payrollItemId: "item-1",
      idempotencyKey: "salary-payment-1",
    };
    modelMocks.PayrollPayment.findOne.mockReturnValue(
      queryResult(existingPayment),
    );
    modelMocks.PayrollItem.findById.mockReturnValue(
      queryResult({
        ...item,
        status: "paid",
        breakdown: {
          ...item.breakdown,
          paidAmount: 1_000_000,
          remainingAmount: 0,
        },
      }),
    );
    const { markPayrollItemPaid } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );

    await expect(
      markPayrollItemPaid({
        input: {
          periodId: "period-1",
          employeeId: "employee-1",
          amount: 1_000_000,
          idempotencyKey: "salary-payment-1",
        },
        refreshPeriod: false,
      }),
    ).resolves.toMatchObject({
      status: "paid",
      paidAmount: 1_000_000,
      remainingAmount: 0,
    });

    expect(modelMocks.PayrollPayment.aggregate).not.toHaveBeenCalled();
    expect(modelMocks.PayrollPayment.create).not.toHaveBeenCalled();
    expect(modelMocks.Cashflow.create).not.toHaveBeenCalled();
    expect(modelMocks.PayrollItem.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key for another employee", async () => {
    modelMocks.PayrollPayment.findOne.mockReturnValue(
      queryResult({
        _id: "payment-other",
        periodId: "period-1",
        restaurantId: "restaurant-1",
        employeeId: "employee-2",
        payrollItemId: "item-2",
        idempotencyKey: "salary-payment-1",
      }),
    );
    const { markPayrollItemPaid } = await import(
      "../../src/services/payroll/payrollPayment.service.js"
    );

    await expect(
      markPayrollItemPaid({
        input: {
          periodId: "period-1",
          employeeId: "employee-1",
          idempotencyKey: "salary-payment-1",
        },
        refreshPeriod: false,
      }),
    ).rejects.toThrow("PAYROLL_PAYMENT_IDEMPOTENCY_CONFLICT");

    expect(modelMocks.PayrollPayment.create).not.toHaveBeenCalled();
    expect(sessionMocks.endSession).toHaveBeenCalledTimes(1);
  });
});
