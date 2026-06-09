import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {}, Invoice: {}, PaymentTransaction: {}, EventLog: {}, Table: {}, Restaurant: {}, PaymentSession: {}, BankTransaction: {}, PaymentReconciliation: {}, PaymentRefund: {}, Coupon: {}, CouponRedemption: {}, Promotion: {}, UserCoupon: {},
  Cashflow: { create: vi.fn() },
  SupplierPayable: { create: vi.fn(), findById: vi.fn() },
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
const payableId = "64b0000000000000000000aa";
const cashflowId = "64b0000000000000000000cf";

function payableDoc(overrides = {}) {
  return {
    _id: payableId,
    restaurantId,
    supplierName: "Công ty Rau Sạch",
    supplierId: null,
    sourceKind: "inventory",
    amount: 1000,
    paidAmount: 0,
    remainingAmount: 1000,
    dueDate: new Date("2030-01-01"),
    status: "unpaid",
    cashflowIds: [],
    auditTrail: [],
    toObject() { return { ...this }; },
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("UC18 supplier payable lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    permissionMocks.requireFinanceWrite.mockResolvedValue(true);
    auditMocks.writeFinanceAudit.mockResolvedValue(undefined);
    modelMocks.Cashflow.create.mockResolvedValue({ _id: cashflowId });
  });

  it("creates unpaid, partial and overdue payables and rejects invalid paidAmount", async () => {
    modelMocks.SupplierPayable.create.mockImplementation((payload) => Promise.resolve({ _id: payableId, ...payload, toObject: () => payload }));
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const unpaid = await PaymentMutation.createSupplierPayable(null, { input: { restaurantId, supplierName: "A", amount: 1000, paidAmount: 0, dueDate: "2030-01-01" } }, { user: { id: userId } });
    const partial = await PaymentMutation.createSupplierPayable(null, { input: { restaurantId, supplierName: "B", amount: 1000, paidAmount: 200, dueDate: "2030-01-01" } }, { user: { id: userId } });
    const overdue = await PaymentMutation.createSupplierPayable(null, { input: { restaurantId, supplierName: "C", amount: 1000, paidAmount: 0, dueDate: "2020-01-01" } }, { user: { id: userId } });

    expect(unpaid.status).toBe("unpaid");
    expect(partial.status).toBe("partial");
    expect(overdue.status).toBe("overdue");
    expect(unpaid.auditTrail[0].action).toBe("supplier_payable.create");
    await expect(PaymentMutation.createSupplierPayable(null, { input: { restaurantId, supplierName: "Bad", amount: 1000, paidAmount: 1001 } }, { user: { id: userId } })).rejects.toThrow(/Paid amount cannot exceed/i);
  });

  it("updates open payables, recalculates remaining/status and blocks paid/voided edits", async () => {
    const doc = payableDoc({ status: "unpaid", paidAmount: 0 });
    modelMocks.SupplierPayable.findById.mockResolvedValue(doc);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.updateSupplierPayable(null, { id: payableId, input: { amount: 1200, paidAmount: 400, note: "updated" } }, { user: { id: userId } });

    expect(result.remainingAmount).toBe(800);
    expect(result.status).toBe("partial");
    expect(result.auditTrail).toEqual(expect.arrayContaining([expect.objectContaining({ action: "supplier_payable.update" })]));

    modelMocks.SupplierPayable.findById.mockResolvedValue(payableDoc({ status: "paid", remainingAmount: 0 }));
    await expect(PaymentMutation.updateSupplierPayable(null, { id: payableId, input: { amount: 1 } }, { user: { id: userId } })).rejects.toThrow(/cannot be edited/i);
    modelMocks.SupplierPayable.findById.mockResolvedValue(payableDoc({ status: "voided" }));
    await expect(PaymentMutation.updateSupplierPayable(null, { id: payableId, input: { amount: 1 } }, { user: { id: userId } })).rejects.toThrow(/cannot be edited/i);
  });

  it("records partial/full payments, creates supplier cashflow and rejects overpayment", async () => {
    const partialDoc = payableDoc({ amount: 1000, paidAmount: 100, remainingAmount: 900, status: "partial", sourceKind: "inventory" });
    modelMocks.SupplierPayable.findById.mockResolvedValue(partialDoc);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const partial = await PaymentMutation.recordSupplierPayment(null, { id: payableId, input: { amount: 400, method: "bank_transfer", note: "partial" } }, { user: { id: userId } });
    expect(partial.status).toBe("partial");
    expect(partial.remainingAmount).toBe(500);
    expect(modelMocks.Cashflow.create).toHaveBeenCalledWith(expect.objectContaining({ source: "manual", category: "inventory", subcategory: "cogs", ref: expect.objectContaining({ kind: "SupplierPayable" }) }));
    expect(partial.cashflowIds.map(String)).toContain(cashflowId);
    expect(partial.auditTrail).toEqual(expect.arrayContaining([expect.objectContaining({ action: "supplier_payable.payment" })]));

    const fullDoc = payableDoc({ amount: 1000, paidAmount: 500, remainingAmount: 500, status: "partial", sourceKind: "manual" });
    modelMocks.SupplierPayable.findById.mockResolvedValue(fullDoc);
    const full = await PaymentMutation.recordSupplierPayment(null, { id: payableId, input: { amount: 500, method: "cash", note: "full" } }, { user: { id: userId } });
    expect(full.status).toBe("paid");

    modelMocks.SupplierPayable.findById.mockResolvedValue(payableDoc({ remainingAmount: 100 }));
    await expect(PaymentMutation.recordSupplierPayment(null, { id: payableId, input: { amount: 101 } }, { user: { id: userId } })).rejects.toThrow(/exceeds payable remaining/i);
  });

  it("voids payable only with reason and audit trail", async () => {
    const doc = payableDoc();
    modelMocks.SupplierPayable.findById.mockResolvedValue(doc);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    await expect(PaymentMutation.voidSupplierPayable(null, { id: payableId, reason: "" }, { user: { id: userId } })).rejects.toThrow(/reason is required/i);
    const result = await PaymentMutation.voidSupplierPayable(null, { id: payableId, reason: "duplicate" }, { user: { id: userId } });

    expect(result.status).toBe("voided");
    expect(result.auditTrail).toEqual(expect.arrayContaining([expect.objectContaining({ action: "supplier_payable.void", reason: "duplicate" })]));
  });
});
