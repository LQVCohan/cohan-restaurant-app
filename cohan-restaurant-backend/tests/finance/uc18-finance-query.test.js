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

function sortedLean(rows) {
  return { sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }) };
}
function sortedLimitLean(rows) {
  return { sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }) }) };
}
function lean(rows) {
  return { lean: vi.fn().mockResolvedValue(rows) };
}

describe("UC18 finance query resolvers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.values(permissionMocks).forEach((fn) => fn.mockResolvedValue(true));
    modelMocks.Cashflow.find.mockReturnValue(sortedLean([]));
    modelMocks.PaymentTransaction.find.mockReturnValue(sortedLean([]));
    modelMocks.PaymentReconciliation.find.mockReturnValue(sortedLimitLean([]));
    modelMocks.PaymentReconciliation.aggregate.mockResolvedValue([]);
    modelMocks.BankTransaction.aggregate.mockResolvedValue([]);
    modelMocks.BankTransaction.find.mockReturnValue(sortedLimitLean([]));
    modelMocks.SupplierPayable.find.mockReturnValue(lean([]));
    modelMocks.Invoice.find.mockReturnValue(sortedLean([]));
  });

  it("calculates dashboard revenue, expense, receivable, payable, overdue and cost buckets", async () => {
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");
    modelMocks.Cashflow.find.mockReturnValue(sortedLean([
      { _id: "cf1", type: "INFLOW", amount: 1000, status: "completed", category: "sale", occurredAt: new Date("2026-06-02"), note: "sale" },
      { _id: "cf2", type: "OUTFLOW", amount: 300, status: "completed", category: "payroll", subcategory: "labor", occurredAt: new Date("2026-06-02"), note: "payroll" },
      { _id: "cf3", type: "OUTFLOW", amount: 200, status: "completed", category: "other", occurredAt: new Date("2026-06-02"), note: "nguyên liệu legacy" },
    ]));
    modelMocks.Invoice.find
      .mockReturnValueOnce(sortedLean([{ _id: "invPaid", status: "PAID", paid: 1000, issuedAt: new Date("2026-06-02") }]))
      .mockReturnValueOnce(lean([{ _id: "invDebt", status: "PARTIAL", totals: { grandTotal: 1000 }, paid: 400, dueDate: new Date("2020-01-01"), issuedAt: new Date("2026-06-02") }]));
    modelMocks.SupplierPayable.find.mockReturnValue(lean([{ _id: "sp1", amount: 800, paidAmount: 300, remainingAmount: 500, status: "overdue", dueDate: new Date("2020-01-01") }]));
    modelMocks.PaymentTransaction.find.mockReturnValue(sortedLean([{ _id: "pt1", status: "SUCCESS", paidAmount: 1000, paidAt: new Date("2026-06-02") }]));

    const result = await PaymentQuery.financeDashboard(null, { input: { restaurantId: "64b000000000000000000001", dateFrom: "2026-06-01", dateTo: "2026-06-30" } }, { user: { id: "u1" } });

    expect(result.summary).toEqual(expect.objectContaining({ revenue: 1000, expense: 500, profit: 500, receivable: 600, payable: 500, debt: 1100, overdue: 1100 }));
    expect(result.costBreakdown).toEqual(expect.objectContaining({ labor: 300, cogs: 200 }));
    expect(permissionMocks.requireFinanceRead).toHaveBeenCalled();
  });

  it("returns only masked bank account fields from bankTransactions", async () => {
    const { PaymentQuery } = await import("../../graphql/resolvers/payment/query.js");
    modelMocks.BankTransaction.find.mockReturnValue(sortedLimitLean([{ _id: "bank1", restaurantId: "64b000000000000000000001", bankAccountNumber: "123456789", amount: 100, matchStatus: "unmatched" }]));
    const rows = await PaymentQuery.bankTransactions(null, { restaurantId: "64b000000000000000000001" }, { user: { id: "u1" } });
    expect(rows[0].bankAccountNumber).toBe("****6789");
    expect(rows[0].bankAccountNumberMasked).toBe("****6789");
    expect(rows[0].bankAccountNumberLast4).toBe("6789");
    expect(JSON.stringify(rows)).not.toContain("123456789");
  });
});
