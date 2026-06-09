import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {}, Invoice: {}, PaymentTransaction: { findOne: vi.fn() }, Cashflow: {}, EventLog: {}, Table: {}, Restaurant: {}, SupplierPayable: {}, Coupon: {}, CouponRedemption: {}, Promotion: {}, UserCoupon: {}, PaymentRefund: {},
  PaymentSession: { findOne: vi.fn() },
  BankTransaction: { findById: vi.fn(), findByIdAndUpdate: vi.fn() },
  PaymentReconciliation: { findOneAndUpdate: vi.fn(), findById: vi.fn() },
}));
const permissionMocks = vi.hoisted(() => ({ requireFinanceWrite: vi.fn(), requireReconciliationWrite: vi.fn(), requireRefundWrite: vi.fn() }));
const auditMocks = vi.hoisted(() => ({ writeFinanceAudit: vi.fn() }));
const matchingMocks = vi.hoisted(() => ({ chooseAutoMatch: vi.fn(), findReconciliationCandidates: vi.fn(), serializeCandidates: vi.fn((x) => x || []) }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/finance/financePermission.service.js", () => permissionMocks);
vi.mock("../../src/services/finance/financeAudit.service.js", () => auditMocks);
vi.mock("../../src/services/finance/reconciliationMatching.service.js", () => matchingMocks);
vi.mock("../../src/services/payment/paymentSession.service.js", () => ({ cancelPaymentSession: vi.fn(), createOrderPayment: vi.fn(), createReservationPayment: vi.fn(), sanitizePaymentSessionForClient: vi.fn((x) => x) }));
vi.mock("../../src/services/discountCalculation.service.js", () => ({ calculateDiscountBreakdown: vi.fn() }));
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({ emitOrderEvent: vi.fn(), emitRestaurantEvent: vi.fn() }));
vi.mock("../../utils/generateInvoiceNumber.ts", () => ({ generateInvoiceNumber: vi.fn(() => "INV-TEST") }));

const restaurantId = "64b000000000000000000001";
const userId = "64b000000000000000000099";
const bankTransactionId = "64b0000000000000000000ba";
const paymentSessionId = "64b0000000000000000000ad";
const reconciliationId = "64b0000000000000000000ae";

const leanDoc = (doc) => ({ lean: vi.fn().mockResolvedValue(doc) });
function bankDoc(overrides = {}) {
  return {
    _id: bankTransactionId,
    restaurantId,
    provider: "VCB",
    amount: 500000,
    transactionId: "BTX-1",
    transferContent: "PAYREF123456",
    matchStatus: "unmatched",
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
function reconciliationFromUpdate(_filter, update) {
  return Promise.resolve({ _id: reconciliationId, ...update.$set, auditTrail: [update.$push.auditTrail] });
}

describe("UC18 bank reconciliation mutations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    permissionMocks.requireReconciliationWrite.mockResolvedValue(true);
    auditMocks.writeFinanceAudit.mockResolvedValue(undefined);
    modelMocks.PaymentReconciliation.findOneAndUpdate.mockImplementation(reconciliationFromUpdate);
    modelMocks.PaymentSession.findOne.mockReturnValue(leanDoc({ _id: paymentSessionId, restaurantId, reference: "PAYREF123456", amount: 500000 }));
    modelMocks.PaymentTransaction.findOne.mockReturnValue(leanDoc(null));
    matchingMocks.findReconciliationCandidates.mockResolvedValue({ reason: "exact_reference", candidates: [] });
    matchingMocks.serializeCandidates.mockImplementation((x) => x || []);
  });

  it("auto matches exact reference and amount with confidence 100", async () => {
    const bank = bankDoc({ amount: 500000 });
    modelMocks.BankTransaction.findById.mockResolvedValue(bank);
    const candidate = { kind: "PaymentSession", id: paymentSessionId, paymentSessionId, reference: "PAYREF123456", expectedAmount: 500000, confidence: 100, reason: "exact_reference+amount" };
    matchingMocks.findReconciliationCandidates.mockResolvedValue({ reason: "exact_reference", candidates: [candidate] });
    matchingMocks.chooseAutoMatch.mockReturnValue(candidate);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.reconcileBankTransaction(null, { bankTransactionId }, { user: { id: userId } });

    expect(result.status).toBe("matched");
    expect(result.matchConfidence).toBe(100);
    expect(bank.matchStatus).toBe("matched");
  });

  it("marks amount_mismatch with variance when exact reference amount differs", async () => {
    const bank = bankDoc({ amount: 520000 });
    modelMocks.BankTransaction.findById.mockResolvedValue(bank);
    const candidate = { kind: "PaymentSession", id: paymentSessionId, paymentSessionId, reference: "PAYREF123456", expectedAmount: 500000, confidence: 95, reason: "exact_reference+amount_mismatch" };
    matchingMocks.findReconciliationCandidates.mockResolvedValue({ reason: "exact_reference", candidates: [candidate] });
    matchingMocks.chooseAutoMatch.mockReturnValue(candidate);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.reconcileBankTransaction(null, { bankTransactionId }, { user: { id: userId } });

    expect(result.status).toBe("amount_mismatch");
    expect(result.varianceAmount).toBe(20000);
    expect(result.matchConfidence).toBe(95);
  });

  it("does not auto match empty or low-confidence content", async () => {
    const bank = bankDoc({ transferContent: "", description: "", transactionId: "", amount: 500000 });
    modelMocks.BankTransaction.findById.mockResolvedValue(bank);
    matchingMocks.findReconciliationCandidates.mockResolvedValue({ reason: "no_reliable_reference_token", candidates: [] });
    matchingMocks.chooseAutoMatch.mockReturnValue(null);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.reconcileBankTransaction(null, { bankTransactionId }, { user: { id: userId } });

    expect(result.status).toBe("unmatched");
    expect(result.matchReason).toBe("no_reliable_reference_token");
    expect(bank.matchStatus).toBe("unmatched");
  });

  it("validates manual match and allows force match only with note", async () => {
    modelMocks.BankTransaction.findById.mockResolvedValue(bankDoc());
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    await expect(PaymentMutation.manuallyMatchBankTransaction(null, { input: { bankTransactionId, forceMatch: false } }, { user: { id: userId } })).rejects.toThrow(/Select a payment/i);
    await expect(PaymentMutation.manuallyMatchBankTransaction(null, { input: { bankTransactionId, forceMatch: true, note: "" } }, { user: { id: userId } })).rejects.toThrow(/requires note/i);

    const matched = await PaymentMutation.manuallyMatchBankTransaction(null, { input: { bankTransactionId, paymentSessionId, note: "Khớp theo sao kê" } }, { user: { id: userId } });
    expect(matched.status).toBe("matched");
    expect(matched.matchedBy).toBe("manual");
  });

  it("resolves mismatch with note and updates bank transaction status", async () => {
    const reconciliation = { _id: reconciliationId, restaurantId, bankTransactionId, status: "amount_mismatch", auditTrail: [], save: vi.fn().mockResolvedValue(undefined) };
    modelMocks.PaymentReconciliation.findById.mockResolvedValue(reconciliation);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    await expect(PaymentMutation.resolveReconciliation(null, { input: { reconciliationId, resolution: "accept_mismatch", note: "" } }, { user: { id: userId } })).rejects.toThrow(/note is required/i);
    const result = await PaymentMutation.resolveReconciliation(null, { input: { reconciliationId, resolution: "accept_mismatch", note: "Chấp nhận lệch phí" } }, { user: { id: userId } });

    expect(result.status).toBe("resolved");
    expect(result.resolution).toBe("accept_mismatch");
    expect(result.resolvedBy).toBeTruthy();
    expect(result.resolvedAt).toBeInstanceOf(Date);
    expect(modelMocks.BankTransaction.findByIdAndUpdate).toHaveBeenCalledWith(bankTransactionId, { $set: { matchStatus: "resolved" } });
  });

  it("ignores bank transaction with reason through idempotent upsert", async () => {
    const bank = bankDoc();
    modelMocks.BankTransaction.findById.mockResolvedValue(bank);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    await expect(PaymentMutation.ignoreBankTransaction(null, { id: bankTransactionId, reason: "" }, { user: { id: userId } })).rejects.toThrow(/reason is required/i);
    await PaymentMutation.ignoreBankTransaction(null, { id: bankTransactionId, reason: "Nội bộ test" }, { user: { id: userId } });

    expect(bank.matchStatus).toBe("ignored");
    expect(modelMocks.PaymentReconciliation.findOneAndUpdate).toHaveBeenCalledWith(
      { bankTransactionId: bank._id },
      expect.objectContaining({ $set: expect.objectContaining({ status: "ignored", note: "Nội bộ test" }) }),
      expect.objectContaining({ upsert: true }),
    );
  });
});
