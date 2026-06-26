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
  refetch: vi.fn(),
  setRestaurantId: vi.fn(),
  setFilters: vi.fn(),
  setReconciliationStatus: vi.fn(),
  setBankStatus: vi.fn(),
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
    loading: false,
    error: null,
    transactions: [
      {
        id: "trx-1",
        type: "INFLOW",
        amount: 500000,
        description: "Thanh toán hóa đơn",
        status: "completed",
        source: "order",
        category: "sale",
        referenceType: "PaymentTransaction",
        referenceId: "pay-1",
        occurredAt: "2026-06-02T00:00:00Z",
      },
    ],
    cashflows: [],
    refunds: [
      {
        id: "rf-pending",
        amount: 100000,
        status: "pending",
        reason: "Khách đổi món",
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
        id: "rec-1",
        bankTransactionId: "bank-1",
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
    ],
    bankTransactions: [
      {
        id: "bank-1",
        provider: "VCB",
        transactionId: "BTX-1",
        bankAccountNumber: "123456789012",
        bankAccountNumberMasked: "****9012",
        bankAccountNumberLast4: "9012",
        amount: 500000,
        transferContent: "PAYREF123456",
        matchStatus: "unmatched",
      },
    ],
    supplierPayables: [
      {
        id: "sp-1",
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

  it("renders transaction operation tabs", () => {
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
  });

  it("renders masked bank account and export never includes raw bank account", async () => {
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

  it("supports supplier payable create, edit, payment and void with reason modal", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo khoản phải trả" }));
    fireEvent.change(screen.getByLabelText("supplierName"), {
      target: { value: "Nhà cung cấp Hải Sản" },
    });
    fireEvent.change(screen.getByLabelText("amount"), {
      target: { value: "1200000" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Tạo khoản phải trả" }).at(-1),
    );
    await waitFor(() =>
      expect(txSpies.createSupplierPayable).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierName: "Nhà cung cấp Hải Sản",
          amount: 1200000,
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));
    const payableCard = screen.getByText("Công ty Rau Sạch").closest("article");
    fireEvent.click(within(payableCard).getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("amount"), {
      target: { value: "950000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu khoản phải trả" }));
    await waitFor(() =>
      expect(txSpies.updateSupplierPayable).toHaveBeenCalledWith(
        "sp-1",
        expect.objectContaining({ amount: 950000 }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));
    fireEvent.click(
      within(payableCard).getByRole("button", { name: "Thanh toán" }),
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
        "sp-1",
        expect.objectContaining({
          amount: 300000,
          note: "Thanh toán một phần",
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Công nợ" }));
    fireEvent.click(within(payableCard).getByRole("button", { name: "Hủy ghi nhận" }));
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Nhập trùng" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() =>
      expect(txSpies.voidSupplierPayable).toHaveBeenCalledWith(
        "sp-1",
        "Nhập trùng",
      ),
    );
  });

  it("creates refund from a transaction without raw ID entry and gates lifecycle actions by status", async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: /Hoàn tiền từ giao dịch/i }),
    );
    expect(screen.getByText("Tạo yêu cầu hoàn tiền")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).queryByPlaceholderText(
        /ObjectId|raw/i,
      ),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Số tiền hoàn"), {
      target: { value: "999999" },
    });
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Hoàn món" },
    });
    expect(
      screen.getByRole("button", { name: "Tạo yêu cầu hoàn tiền" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Số tiền hoàn"), {
      target: { value: "300000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo yêu cầu hoàn tiền" }));
    await waitFor(() =>
      expect(txSpies.createRefundRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentTransactionId: "pay-1",
          amount: 300000,
          reason: "Hoàn món",
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Hoàn tiền" }));
    fireEvent.click(screen.getByText("Khách đổi món"));
    expect(screen.getByRole("button", { name: "Duyệt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "×" }));

    fireEvent.click(screen.getByText("Trừ voucher"));
    expect(screen.getByRole("button", { name: "Xử lý" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "×" }));

    fireEvent.click(screen.getByText("Provider lỗi"));
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "×" }));

    fireEvent.click(screen.getByText("Đã hoàn"));
    expect(
      screen.queryByRole("button", { name: "Thử lại" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xử lý" }),
    ).not.toBeInTheDocument();
  });

  it("handles reconciliation candidates, force-match note validation, resolve note and ignore reason modal", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Đối soát" }));
    expect(screen.getByText(/Độ tin cậy 0/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("rec-1"));
    expect(screen.getByText(/PAYREF123456/)).toBeInTheDocument();
    expect(screen.getByText(/Phiên thanh toán · 100/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "×" }));

    fireEvent.click(screen.getByRole("button", { name: /Đóng/ }));
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Chấp nhận xử lý" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() =>
      expect(txSpies.resolveReconciliation).toHaveBeenCalledWith(
        expect.objectContaining({
          reconciliationId: "rec-1",
          note: "Chấp nhận xử lý",
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Giao dịch ngân hàng" }));
    fireEvent.click(screen.getByRole("button", { name: "Ghép thủ công" }));
    expect(screen.getByText(/độ tin cậy 100/)).toBeInTheDocument();
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
          bankTransactionId: "bank-1",
          forceMatch: true,
          note: "Force có lý do",
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Giao dịch ngân hàng" }));
    fireEvent.click(screen.getByRole("button", { name: "Bỏ qua" }));
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do"), {
      target: { value: "Không liên quan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() =>
      expect(txSpies.ignoreBankTransaction).toHaveBeenCalledWith(
        "bank-1",
        "Không liên quan",
      ),
    );
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("hides write actions without finance/refund/reconciliation permissions", () => {
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
