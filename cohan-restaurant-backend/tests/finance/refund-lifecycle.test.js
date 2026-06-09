import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: { updateMany: vi.fn() },
  Invoice: { findById: vi.fn() },
  PaymentTransaction: { find: vi.fn(), findById: vi.fn() },
  Cashflow: { create: vi.fn(), findById: vi.fn(), findOne: vi.fn() },
  EventLog: { create: vi.fn() },
  Table: {}, Restaurant: {}, PaymentSession: {}, BankTransaction: {}, PaymentReconciliation: {}, SupplierPayable: {}, Coupon: {}, CouponRedemption: {}, Promotion: {}, UserCoupon: {},
  PaymentRefund: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
}));
const permissionMocks = vi.hoisted(() => ({ requireFinanceWrite: vi.fn(), requireReconciliationWrite: vi.fn(), requireRefundWrite: vi.fn() }));
const auditMocks = vi.hoisted(() => ({ writeFinanceAudit: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/finance/financePermission.service.js", () => permissionMocks);
vi.mock("../../src/services/finance/financeAudit.service.js", () => auditMocks);
vi.mock("../../src/services/payment/paymentSession.service.js", () => ({ cancelPaymentSession: vi.fn(), createOrderPayment: vi.fn(), createReservationPayment: vi.fn(), sanitizePaymentSessionForClient: vi.fn((x) => x) }));
vi.mock("../../src/services/discountCalculation.service.js", () => ({ calculateDiscountBreakdown: vi.fn() }));
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({ emitOrderEvent: vi.fn(), emitRestaurantEvent: vi.fn() }));
vi.mock("../../utils/generateInvoiceNumber.ts", () => ({ generateInvoiceNumber: vi.fn(() => "INV-TEST") }));
vi.mock("../../src/services/finance/reconciliationMatching.service.js", () => ({ chooseAutoMatch: vi.fn(), findReconciliationCandidates: vi.fn(), serializeCandidates: vi.fn((x) => x || []) }));

const restaurantId = "64b000000000000000000001";
const userId = "64b000000000000000000099";
const paymentTransactionId = "64b0000000000000000000aa";
const invoiceId = "64b0000000000000000000ab";
const orderId = "64b0000000000000000000ac";
const refundId = "64b0000000000000000000dd";
const cashflowId = "64b0000000000000000000cc";

const leanRows = (rows) => ({ lean: vi.fn().mockResolvedValue(rows) });
function refundDoc(overrides = {}) {
  return {
    _id: refundId,
    restaurantId,
    paymentTransactionId,
    invoiceId,
    orderId,
    amount: 400,
    currency: "VND",
    reason: "Khách hủy món",
    method: "cash",
    status: "pending",
    auditTrail: [],
    save: vi.fn().mockResolvedValue(undefined),
    toObject() { return { ...this }; },
    ...overrides,
  };
}

describe("UC18 refund lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    permissionMocks.requireRefundWrite.mockResolvedValue(true);
    auditMocks.writeFinanceAudit.mockResolvedValue(undefined);
    modelMocks.EventLog.create.mockReturnValue({ catch: vi.fn() });
    modelMocks.PaymentTransaction.find.mockReturnValue(leanRows([{ _id: paymentTransactionId, paidAmount: 1000, status: "SUCCESS" }]));
    modelMocks.PaymentRefund.find.mockReturnValue(leanRows([]));
    modelMocks.Cashflow.findById.mockResolvedValue(null);
    modelMocks.Cashflow.findOne.mockResolvedValue(null);
    modelMocks.Cashflow.create.mockResolvedValue({ _id: cashflowId });
    modelMocks.Invoice.findById.mockResolvedValue({ paid: 1000, totals: { grandTotal: 1000 }, meta: {}, save: vi.fn().mockResolvedValue(undefined) });
    modelMocks.PaymentTransaction.findById.mockResolvedValue({ _id: paymentTransactionId, paidAmount: 1000, refundedAmount: 0, refundIds: [], meta: {}, save: vi.fn().mockResolvedValue(undefined) });
    modelMocks.Order.updateMany.mockResolvedValue({ modifiedCount: 1 });
  });

  it("validates refund creation against successful paid amount and existing active refunds", async () => {
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    modelMocks.PaymentTransaction.find.mockReturnValueOnce(leanRows([]));
    await expect(PaymentMutation.createRefundRequest(null, { input: { restaurantId, paymentTransactionId, amount: 100, reason: "x" } }, { user: { id: userId } })).rejects.toThrow(/No successful payment/i);

    await expect(PaymentMutation.createRefundRequest(null, { input: { restaurantId, paymentTransactionId, amount: 0, reason: "x" } }, { user: { id: userId } })).rejects.toThrow(/greater than zero/i);

    modelMocks.PaymentTransaction.find.mockReturnValue(leanRows([{ paidAmount: 1000, status: "SUCCESS" }]));
    modelMocks.PaymentRefund.find.mockReturnValueOnce(leanRows([{ amount: 900, status: "approved" }]));
    await expect(PaymentMutation.createRefundRequest(null, { input: { restaurantId, paymentTransactionId, amount: 200, reason: "x" } }, { user: { id: userId } })).rejects.toThrow(/exceeds paid amount/i);
  });

  it("approves only pending refunds and records approval metadata", async () => {
    const pending = refundDoc({ status: "pending" });
    modelMocks.PaymentRefund.findById.mockResolvedValue(pending);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.approveRefundRequest(null, { id: refundId }, { user: { id: userId } });

    expect(result.status).toBe("approved");
    expect(result.approvedBy).toBeTruthy();
    expect(result.approvedAt).toBeInstanceOf(Date);
    expect(result.auditTrail).toEqual(expect.arrayContaining([expect.objectContaining({ action: "refund.approve" })]));

    modelMocks.PaymentRefund.findById.mockResolvedValue(refundDoc({ status: "success" }));
    await expect(PaymentMutation.approveRefundRequest(null, { id: refundId }, { user: { id: userId } })).rejects.toThrow(/pending refund/i);
  });

  it("requires approval unless skipApproval is authorized with reason", async () => {
    modelMocks.PaymentRefund.findById.mockResolvedValue(refundDoc({ status: "pending" }));
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    await expect(PaymentMutation.processRefundRequest(null, { id: refundId, input: {} }, { user: { id: userId, roleName: "manager" } })).rejects.toThrow(/must be approved/i);
    await expect(PaymentMutation.processRefundRequest(null, { id: refundId, input: { skipApproval: true } }, { user: { id: userId, roleName: "admin" } })).rejects.toThrow(/must be approved/i);
  });

  it("processes approved refund to success, creates one refund cashflow and updates invoice/payment/order metadata idempotently", async () => {
    const approved = refundDoc({ status: "approved" });
    const transactionDoc = { _id: paymentTransactionId, paidAmount: 1000, refundedAmount: 0, refundIds: [], meta: {}, save: vi.fn().mockResolvedValue(undefined) };
    const invoiceDoc = { paid: 1000, totals: { grandTotal: 1000 }, meta: {}, save: vi.fn().mockResolvedValue(undefined) };
    modelMocks.PaymentRefund.findById.mockResolvedValue(approved);
    modelMocks.PaymentTransaction.findById.mockResolvedValue(transactionDoc);
    modelMocks.Invoice.findById.mockResolvedValue(invoiceDoc);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.processRefundRequest(null, { id: refundId, input: { note: "done" } }, { user: { id: userId, roleName: "accountant" } });
    const second = await PaymentMutation.processRefundRequest(null, { id: refundId, input: { note: "double click" } }, { user: { id: userId, roleName: "accountant" } });

    expect(result.status).toBe("success");
    expect(second.status).toBe("success");
    expect(modelMocks.Cashflow.create).toHaveBeenCalledTimes(1);
    expect(modelMocks.Cashflow.create).toHaveBeenCalledWith(expect.objectContaining({
      type: "OUTFLOW",
      category: "refund",
      source: "refund",
      ref: expect.objectContaining({ kind: "PaymentRefund", refundId: expect.anything() }),
    }));
    expect(invoiceDoc.paid).toBe(600);
    expect(invoiceDoc.status).toBe("PARTIAL");
    expect(transactionDoc.refundedAmount).toBe(400);
    expect(transactionDoc.refundStatus).toBe("partial_refunded");
    expect(transactionDoc.refundIds.map(String)).toContain(refundId);
    expect(modelMocks.Order.updateMany).toHaveBeenCalled();
  });

  it("supports authorized skip approval from pending and cancel/reject/retry state guards", async () => {
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    modelMocks.PaymentRefund.findById.mockResolvedValue(refundDoc({ status: "pending" }));
    await expect(PaymentMutation.processRefundRequest(null, { id: refundId, input: { skipApproval: true, reason: "admin override" } }, { user: { id: userId, roleName: "admin" } })).resolves.toEqual(expect.objectContaining({ status: "success" }));

    const cancellable = refundDoc({ status: "approved" });
    modelMocks.PaymentRefund.findById.mockResolvedValue(cancellable);
    await expect(PaymentMutation.cancelRefundRequest(null, { id: refundId, reason: "duplicate" }, { user: { id: userId } })).resolves.toEqual(expect.objectContaining({ status: "cancelled" }));

    modelMocks.PaymentRefund.findById.mockResolvedValue(refundDoc({ status: "success" }));
    await expect(PaymentMutation.cancelRefundRequest(null, { id: refundId, reason: "x" }, { user: { id: userId } })).rejects.toThrow(/cannot be cancelled/i);
    await expect(PaymentMutation.rejectRefundRequest(null, { id: refundId, reason: "x" }, { user: { id: userId } })).rejects.toThrow(/cannot be rejected/i);

    modelMocks.PaymentRefund.findById.mockResolvedValue(refundDoc({ status: "approved" }));
    await expect(PaymentMutation.retryRefundRequest(null, { id: refundId, input: {} }, { user: { id: userId } })).rejects.toThrow(/Only failed/i);
  });
});
