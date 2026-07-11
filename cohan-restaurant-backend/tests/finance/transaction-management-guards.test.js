import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Invoice: { findOne: vi.fn() },
  PaymentTransaction: { findOne: vi.fn() },
  SupplierPayable: { findById: vi.fn() },
  BankTransaction: { findById: vi.fn() },
  PaymentReconciliation: { findOne: vi.fn() },
}));

const permissionMocks = vi.hoisted(() => ({
  requireFinanceWrite: vi.fn(),
  requireReconciliationWrite: vi.fn(),
  requireRefundWrite: vi.fn(),
}));

const baseMutationMocks = vi.hoisted(() => ({
  createRefundRequest: vi.fn(),
  createSupplierPayable: vi.fn(),
  updateSupplierPayable: vi.fn(),
  voidSupplierPayable: vi.fn(),
  manuallyMatchBankTransaction: vi.fn(),
  reconcileBankTransaction: vi.fn(),
  ignoreBankTransaction: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock(
  "../../src/services/finance/financePermission.service.js",
  () => permissionMocks,
);
vi.mock("../../graphql/resolvers/payment/mutation.js", () => ({
  default: baseMutationMocks,
}));

const restaurantId = "64b000000000000000000001";
const invoiceId = "64b000000000000000000002";
const transactionId = "64b000000000000000000003";
const orderId = "64b000000000000000000004";
const payableId = "64b000000000000000000005";
const bankTransactionId = "64b000000000000000000006";
const paymentSessionId = "64b000000000000000000007";
const otherTransactionId = "64b000000000000000000008";

const leanResult = (value) => ({ lean: vi.fn().mockResolvedValue(value) });

function payable(overrides = {}) {
  return {
    _id: payableId,
    restaurantId,
    amount: 1000,
    paidAmount: 0,
    remainingAmount: 1000,
    status: "unpaid",
    ...overrides,
  };
}

function bank(overrides = {}) {
  return {
    _id: bankTransactionId,
    restaurantId,
    matchStatus: "unmatched",
    ...overrides,
  };
}

describe("transaction management production mutation guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    permissionMocks.requireFinanceWrite.mockResolvedValue(true);
    permissionMocks.requireReconciliationWrite.mockResolvedValue(true);
    permissionMocks.requireRefundWrite.mockResolvedValue(true);
    baseMutationMocks.createRefundRequest.mockResolvedValue({ id: "refund" });
    baseMutationMocks.createSupplierPayable.mockResolvedValue({ id: payableId });
    baseMutationMocks.updateSupplierPayable.mockResolvedValue({ id: payableId });
    baseMutationMocks.voidSupplierPayable.mockResolvedValue({ id: payableId });
    baseMutationMocks.manuallyMatchBankTransaction.mockResolvedValue({
      id: "reconciliation",
    });
    baseMutationMocks.reconcileBankTransaction.mockResolvedValue({
      id: "reconciliation",
    });
    baseMutationMocks.ignoreBankTransaction.mockResolvedValue({
      id: bankTransactionId,
    });
  });

  it("resolves invoice-backed refunds to the scoped successful payment transaction", async () => {
    modelMocks.Invoice.findOne.mockReturnValue(
      leanResult({
        _id: invoiceId,
        restaurantId,
        refTransactionId: transactionId,
        orderId,
      }),
    );
    modelMocks.PaymentTransaction.findOne.mockReturnValue(
      leanResult({ _id: transactionId, restaurantId, status: "SUCCESS" }),
    );
    const guards = (
      await import("../../graphql/resolvers/payment/transactionManagementGuards.js")
    ).default;

    await guards.createRefundRequest(
      null,
      {
        input: {
          restaurantId,
          invoiceId,
          amount: 300,
          reason: "Hoàn món",
        },
      },
      { user: { id: "user-1" } },
    );

    expect(baseMutationMocks.createRefundRequest).toHaveBeenCalledWith(
      null,
      {
        input: expect.objectContaining({
          restaurantId,
          invoiceId,
          paymentTransactionId: transactionId,
          orderId,
          amount: 300,
        }),
      },
      expect.anything(),
      undefined,
    );
  });

  it("rejects refund references outside the restaurant scope", async () => {
    modelMocks.Invoice.findOne.mockReturnValue(leanResult(null));
    const guards = (
      await import("../../graphql/resolvers/payment/transactionManagementGuards.js")
    ).default;

    await expect(
      guards.createRefundRequest(
        null,
        { input: { restaurantId, invoiceId, amount: 100, reason: "x" } },
        { user: { id: "user-1" } },
      ),
    ).rejects.toThrow(/restaurant scope/i);
    expect(baseMutationMocks.createRefundRequest).not.toHaveBeenCalled();
  });

  it("forces supplier paid amounts through recordSupplierPayment", async () => {
    const guards = (
      await import("../../graphql/resolvers/payment/transactionManagementGuards.js")
    ).default;

    await expect(
      guards.createSupplierPayable(
        null,
        { input: { restaurantId, supplierName: "A", amount: 1000, paidAmount: 1 } },
        { user: { id: "user-1" } },
      ),
    ).rejects.toThrow(/recordSupplierPayment/i);

    modelMocks.SupplierPayable.findById.mockResolvedValue(
      payable({ paidAmount: 200, remainingAmount: 800, status: "partial" }),
    );
    await expect(
      guards.updateSupplierPayable(
        null,
        { id: payableId, input: { amount: 1200, paidAmount: 300 } },
        { user: { id: "user-1" } },
      ),
    ).rejects.toThrow(/recordSupplierPayment/i);

    await guards.updateSupplierPayable(
      null,
      { id: payableId, input: { amount: 1200, paidAmount: 200 } },
      { user: { id: "user-1" } },
    );
    expect(baseMutationMocks.updateSupplierPayable).toHaveBeenCalledWith(
      null,
      { id: payableId, input: { amount: 1200 } },
      expect.anything(),
      undefined,
    );
  });

  it("does not void a supplier payable after any payment was recorded", async () => {
    modelMocks.SupplierPayable.findById.mockResolvedValue(
      payable({ paidAmount: 200, remainingAmount: 800, status: "partial" }),
    );
    const guards = (
      await import("../../graphql/resolvers/payment/transactionManagementGuards.js")
    ).default;

    await expect(
      guards.voidSupplierPayable(
        null,
        { id: payableId, reason: "duplicate" },
        { user: { id: "user-1" } },
      ),
    ).rejects.toThrow(/reverse the payments first/i);
    expect(baseMutationMocks.voidSupplierPayable).not.toHaveBeenCalled();
  });

  it("requires exactly one real target for manual bank matching", async () => {
    modelMocks.BankTransaction.findById.mockResolvedValue(bank());
    const guards = (
      await import("../../graphql/resolvers/payment/transactionManagementGuards.js")
    ).default;

    await expect(
      guards.manuallyMatchBankTransaction(
        null,
        {
          input: {
            bankTransactionId,
            forceMatch: true,
            note: "force without target",
          },
        },
        { user: { id: "user-1" } },
      ),
    ).rejects.toThrow(/exactly one payment/i);

    await expect(
      guards.manuallyMatchBankTransaction(
        null,
        {
          input: {
            bankTransactionId,
            paymentSessionId,
            paymentTransactionId: otherTransactionId,
          },
        },
        { user: { id: "user-1" } },
      ),
    ).rejects.toThrow(/exactly one payment/i);

    await guards.manuallyMatchBankTransaction(
      null,
      { input: { bankTransactionId, paymentSessionId } },
      { user: { id: "user-1" } },
    );
    expect(baseMutationMocks.manuallyMatchBankTransaction).toHaveBeenCalled();
  });

  it("keeps terminal bank decisions idempotent and prevents overwrite", async () => {
    const existing = { _id: "reconciliation", status: "matched" };
    modelMocks.BankTransaction.findById.mockResolvedValue(
      bank({ matchStatus: "matched" }),
    );
    modelMocks.PaymentReconciliation.findOne.mockResolvedValue(existing);
    const guards = (
      await import("../../graphql/resolvers/payment/transactionManagementGuards.js")
    ).default;

    await expect(
      guards.reconcileBankTransaction(
        null,
        { bankTransactionId },
        { user: { id: "user-1" } },
      ),
    ).resolves.toBe(existing);
    expect(baseMutationMocks.reconcileBankTransaction).not.toHaveBeenCalled();

    await expect(
      guards.ignoreBankTransaction(
        null,
        { id: bankTransactionId, reason: "ignore matched" },
        { user: { id: "user-1" } },
      ),
    ).rejects.toThrow(/cannot be ignored/i);
    expect(baseMutationMocks.ignoreBankTransaction).not.toHaveBeenCalled();
  });
});
