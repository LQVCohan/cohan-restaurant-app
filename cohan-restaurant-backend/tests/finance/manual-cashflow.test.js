import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {}, Invoice: {}, PaymentTransaction: {}, EventLog: {}, Table: {}, Restaurant: {}, PaymentSession: {}, BankTransaction: {}, PaymentReconciliation: {}, PaymentRefund: {}, SupplierPayable: {}, Coupon: {}, CouponRedemption: {}, Promotion: {}, UserCoupon: {},
  Cashflow: { create: vi.fn(), findById: vi.fn(), findOne: vi.fn() },
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
const cashflowId = "64b0000000000000000000cf";

function cashflowDoc(overrides = {}) {
  return {
    _id: cashflowId,
    restaurantId,
    source: "manual",
    ref: { kind: "ManualCashflow" },
    status: "draft",
    type: "OUTFLOW",
    amount: 100,
    category: "operations",
    subcategory: "utility",
    method: "cash",
    toObject() { return { ...this }; },
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("UC18 manual cashflow mutations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    permissionMocks.requireFinanceWrite.mockResolvedValue(true);
    auditMocks.writeFinanceAudit.mockResolvedValue(undefined);
  });

  it("creates manual INFLOW/OUTFLOW with source, reference, actor and audit", async () => {
    const created = { _id: cashflowId, amount: 500, status: "completed", toObject: () => ({ _id: cashflowId }) };
    modelMocks.Cashflow.create.mockResolvedValue(created);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    await PaymentMutation.createManualCashflow(null, { input: { restaurantId, type: "INFLOW", amount: 500, category: "sale", subcategory: "other", method: "cash", status: "completed", note: "Thu ngoài hệ thống" } }, { user: { id: userId } });

    expect(modelMocks.Cashflow.create).toHaveBeenCalledWith(expect.objectContaining({ source: "manual", ref: { kind: "ManualCashflow" }, createdBy: expect.anything(), type: "INFLOW" }));
    expect(auditMocks.writeFinanceAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "finance.cashflow.create" }));
  });

  it("updates only manual draft/pending cashflows", async () => {
    const doc = cashflowDoc({ status: "pending" });
    modelMocks.Cashflow.findById.mockResolvedValue(doc);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.updateManualCashflow(null, { id: cashflowId, input: { amount: 250, note: "updated" } }, { user: { id: userId } });

    expect(result.amount).toBe(250);
    expect(result.note).toBe("updated");
    expect(doc.save).toHaveBeenCalled();

    modelMocks.Cashflow.findById.mockResolvedValue(cashflowDoc({ status: "completed" }));
    await expect(PaymentMutation.updateManualCashflow(null, { id: cashflowId, input: { amount: 1 } }, { user: { id: userId } })).rejects.toThrow(/draft\/pending/i);

    modelMocks.Cashflow.findById.mockResolvedValue(cashflowDoc({ source: "order", ref: { kind: "PaymentTransaction" }, status: "pending" }));
    await expect(PaymentMutation.updateManualCashflow(null, { id: cashflowId, input: { amount: 1 } }, { user: { id: userId } })).rejects.toThrow(/Only manual cashflow/i);
  });

  it("voids manual cashflow only with reason and marks void metadata", async () => {
    const doc = cashflowDoc({ status: "completed" });
    modelMocks.Cashflow.findById.mockResolvedValue(doc);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    await expect(PaymentMutation.voidManualCashflow(null, { id: cashflowId, reason: "" }, { user: { id: userId } })).rejects.toThrow(/reason is required/i);
    const result = await PaymentMutation.voidManualCashflow(null, { id: cashflowId, reason: "Sai chứng từ" }, { user: { id: userId } });

    expect(result.status).toBe("voided");
    expect(result.voidReason).toBe("Sai chứng từ");
    expect(result.voidedBy).toBeTruthy();
    expect(result.voidedAt).toBeInstanceOf(Date);
  });

  it("blocks user without finance write permission", async () => {
    permissionMocks.requireFinanceWrite.mockRejectedValue(new Error("Forbidden"));
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;
    await expect(PaymentMutation.createManualCashflow(null, { input: { restaurantId, type: "OUTFLOW", amount: 100, category: "operations", subcategory: "utility", method: "cash" } }, { user: { id: userId } })).rejects.toThrow("Forbidden");
  });
});
