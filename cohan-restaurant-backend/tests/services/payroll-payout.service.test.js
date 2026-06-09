import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = vi.hoisted(() => ({
  restaurantId: "507f1f77bcf86cd799439101",
  periodId: "507f1f77bcf86cd799439102",
  itemId: "507f1f77bcf86cd799439103",
  employeeId: "507f1f77bcf86cd799439104",
  payoutId: "507f1f77bcf86cd799439105",
  batchId: "507f1f77bcf86cd799439106",
  actorId: "507f1f77bcf86cd799439107",
}));

const paymentService = vi.hoisted(() => ({ markPayrollItemPaid: vi.fn() }));
const modelMocks = vi.hoisted(() => ({
  EmployeeBankAccount: { findOne: vi.fn(), updateMany: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
  PayrollItem: { findOne: vi.fn(), find: vi.fn(), findById: vi.fn(), findByIdAndUpdate: vi.fn() },
  PayrollPayment: { aggregate: vi.fn(), findOne: vi.fn() },
  PayrollPayout: { findOne: vi.fn(), create: vi.fn(), findById: vi.fn(), findByIdAndUpdate: vi.fn(), find: vi.fn() },
  PayrollPayoutBatch: { create: vi.fn(), findById: vi.fn(), findByIdAndUpdate: vi.fn() },
  PayrollPeriod: { findById: vi.fn(), findByIdAndUpdate: vi.fn() },
  RestaurantPayoutAccount: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));

vi.mock("../../src/services/payroll/payrollPayment.service.js", () => paymentService);
vi.mock("../../models/index.js", () => modelMocks);

const leanChain = (value) => ({ lean: vi.fn(async () => value) });
const sortLeanChain = (value) => ({ sort: vi.fn(() => ({ select: vi.fn(() => leanChain(value)), lean: vi.fn(async () => value) })), select: vi.fn(() => leanChain(value)), lean: vi.fn(async () => value) });
const selectLeanChain = (value) => ({ select: vi.fn(() => leanChain(value)), lean: vi.fn(async () => value) });

const period = () => ({ _id: ids.periodId, restaurantId: ids.restaurantId, status: "finalized" });
const item = () => ({ _id: ids.itemId, periodId: ids.periodId, restaurantId: ids.restaurantId, employeeId: ids.employeeId, employeeName: "Nguyen A", status: "finalized", breakdown: { netSalary: 1000 } });
const bank = (suffix = "0001") => ({ _id: `bank-${suffix}`, employeeId: ids.employeeId, restaurantId: ids.restaurantId, isDefault: true, accountHolderName: "Nguyen A", bankName: "VCB", bankCode: "VCB", accountNumberLast4: suffix, verificationStatus: "verified" });
const payoutDoc = (overrides = {}) => ({ _id: ids.payoutId, restaurantId: ids.restaurantId, periodId: ids.periodId, payrollItemId: ids.itemId, employeeId: ids.employeeId, amount: 1000, status: "success", method: "bank_transfer", providerTransactionId: "manual-1", ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PAYROLL_PAYOUT_MODE;
  delete process.env.PAYROLL_PAYOUT_PROVIDER;
  delete process.env.PAYROLL_BANK_ACCOUNT_ENCRYPTION_KEY;
  process.env.NODE_ENV = "test";
  modelMocks.PayrollPeriod.findById.mockReturnValue(leanChain(period()));
  modelMocks.PayrollPeriod.findByIdAndUpdate.mockResolvedValue(period());
  modelMocks.PayrollItem.findOne.mockReturnValue(leanChain(item()));
  modelMocks.PayrollItem.find.mockReturnValue(selectLeanChain([{ employeeId: ids.employeeId }]));
  modelMocks.PayrollItem.findById.mockReturnValue(leanChain(item()));
  modelMocks.PayrollItem.findByIdAndUpdate.mockResolvedValue(item());
  modelMocks.PayrollPayment.aggregate.mockResolvedValue([{ _id: null, amount: 0 }]);
  modelMocks.PayrollPayment.findOne.mockReturnValue(leanChain(null));
  modelMocks.EmployeeBankAccount.findOne.mockReturnValue({ sort: vi.fn(() => leanChain(bank())) });
  modelMocks.EmployeeBankAccount.find.mockReturnValue(sortLeanChain([bank()]));
  modelMocks.EmployeeBankAccount.updateMany.mockResolvedValue({ modifiedCount: 0 });
  modelMocks.PayrollPayout.findOne.mockReturnValue(leanChain(null));
  modelMocks.PayrollPayout.create.mockImplementation(async (payload) => payoutDoc({ ...payload, _id: ids.payoutId }));
  modelMocks.PayrollPayout.findById.mockReturnValue(leanChain(payoutDoc()));
  modelMocks.PayrollPayout.findByIdAndUpdate.mockResolvedValue(payoutDoc());
  modelMocks.PayrollPayout.find.mockReturnValue({ select: vi.fn(() => leanChain([])) });
  modelMocks.PayrollPayoutBatch.create.mockResolvedValue({ _id: ids.batchId, restaurantId: ids.restaurantId, periodId: ids.periodId });
  modelMocks.PayrollPayoutBatch.findById.mockReturnValue(leanChain({ _id: ids.batchId, restaurantId: ids.restaurantId, periodId: ids.periodId, successCount: 0, processingCount: 0, failedCount: 0 }));
  modelMocks.PayrollPayoutBatch.findByIdAndUpdate.mockResolvedValue({});
  paymentService.markPayrollItemPaid.mockResolvedValue({ id: ids.employeeId, status: "paid" });

});

describe("payroll payout service", () => {
  it("encrypts/decrypts bank account numbers with AES-GCM payload", async () => {
    process.env.PAYROLL_BANK_ACCOUNT_ENCRYPTION_KEY = "test-secret-key";
    const { encryptAccountNumber, decryptAccountNumber } = await import("../../src/services/payroll/payrollPayout.service.js");
    const encrypted = encryptAccountNumber("1234567890");
    expect(encrypted).not.toContain("1234567890");
    expect(JSON.parse(encrypted)).toMatchObject({ algorithm: "aes-256-gcm", version: 1 });
    expect(decryptAccountNumber(encrypted)).toBe("1234567890");
  });

  it("requires encryption key in production", async () => {
    process.env.NODE_ENV = "production";
    const { encryptAccountNumber } = await import("../../src/services/payroll/payrollPayout.service.js");
    expect(() => encryptAccountNumber("1234")).toThrow("PAYROLL_BANK_ACCOUNT_ENCRYPTION_KEY_REQUIRED");
  });

  it("manual payout succeeds and creates linked PayrollPayment", async () => {
    const { createPayrollPayout } = await import("../../src/services/payroll/payrollPayout.service.js");
    const payout = await createPayrollPayout({ input: { periodId: ids.periodId, employeeId: ids.employeeId, method: "bank_transfer", idempotencyKey: "manual-key" }, actorId: ids.actorId });
    expect(payout.status).toBe("success");
    expect(paymentService.markPayrollItemPaid).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ payoutId: ids.payoutId, idempotencyKey: `payout:${ids.payoutId}` }) }));
  });

  it("mock processing batch counts processing separately from success", async () => {
    process.env.PAYROLL_PAYOUT_MODE = "mock";
    modelMocks.PayrollPayout.findById.mockReturnValue(leanChain(payoutDoc({ status: "processing" })));
    const { createPayrollBatchPayout } = await import("../../src/services/payroll/payrollPayout.service.js");
    const result = await createPayrollBatchPayout({ input: { periodId: ids.periodId, employeeIds: [ids.employeeId], method: "bank_transfer", note: "simulate processing", idempotencyKey: "batch-key" }, actorId: ids.actorId });
    expect(result.successCount).toBe(0);
    expect(result.processingCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(modelMocks.PayrollPayoutBatch.findByIdAndUpdate).toHaveBeenCalledWith(ids.batchId, expect.objectContaining({ $set: expect.objectContaining({ processingCount: 1, status: "processing", completedAt: null }) }));
  });

  it("upserting a new default bank account unsets previous defaults", async () => {
    const { upsertEmployeeBankAccount } = await import("../../src/services/payroll/payrollPayout.service.js");
    modelMocks.EmployeeBankAccount.findOneAndUpdate.mockResolvedValueOnce({ ...bank("9999"), _id: "bank-new", accountNumberLast4: "9999" });
    const row = await upsertEmployeeBankAccount({ input: { employeeId: ids.employeeId, restaurantId: ids.restaurantId, accountHolderName: "Nguyen A", bankName: "VCB", accountNumber: "123459999", isDefault: true } });
    expect(modelMocks.EmployeeBankAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({ employeeId: expect.anything(), restaurantId: expect.anything(), isDefault: true }), { $set: { isDefault: false } });
    expect(row.accountNumberMasked).toBe("****9999");
    expect(row).not.toHaveProperty("accountNumberEncrypted");
  });
  it("applies provider success idempotently with payout-linked payment", async () => {
    const save = vi.fn(async function save() { return this; });
    const processingPayout = { ...payoutDoc({ status: "processing", providerTransactionId: "provider-1" }), save };
    modelMocks.PayrollPayout.findOne.mockReturnValueOnce(processingPayout);
    modelMocks.PayrollPayout.findById.mockReturnValueOnce(leanChain(payoutDoc({ status: "success", providerTransactionId: "provider-1" })));
    const { applyPayrollPayoutResult } = await import("../../src/services/payroll/payrollPayout.service.js");
    const payout = await applyPayrollPayoutResult({ payoutId: ids.payoutId, providerTransactionId: "provider-1", status: "success", actorId: ids.actorId });
    expect(payout.status).toBe("success");
    expect(save).toHaveBeenCalled();
    expect(paymentService.markPayrollItemPaid).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ payoutId: ids.payoutId, idempotencyKey: `payout:${ids.payoutId}` }) }));

    paymentService.markPayrollItemPaid.mockClear();
    modelMocks.PayrollPayment.findOne.mockReturnValueOnce(leanChain({ _id: "payment-existing", payoutId: ids.payoutId }));
    const saveAgain = vi.fn(async function saveAgain() { return this; });
    modelMocks.PayrollPayout.findOne.mockReturnValueOnce({ ...payoutDoc({ status: "success" }), save: saveAgain });
    await applyPayrollPayoutResult({ payoutId: ids.payoutId, status: "success", actorId: ids.actorId });
    expect(paymentService.markPayrollItemPaid).not.toHaveBeenCalled();
  });

  it("supports retrying failed payout and cancelling processing payout", async () => {
    process.env.PAYROLL_PAYOUT_MODE = "mock";
    modelMocks.PayrollPayout.findById.mockReturnValueOnce(leanChain(payoutDoc({ status: "failed", note: "retry success" })));
    modelMocks.PayrollPayout.findOne.mockReturnValueOnce({ ...payoutDoc({ status: "processing" }), save: vi.fn(async function save() { return this; }) });
    modelMocks.PayrollPayout.findById.mockReturnValueOnce(leanChain(payoutDoc({ status: "success" })));
    const { retryPayrollPayout } = await import("../../src/services/payroll/payrollPayout.service.js");
    const retry = await retryPayrollPayout({ payoutId: ids.payoutId, idempotencyKey: "retry-key", actorId: ids.actorId });
    expect(retry.status).toBe("success");
    expect(modelMocks.PayrollPayout.findByIdAndUpdate).toHaveBeenCalledWith(ids.payoutId, expect.objectContaining({ $inc: { retryCount: 1 }, $set: expect.objectContaining({ idempotencyKey: "retry-key" }) }));

    const saveCancel = vi.fn(async function saveCancel() { return this; });
    modelMocks.PayrollPayout.findById
      .mockReturnValueOnce({ ...payoutDoc({ status: "processing" }), save: saveCancel })
      .mockReturnValueOnce(leanChain(payoutDoc({ status: "cancelled", failureReason: "duplicate" })));
    const { cancelPayrollPayout } = await import("../../src/services/payroll/payrollPayout.service.js");
    const cancelled = await cancelPayrollPayout({ payoutId: ids.payoutId, reason: "duplicate", actorId: ids.actorId });
    expect(cancelled.status).toBe("cancelled");
    expect(saveCancel).toHaveBeenCalled();
    expect(modelMocks.PayrollItem.findByIdAndUpdate).toHaveBeenCalledWith(ids.itemId, { $set: { status: "pending_payment" } });
  });

});
