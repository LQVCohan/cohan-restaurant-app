import { beforeEach, describe, expect, it, vi } from "vitest";

const modelMocks = vi.hoisted(() => ({
  Invoice: { find: vi.fn() },
  PaymentTransaction: { find: vi.fn() },
  Cashflow: { find: vi.fn() },
  PaymentSession: { findById: vi.fn() },
  Order: { findById: vi.fn() },
  BankTransaction: { find: vi.fn(), aggregate: vi.fn() },
  PaymentReconciliation: { find: vi.fn(), aggregate: vi.fn() },
  PaymentRefund: { find: vi.fn(), findById: vi.fn() },
  SupplierPayable: { find: vi.fn() },
}));

const permissionMocks = vi.hoisted(() => ({
  requireFinanceRead: vi.fn(),
  requireTransactionRead: vi.fn(),
  requireReconciliationRead: vi.fn(),
  requireRefundRead: vi.fn(),
}));

vi.mock("../../models/index.js", () => modelMocks);
vi.mock("../../src/services/finance/financePermission.service.js", () => permissionMocks);
vi.mock("../../src/services/payment/paymentSession.service.js", () => ({
  getProviderPublicConfig: vi.fn(),
  sanitizePaymentSessionForClient: vi.fn((x) => x),
}));

const sortedLean = (rows) => ({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }) });
const sortedLimitLean = (rows) => ({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }) }) });
const lean = (rows) => ({ lean: vi.fn().mockResolvedValue(rows) });
const restaurantId = "64b000000000000000000001";

describe("UC18 finance dashboard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.values(permissionMocks).forEach((fn) => fn.mockResolvedValue(true));
    modelMocks.PaymentTransaction.find.mockReturnValue(sortedLean([]));
    modelMocks.PaymentReconciliation.find.mockReturnValue(sortedLimitLean([]));
    modelMocks.PaymentReconciliation.aggregate.mockResolvedValue([]);
    modelMocks.BankTransaction.aggregate.mockResolvedValue([]);
    modelMocks.BankTransaction.find.mockReturnValue(sortedLimitLean([]));
  });

  it("calculates revenue, expense, profit, receivable, payable, debt, overdue and excludes voided cashflow via query filter", async () => {
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");
    const activeCashflows = [
      { _id: "sale", type: "INFLOW", amount: 1500, status: "completed", category: "sale", subcategory: "other", occurredAt: new Date("2026-06-05") },
      { _id: "ops", type: "OUTFLOW", amount: 300, status: "completed", category: "operations", subcategory: "utility", occurredAt: new Date("2026-06-05") },
    ];
    modelMocks.Cashflow.find.mockImplementation((filter) => {
      expect(filter.status).toEqual({ $ne: "voided" });
      return sortedLean(activeCashflows);
    });
    modelMocks.Invoice.find
      .mockReturnValueOnce(sortedLean([]))
      .mockReturnValueOnce(lean([
        { _id: "inv-unpaid", status: "UNPAID", totals: { grandTotal: 800 }, paid: 0, dueDate: new Date("2020-01-01") },
        { _id: "inv-partial", status: "PARTIAL", totals: { grandTotal: 600 }, paid: 250, dueDate: new Date("2030-01-01") },
      ]));
    modelMocks.SupplierPayable.find.mockReturnValue(lean([
      { _id: "pay-unpaid", status: "unpaid", amount: 500, paidAmount: 0, remainingAmount: 500, dueDate: new Date("2030-01-01") },
      { _id: "pay-overdue", status: "overdue", amount: 700, paidAmount: 200, remainingAmount: 500, dueDate: new Date("2020-01-01") },
    ]));

    const result = await PaymentQuery.financeDashboard(null, { input: { restaurantId, dateFrom: "2026-06-01", dateTo: "2026-06-30" } }, { user: { id: "u1" } });

    expect(result.summary).toEqual(expect.objectContaining({
      revenue: 1500,
      cashIn: 1500,
      expense: 300,
      cashOut: 300,
      profit: 1200,
      receivable: 1150,
      payable: 1000,
      debt: 2150,
      overdue: 1300,
    }));
    expect(result.costBreakdown.operations).toBe(300);
  });

  it("prioritizes category/subcategory/ref.kind for cost buckets and only falls back to note for legacy data", async () => {
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");
    modelMocks.Cashflow.find.mockReturnValue(sortedLean([
      { _id: "cogs-category", type: "OUTFLOW", amount: 100, status: "completed", category: "inventory", subcategory: "cogs", note: "lương should not win", occurredAt: new Date("2026-06-05") },
      { _id: "labor-ref", type: "OUTFLOW", amount: 200, status: "completed", category: "other", subcategory: "other", ref: { kind: "PayrollPayment" }, note: "nguyên liệu should not win", occurredAt: new Date("2026-06-05") },
      { _id: "ops-sub", type: "OUTFLOW", amount: 300, status: "completed", category: "other", subcategory: "rent", occurredAt: new Date("2026-06-05") },
      { _id: "legacy-cogs", type: "OUTFLOW", amount: 40, status: "completed", note: "mua nguyên liệu", occurredAt: new Date("2026-06-05") },
      { _id: "legacy-labor", type: "OUTFLOW", amount: 50, status: "completed", note: "trả lương", occurredAt: new Date("2026-06-05") },
      { _id: "legacy-ops", type: "OUTFLOW", amount: 60, status: "completed", note: "điện nước", occurredAt: new Date("2026-06-05") },
    ]));
    modelMocks.Invoice.find.mockReturnValueOnce(sortedLean([])).mockReturnValueOnce(lean([]));
    modelMocks.SupplierPayable.find.mockReturnValue(lean([]));

    const result = await PaymentQuery.financeDashboard(null, { input: { restaurantId, dateFrom: "2026-06-01", dateTo: "2026-06-30" } }, { user: { id: "u1" } });

    expect(result.costBreakdown).toEqual(expect.objectContaining({ cogs: 140, labor: 250, operations: 360 }));
  });
});
