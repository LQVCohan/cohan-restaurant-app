import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Order: {},
  Invoice: {},
  PaymentTransaction: {},
  Cashflow: { create: vi.fn(), findById: vi.fn() },
  EventLog: {},
  Table: {},
  Restaurant: {},
  PaymentSession: {},
  BankTransaction: {},
  PaymentReconciliation: {},
  PaymentRefund: {},
  SupplierPayable: { create: vi.fn(), findById: vi.fn() },
  Coupon: {},
  CouponRedemption: {},
  Promotion: {},
  UserCoupon: {},
}));

const permissionMocks = vi.hoisted(() => ({
  requireFinanceWrite: vi.fn(),
  requireReconciliationWrite: vi.fn(),
  requireRefundWrite: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({ writeFinanceAudit: vi.fn() }));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/finance/financePermission.service.js", () => permissionMocks);
vi.mock("../../src/services/finance/financeAudit.service.js", () => auditMocks);
vi.mock("../../src/services/payment/paymentSession.service.js", () => ({
  cancelPaymentSession: vi.fn(),
  createOrderPayment: vi.fn(),
  createReservationPayment: vi.fn(),
  sanitizePaymentSessionForClient: vi.fn((x) => x),
}));
vi.mock("../../src/services/discountCalculation.service.js", () => ({ calculateDiscountBreakdown: vi.fn() }));
vi.mock("../../graphql/resolvers/order/helper/emitOrderEvent.js", () => ({ emitOrderEvent: vi.fn(), emitRestaurantEvent: vi.fn() }));
vi.mock("../../utils/generateInvoiceNumber.ts", () => ({ generateInvoiceNumber: vi.fn(() => "INV-TEST") }));
vi.mock("../../src/services/finance/reconciliationMatching.service.js", () => ({
  chooseAutoMatch: vi.fn(),
  findReconciliationCandidates: vi.fn(),
  serializeCandidates: vi.fn((x) => x || []),
}));
vi.mock("mongoose", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, startSession: vi.fn() };
});

const restaurantId = "64b000000000000000000001";
const userId = "64b000000000000000000099";
const payableId = "64b0000000000000000000aa";
const cashflowId = "64b0000000000000000000bb";

function payableDoc(overrides = {}) {
  return {
    _id: payableId,
    restaurantId,
    supplierName: "Công ty Rau Sạch",
    sourceKind: "inventory",
    amount: 900000,
    paidAmount: 200000,
    remainingAmount: 700000,
    status: "partial",
    cashflowIds: [],
    auditTrail: [],
    toObject() { return { ...this }; },
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("UC18 finance mutation resolvers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    permissionMocks.requireFinanceWrite.mockResolvedValue(true);
    auditMocks.writeFinanceAudit.mockResolvedValue(undefined);
    modelMocks.Cashflow.create.mockResolvedValue({ _id: cashflowId, toObject: () => ({ _id: cashflowId }) });
  });

  it("creates supplier payable with remaining amount and audit metadata", async () => {
    const created = { _id: payableId, amount: 1200000, paidAmount: 200000, remainingAmount: 1000000, toObject: () => ({ _id: payableId }) };
    modelMocks.SupplierPayable.create.mockResolvedValue(created);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.createSupplierPayable(null, {
      input: { restaurantId, supplierName: "Nhà cung cấp Hải Sản", sourceKind: "manual", amount: 1200000, paidAmount: 200000, note: "Mua ngoài" },
    }, { user: { id: userId } });

    expect(result).toBe(created);
    expect(permissionMocks.requireFinanceWrite).toHaveBeenCalled();
    expect(modelMocks.SupplierPayable.create).toHaveBeenCalledWith(expect.objectContaining({
      supplierName: "Nhà cung cấp Hải Sản",
      amount: 1200000,
      paidAmount: 200000,
      remainingAmount: 1000000,
      auditTrail: expect.arrayContaining([expect.objectContaining({ action: "supplier_payable.create" })]),
    }));
    expect(auditMocks.writeFinanceAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "supplier_payable.create" }));
  });

  it("records partial supplier payment, creates OUTFLOW cashflow and keeps status partial", async () => {
    const doc = payableDoc();
    modelMocks.SupplierPayable.findById.mockResolvedValue(doc);
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    const result = await PaymentMutation.recordSupplierPayment(null, {
      id: payableId,
      input: { amount: 300000, method: "bank_transfer", paidAt: "2026-06-03", note: "Thanh toán một phần" },
    }, { user: { id: userId } });

    expect(result.paidAmount).toBe(500000);
    expect(result.remainingAmount).toBe(400000);
    expect(result.status).toBe("partial");
    expect(modelMocks.Cashflow.create).toHaveBeenCalledWith(expect.objectContaining({
      type: "OUTFLOW",
      amount: 300000,
      category: "inventory",
      subcategory: "cogs",
      ref: expect.objectContaining({ kind: "SupplierPayable" }),
      note: "Thanh toán một phần",
    }));
    expect(doc.save).toHaveBeenCalled();
    expect(auditMocks.writeFinanceAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "supplier_payable.payment" }));
  });

  it("blocks supplier payment that exceeds remaining amount and requires void reason", async () => {
    modelMocks.SupplierPayable.findById.mockResolvedValue(payableDoc());
    const PaymentMutation = (await import("../../graphql/resolvers/payment/mutation.js")).default;

    await expect(PaymentMutation.recordSupplierPayment(null, { id: payableId, input: { amount: 800000 } }, { user: { id: userId } }))
      .rejects.toThrow(/exceeds payable remaining/i);
    await expect(PaymentMutation.voidSupplierPayable(null, { id: payableId, reason: "" }, { user: { id: userId } }))
      .rejects.toThrow(/reason is required/i);
  });
});
