import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TransactionManagement from "./TransactionManagement";
import { AuthContext } from "@/context/AuthContext";

const txSpies = vi.hoisted(() => ({
  refetch: vi.fn().mockResolvedValue({}),
  setRestaurantId: vi.fn(),
  setFilters: vi.fn(),
  setReconciliationStatus: vi.fn(),
  setBankStatus: vi.fn(),
  createManualCashflow: vi.fn().mockResolvedValue({}),
  updateManualCashflow: vi.fn().mockResolvedValue({}),
  voidManualCashflow: vi.fn().mockResolvedValue({}),
  createSupplierPayable: vi.fn().mockResolvedValue({}),
  updateSupplierPayable: vi.fn().mockResolvedValue({}),
  recordSupplierPayment: vi.fn().mockResolvedValue({}),
  voidSupplierPayable: vi.fn().mockResolvedValue({}),
  createRefundRequest: vi.fn().mockResolvedValue({}),
  approveRefundRequest: vi.fn().mockResolvedValue({}),
  processRefundRequest: vi.fn().mockResolvedValue({}),
  cancelRefundRequest: vi.fn().mockResolvedValue({}),
  retryRefundRequest: vi.fn().mockResolvedValue({}),
  rejectRefundRequest: vi.fn().mockResolvedValue({}),
  reconcileBankTransaction: vi.fn().mockResolvedValue({}),
  manualMatchBankTransaction: vi.fn().mockResolvedValue({}),
  resolveReconciliation: vi.fn().mockResolvedValue({}),
  ignoreBankTransaction: vi.fn().mockResolvedValue({}),
}));

const mockState = vi.hoisted(() => ({ value: null }));

vi.mock("../Finance/FinanceComponents", () => ({
  TransactionTable: ({ transactions = [], onSelect }) => (
    <div data-testid="transaction-table">
      {transactions.map((transaction) => (
        <button key={transaction.id} onClick={() => onSelect?.(transaction)}>
          {transaction.description || transaction.note || transaction.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/hooks/useTransactions", () => ({
  CASHFLOW_CATEGORIES: [
    "sale",
    "refund",
    "payroll",
    "inventory",
    "operations",
    "supplier_payment",
    "adjustment",
    "other",
  ],
  CASHFLOW_SUBCATEGORIES: [
    "labor",
    "cogs",
    "rent",
    "utility",
    "maintenance",
    "marketing",
    "bank_fee",
    "tax",
    "etc",
    "other",
  ],
  PAYMENT_METHODS: [
    "cash",
    "card",
    "bank_transfer",
    "e_wallet",
    "transfer",
    "provider",
    "other",
  ],
  CASHFLOW_STATUSES: ["draft", "pending", "completed", "voided"],
  toLocalDateInputValue: () => "2026-07-11",
  useTransactions: () => mockState.value,
}));

function buildTx(overrides = {}) {
  return {
    restaurants: [{ id: "r1", name: "Nhà hàng A" }],
    restaurantId: "r1",
    filters: {
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      type: "all",
      category: "",
      subcategory: "",
      method: "",
      status: "",
      source: "",
      referenceId: "",
      search: "",
    },
    reconciliationStatus: "all",
    bankStatus: "",
    isDateRangeValid: true,
    loading: false,
    error: null,
    transactions: [
      {
        id: "trx-payment",
        type: "INFLOW",
        amount: 500000,
        description: "Thanh toán hóa đơn A",
        status: "completed",
        source: "order",
        category: "sale",
        method: "momo",
        referenceType: "PaymentTransaction",
        referenceId: "pay-1",
        occurredAt: "2026-06-02T00:00:00Z",
      },
      {
        id: "trx-manual",
        type: "INFLOW",
        amount: 70000,
        description: "Thu thủ công không có thanh toán",
        status: "completed",
        source: "manual",
        category: "operations",
        method: "cash",
        referenceType: null,
        referenceId: null,
        occurredAt: "2026-06-03T00:00:00Z",
      },
    ],
    cashflows: [],
    receivables: [
      {
        id: "inv-open",
        supplier: "INV-2026-0001",
        amount: 300000,
        dueDate: "2026-06-20T00:00:00Z",
        status: "UNPAID",
      },
    ],
    refunds: [
      {
        id: "rf-existing",
        paymentTransactionId: "pay-1",
        amount: 100000,
        status: "pending",
        reason: "Hoàn một phần trước đó",
        method: "cash",
        auditTrail: [],
        createdAt: "2026-06-02T00:00:00Z",
      },
      {
        id: "rf-approved",
        amount: 50000,
        status: "approved",
        reason: "Trừ voucher",
        method: "cash",
        auditTrail: [],
        createdAt: "2026-06-02T00:00:00Z",
      },
      {
        id: "rf-failed",
        amount: 25000,
        status: "failed",
        reason: "Provider lỗi",
        method: "provider",
        auditTrail: [],
        createdAt: "2026-06-02T00:00:00Z",
      },
      {
        id: "rf-success",
        amount: 20000,
        status: "success",
        reason: "Đã hoàn",
        method: "cash",
        cashflowId: "cf-refund",
        auditTrail: [],
        createdAt: "2026-06-02T00:00:00Z",
      },
    ],
    reconciliations: [
      {
        id: "rec-unmatched",
        bankTransactionId: "bank-unmatched",
        status: "unmatched",
        receivedAmount: 500000,
        expectedAmount: 0,
        varianceAmount: 0,
        matchConfidence: 0,
        matchReason: "no_reliable_reference_token",
        candidateMatches: [
          {
            kind: "PaymentSession",
            id: "ps-1",
            paymentSessionId: "ps-1",
            reference: "PAYREF123456",
            confidence: 100,
            expectedAmount: 500000,
          },
        ],
      },
      {
        id: "rec-matched",
        bankTransactionId: "bank-matched",
        status: "matched",
        receivedAmount: 250000,
        expectedAmount: 250000,
        varianceAmount: 0,
        matchConfidence: 100,
        candidateMatches: [],
      },
    ],
    bankTransactions: [
      {
        id: "bank-unmatched",
        provider: "VCB",
        transactionId: "BTX-1",
        bankAccountNumber: "123456789012",
        bankAccountNumberMasked: "****9012",
        bankAccountNumberLast4: "9012",
        amount: 500000,
        transferContent: "PAYREF123456",
        matchStatus: "unmatched",
      },
      {
        id: "bank-matched",
        provider: "VCB",
        transactionId: "BTX-2",
        bankAccountNumber: "987654321098",
        bankAccountNumberMasked: "****1098",
        bankAccountNumberLast4: "1098",
        amount: 250000,
        transferContent: "PAYREF654321",
        matchStatus: "matched",
      },
    ],
    supplierPayables: [
      {
        id: "sp-partial",
        supplierName: "Công ty Rau Sạch",
        amount: 900000,
        paidAmount: 200000,
        remainingAmount: 700000,
        dueDate: "2026-06-20T00:00:00Z",
        status: "partial",
        sourceKind: "inventory",
        cashflowIds: ["cf-1"],
        auditTrail: [],
      },
      {
        id: "sp-unpaid",
        supplierName: "Công ty Hải Sản",
        amount: 600000,
        paidAmount: 0,
        remainingAmount: 600000,
        dueDate: "2026-06-25T00:00:00Z",
        status: "unpaid",
        sourceKind: "manual",
        cashflowIds: [],
        auditTrail: [],
      },
    ],
    ...txSpies,
    ...overrides,
  };
}

function renderPage({
  userPermissions = [
    "finance.write",
    "finance.export",
    "refund.write",
    "reconciliation.write",
  ],
  roleName = "accountant",
  txOverrides = {},
} = {}) {
  mockState.value = buildTx(txOverrides);
  return render(
    <AuthContext.Provider
      value={{
        user: {
          id: "u1",
          roleName,
          permissions: userPermissions.map((code) => ({ code })),
        },
      }}
    >
      <TransactionManagement />
    </AuthContext.Provider>,
  );
}

describe("TransactionManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => "blob:tx");
    global.URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  it("renders every transaction operation tab and invoice-backed receivables", () => {
    renderPage();
    [
      "Nhật ký giao dịch",
      "Dòng tiền",
      "Hoàn tiền",
      "Đối soát",
      "Giao dịch ngân hàng",
      "Công nợ",
    ].forEach((label) => {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));
    expect(screen.getByText("INV-2026-0001")).toBeInTheDocument();
    expect(screen.getByText(/Còn phải thu 300\.000đ/)).toBeInTheDocument();
  });

  it("renders and exports only masked bank account values", async () => {
    const OriginalBlob = globalThis.Blob;
    const blobCalls = [];
    vi.stubGlobal(
      "Blob",
      class MockBlob extends OriginalBlob {
        constructor(parts, options) {
          blobCalls.push([parts, options]);
          super(parts, options);
        }
      },
    );

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Giao dịch ngân hàng" }));
    expect(screen.getByText(/\*\*\*\*9012/)).toBeInTheDocument();
    expect(screen.queryByText(/123456789012/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Xuất CSV/i }));
    const csv = blobCalls[0]?.[0]?.[0] || "";
    expect(csv).toContain("****9012");
    expect(csv).not.toContain("123456789012");
    vi.stubGlobal("Blob", OriginalBlob);
  });

  it("requires choosing an eligible payment before creating a refund", async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: /Hoàn tiền từ giao dịch/i }),
    );

    const picker = screen.getByRole("dialog");
    expect(
      within(picker).getByRole("heading", {
        name: "Chọn giao dịch cần hoàn tiền",
      }),
    ).toBeInTheDocument();
    expect(within(picker).getByText("Thanh toán hóa đơn A")).toBeInTheDocument();
    expect(
      within(picker).queryByText("Thu thủ công không có thanh toán"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(picker).getByRole("button", { name: /Thanh toán hóa đơn A/ }),
    );
    const refundDialog = screen.getByRole("dialog");
    expect(screen.getByLabelText("Số tiền hoàn")).toHaveValue(400000);

    fireEvent.change(screen.getByLabelText("Số tiền hoàn"), {
      target: { value: "450000" },
    });
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Hoàn món" },
    });
    expect(
      within(refundDialog).getByRole("button", {
        name: "Tạo yêu cầu hoàn tiền",
      }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Số tiền hoàn"), {
      target: { value: "300000" },
    });
    fireEvent.click(
      within(refundDialog).getByRole("button", {
        name: "Tạo yêu cầu hoàn tiền",
      }),
    );

    await waitFor(() =>
      expect(txSpies.createRefundRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentTransactionId: "pay-1",
          amount: 300000,
          reason: "Hoàn món",
        }),
      ),
    );
  });

  it("keeps supplier paid amount immutable and routes payments through the payment action", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));

    const partialCard = screen.getByText("Công ty Rau Sạch").closest("article");
    expect(
      within(partialCard).queryByRole("button", { name: "Hủy ghi nhận" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(partialCard).getByRole("button", { name: "Sửa" }));
    expect(screen.getByLabelText("Đã trả")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("amount"), {
      target: { value: "950000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu khoản phải trả" }));
    await waitFor(() =>
      expect(txSpies.updateSupplierPayable).toHaveBeenCalledWith(
        "sp-partial",
        expect.objectContaining({ amount: 950000 }),
      ),
    );
    expect(txSpies.updateSupplierPayable.mock.calls[0][1]).not.toHaveProperty(
      "paidAmount",
    );

    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));
    fireEvent.click(
      within(partialCard).getByRole("button", { name: "Thanh toán" }),
    );
    fireEvent.change(screen.getByLabelText("paymentAmount"), {
      target: { value: "300000" },
    });
    fireEvent.change(screen.getByLabelText("Ghi chú bắt buộc"), {
      target: { value: "Thanh toán một phần" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ghi nhận thanh toán" }),
    );
    await waitFor(() =>
      expect(txSpies.recordSupplierPayment).toHaveBeenCalledWith(
        "sp-partial",
        expect.objectContaining({
          amount: 300000,
          note: "Thanh toán một phần",
        }),
      ),
    );
  });

  it("allows void only for an unpaid supplier payable with a reason", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));
    const unpaidCard = screen.getByText("Công ty Hải Sản").closest("article");
    fireEvent.click(
      within(unpaidCard).getByRole("button", { name: "Hủy ghi nhận" }),
    );
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Nhập trùng" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() =>
      expect(txSpies.voidSupplierPayable).toHaveBeenCalledWith(
        "sp-unpaid",
        "Nhập trùng",
      ),
    );
  });

  it("requires one reconciliation target and hides actions after finalization", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Giao dịch ngân hàng" }));

    const unmatchedCard = screen.getByText("PAYREF123456").closest("article");
    const matchedCard = screen.getByText("PAYREF654321").closest("article");
    expect(
      within(matchedCard).queryByRole("button", { name: "Tự động khớp" }),
    ).not.toBeInTheDocument();
    expect(
      within(matchedCard).queryByRole("button", { name: "Bỏ qua" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(unmatchedCard).getByRole("button", { name: "Ghép thủ công" }),
    );
    expect(screen.getByText(/Phiên thanh toán · độ tin cậy 100/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Ghép bắt buộc/i));
    expect(
      screen.getByRole("button", { name: "Xác nhận ghép" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Ghi chú/lý do"), {
      target: { value: "Force có lý do" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ghép" }));
    await waitFor(() =>
      expect(txSpies.manualMatchBankTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          bankTransactionId: "bank-unmatched",
          paymentSessionId: "ps-1",
          paymentTransactionId: null,
          forceMatch: true,
          note: "Force có lý do",
        }),
      ),
    );
  });

  it("shows close action only for unresolved reconciliation exceptions", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Đối soát" }));
    const unmatchedCard = screen.getByText("rec-unmatched").closest("article");
    const matchedCard = screen.getByText("rec-matched").closest("article");
    expect(
      within(unmatchedCard).getByRole("button", { name: /Đóng/ }),
    ).toBeInTheDocument();
    expect(
      within(matchedCard).queryByRole("button", { name: /Đóng/ }),
    ).not.toBeInTheDocument();
  });

  it("hides write actions without finance, refund and reconciliation permissions", () => {
    renderPage({ userPermissions: ["transaction.read"], roleName: "staff" });
    expect(
      screen.queryByRole("button", { name: /Ghi nhận thu\/chi/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Hoàn tiền từ giao dịch/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Giao dịch ngân hàng" }));
    expect(
      screen.queryByRole("button", { name: "Tự động khớp" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));
    expect(
      screen.queryByRole("button", { name: "Tạo khoản phải trả" }),
    ).not.toBeInTheDocument();
  });
});
