import { beforeEach, describe, expect, it, vi } from "vitest";

const ids = {
  restaurantId: "64b000000000000000000001",
  userId: "64b000000000000000000099",
  bankTransactionId: "64b0000000000000000000ba",
  paymentSessionId: "64b0000000000000000000ad",
};

const mutationMocks = vi.hoisted(() => ({
  reconcileBankTransaction: vi.fn(),
  manuallyMatchBankTransaction: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  BankTransaction: { findById: vi.fn() },
  PaymentSession: { findOne: vi.fn(), findById: vi.fn() },
}));

const paymentServiceMocks = vi.hoisted(() => ({
  settlePaidOrderPaymentSession: vi.fn(),
}));

const realtimeMocks = vi.hoisted(() => ({
  emitPaymentRealtime: vi.fn(),
}));

vi.mock("../../graphql/resolvers/payment/mutation.js", () => ({
  default: mutationMocks,
}));

vi.mock("../../models/index.js", () => modelMocks);

vi.mock("../../src/services/payment/paymentSession.service.js", () => ({
  settlePaidOrderPaymentSession: paymentServiceMocks.settlePaidOrderPaymentSession,
}));

vi.mock("../../src/services/payment/paymentRealtime.service.js", () => ({
  emitPaymentRealtime: realtimeMocks.emitPaymentRealtime,
}));

function paymentDoc(overrides = {}) {
  return {
    _id: ids.paymentSessionId,
    restaurantId: ids.restaurantId,
    userId: ids.userId,
    provider: "bank_transfer",
    paymentMethod: "bank_transfer",
    amount: 500000,
    status: "pending",
    callbackStatus: "none",
    reference: "ORD-20260624-ABC123",
    metadata: { orderIds: ["64b0000000000000000000c1"] },
    transfer: { status: "INSTRUCTIONS_SHOWN" },
    events: [],
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
      return { ...this };
    },
    ...overrides,
  };
}

function bankDoc(overrides = {}) {
  return {
    _id: ids.bankTransactionId,
    restaurantId: ids.restaurantId,
    amount: 500000,
    transactionId: "VCB-001",
    raw: { transactionId: "VCB-001" },
    matchedPaymentSessionId: ids.paymentSessionId,
    ...overrides,
  };
}

describe("reconciliation payment confirmation wrapper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    paymentServiceMocks.settlePaidOrderPaymentSession.mockResolvedValue({ invoiceId: "inv-1" });
    realtimeMocks.emitPaymentRealtime.mockResolvedValue(undefined);
  });

  it("confirms matched bank transfer payment, settles order, and emits realtime result", async () => {
    const payment = paymentDoc();
    mutationMocks.reconcileBankTransaction.mockResolvedValue({
      status: "matched",
      paymentSessionId: ids.paymentSessionId,
      expectedAmount: 500000,
      receivedAmount: 500000,
    });
    modelMocks.BankTransaction.findById.mockResolvedValue(bankDoc());
    modelMocks.PaymentSession.findOne.mockResolvedValue(payment);
    modelMocks.PaymentSession.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...payment, status: "success" }),
    });

    const wrapper = (await import("../../graphql/resolvers/payment/reconciliationPaymentConfirmationMutation.js")).default;
    const io = { to: vi.fn(() => ({ emit: vi.fn() })) };
    const result = await wrapper.reconcileBankTransaction(null, { bankTransactionId: ids.bankTransactionId }, { io });

    expect(result.status).toBe("matched");
    expect(result.paymentConfirmation).toEqual({ status: "success", paymentSessionId: ids.paymentSessionId });
    expect(payment.status).toBe("success");
    expect(payment.callbackStatus).toBe("verified");
    expect(payment.providerTransactionId).toBe("VCB-001");
    expect(payment.transfer.status).toBe("VERIFIED");
    expect(payment.transfer.receivedAmount).toBe(500000);
    expect(payment.save).toHaveBeenCalledTimes(1);
    expect(paymentServiceMocks.settlePaidOrderPaymentSession).toHaveBeenCalledWith({
      payment,
      source: "bank_reconciliation_auto",
    });
    expect(realtimeMocks.emitPaymentRealtime).toHaveBeenCalledWith(expect.objectContaining({
      io,
      eventType: "PAYMENT_VERIFIED",
      message: "Thanh toán chuyển khoản đã được đối soát và xác nhận.",
    }));
  });

  it("does not confirm payment when reconciliation is amount_mismatch", async () => {
    mutationMocks.manuallyMatchBankTransaction.mockResolvedValue({
      status: "amount_mismatch",
      paymentSessionId: ids.paymentSessionId,
      expectedAmount: 500000,
      receivedAmount: 520000,
    });

    const wrapper = (await import("../../graphql/resolvers/payment/reconciliationPaymentConfirmationMutation.js")).default;
    const result = await wrapper.manuallyMatchBankTransaction(null, { input: { bankTransactionId: ids.bankTransactionId } }, {});

    expect(result.status).toBe("amount_mismatch");
    expect(modelMocks.PaymentSession.findOne).not.toHaveBeenCalled();
    expect(paymentServiceMocks.settlePaidOrderPaymentSession).not.toHaveBeenCalled();
    expect(realtimeMocks.emitPaymentRealtime).not.toHaveBeenCalled();
  });
});
