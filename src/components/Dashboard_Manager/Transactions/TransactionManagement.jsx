import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Download,
  FilePlus2,
  RefreshCw,
  Search,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react";
import "../Finance/FinanceDashboard.scss";
import "./TransactionManagementPolish.scss";
import "./TransactionManagementLayoutFix.scss";
import { TransactionTable } from "../Finance/FinanceComponents";
import { AuthContext } from "@/context/AuthContext";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import {
  CASHFLOW_CATEGORIES,
  CASHFLOW_STATUSES,
  CASHFLOW_SUBCATEGORIES,
  PAYMENT_METHODS,
  toLocalDateInputValue,
  useTransactions,
} from "@/hooks/useTransactions";

const fmt = (num) => `${Number(num || 0).toLocaleString("vi-VN")}đ`;
const todayInput = () => toLocalDateInputValue(new Date());
const asDate = (value) =>
  value ? new Date(value).toLocaleString("vi-VN") : "-";
const asDateOnly = (value) => {
  if (!value) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("vi-VN");
};
const safeBankAccountLabel = (bankTransaction = {}) =>
  bankTransaction.bankAccountNumberMasked ||
  (bankTransaction.bankAccountNumberLast4
    ? `****${bankTransaction.bankAccountNumberLast4}`
    : "-");

const TYPE_LABELS = { INFLOW: "Thu", OUTFLOW: "Chi" };
const CASHFLOW_CATEGORY_LABELS = {
  sale: "Doanh thu bán hàng",
  refund: "Hoàn tiền",
  payroll: "Lương & nhân sự",
  inventory: "Nguyên liệu/kho",
  operations: "Vận hành",
  supplier_payment: "Thanh toán nhà cung cấp",
  adjustment: "Điều chỉnh",
  other: "Khác",
};
const CASHFLOW_SUBCATEGORY_LABELS = {
  labor: "Nhân sự",
  cogs: "Giá vốn/nguyên liệu",
  rent: "Mặt bằng",
  utility: "Điện nước",
  maintenance: "Bảo trì",
  marketing: "Marketing",
  bank_fee: "Phí ngân hàng",
  tax: "Thuế",
  etc: "Khác",
  other: "Khác",
};
const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  card: "Thẻ",
  bank_transfer: "Chuyển khoản",
  e_wallet: "Ví điện tử",
  transfer: "Chuyển khoản",
  provider: "Cổng thanh toán",
  momo: "MoMo",
  vnpay: "VNPAY",
  other: "Khác",
};
const STATUS_LABELS = {
  draft: "Bản nháp",
  pending: "Chờ xử lý",
  processing: "Đang xử lý",
  completed: "Hoàn tất",
  voided: "Đã hủy ghi nhận",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
  failed: "Thất bại",
  success: "Thành công",
  unmatched: "Chưa khớp",
  matched: "Đã khớp",
  amount_mismatch: "Lệch số tiền",
  duplicate: "Trùng giao dịch",
  resolved: "Đã xử lý",
  ignored: "Đã bỏ qua",
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán một phần",
  paid: "Đã thanh toán",
  overdue: "Quá hạn",
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
};
const SOURCE_KIND_LABELS = {
  manual: "Nhập thủ công",
  inventory: "Kho/nguyên liệu",
  supplier_invoice: "Hóa đơn nhà cung cấp",
  other: "Khác",
};
const CANDIDATE_KIND_LABELS = {
  PaymentSession: "Phiên thanh toán",
  PaymentTransaction: "Giao dịch thanh toán",
  Invoice: "Hóa đơn",
  Order: "Đơn hàng",
};
const REFUND_ACTIVE_STATUSES = new Set([
  "pending",
  "approved",
  "processing",
  "success",
]);
const RECONCILIATION_ACTIONABLE_STATUSES = new Set([
  "unmatched",
  "amount_mismatch",
  "duplicate",
]);
const BANK_ACTIONABLE_STATUSES = new Set([
  "",
  "unmatched",
  "amount_mismatch",
  "duplicate",
]);

const getLabel = (map, value, fallback = "-") =>
  map[value] ||
  map[String(value || "").toLowerCase()] ||
  value ||
  fallback;

const getRefundReference = (transaction) => ({
  type: transaction?.referenceType || transaction?.reference?.kind || null,
  id: transaction?.referenceId || transaction?.reference?.id || null,
});

const isRefundEligible = (transaction) => {
  const reference = getRefundReference(transaction);
  const completed = ["completed", "success", "SUCCESS"].includes(
    String(transaction?.status || ""),
  );
  return (
    transaction?.type === "INFLOW" &&
    transaction?.source !== "manual" &&
    completed &&
    ["PaymentTransaction", "Invoice", "Order"].includes(reference.type) &&
    Boolean(reference.id)
  );
};

const refundAmountForTransaction = (transaction, refunds = []) => {
  const reference = getRefundReference(transaction);
  return refunds.reduce((sum, refund) => {
    if (!REFUND_ACTIVE_STATUSES.has(String(refund.status || ""))) return sum;
    const matches =
      (reference.type === "PaymentTransaction" &&
        String(refund.paymentTransactionId || "") === String(reference.id)) ||
      (reference.type === "Invoice" &&
        String(refund.invoiceId || "") === String(reference.id)) ||
      (reference.type === "Order" &&
        String(refund.orderId || "") === String(reference.id));
    return matches ? sum + Number(refund.amount || 0) : sum;
  }, 0);
};

function readNavigationQuery() {
  const params = new URLSearchParams(window.location.search || "");
  return {
    tab: params.get("tab") || "journal",
    type: params.get("type") || "all",
    category: params.get("category") || "",
    subcategory: params.get("subcategory") || "",
  };
}

function exportCsv({
  transactions = [],
  cashflows = [],
  refunds = [],
  reconciliations = [],
  bankTransactions = [],
  supplierPayables = [],
  receivables = [],
}) {
  const rows = [
    [
      "Nhóm dữ liệu",
      "Thời gian",
      "Nội dung",
      "Trạng thái/loại",
      "Số tiền",
      "Nguồn",
      "Mã tham chiếu",
      "Phương thức",
    ],
    ...transactions.map((item) => [
      "Nhật ký giao dịch",
      item.occurredAt,
      item.description,
      `${getLabel(TYPE_LABELS, item.type)}/${getLabel(STATUS_LABELS, item.status)}`,
      item.amount,
      item.source || "",
      item.referenceId || "",
      getLabel(PAYMENT_METHOD_LABELS, item.method, ""),
    ]),
    ...cashflows.map((item) => [
      "Dòng tiền",
      item.occurredAt,
      item.note,
      `${getLabel(CASHFLOW_CATEGORY_LABELS, item.category)}/${getLabel(CASHFLOW_SUBCATEGORY_LABELS, item.subcategory)}/${getLabel(STATUS_LABELS, item.status)}`,
      item.amount,
      item.source || "",
      item.reference?.kind || "",
      getLabel(PAYMENT_METHOD_LABELS, item.method, ""),
    ]),
    ...refunds.map((item) => [
      "Hoàn tiền",
      item.createdAt,
      item.reason,
      getLabel(STATUS_LABELS, item.status),
      item.amount,
      "Hoàn tiền",
      item.paymentTransactionId || item.invoiceId || item.orderId || "",
      getLabel(PAYMENT_METHOD_LABELS, item.method, ""),
    ]),
    ...reconciliations.map((item) => [
      "Đối soát",
      item.createdAt,
      item.note || item.paymentReference,
      `${getLabel(STATUS_LABELS, item.status)} / độ tin cậy ${item.matchConfidence || 0}`,
      item.receivedAmount,
      "Ngân hàng",
      item.bankTransactionId || item.paymentSessionId || "",
      item.matchReason || "",
    ]),
    ...bankTransactions.map((item) => [
      "Giao dịch ngân hàng",
      item.occurredAt || item.createdAt,
      item.transferContent || item.description,
      getLabel(STATUS_LABELS, item.matchStatus),
      item.amount,
      item.provider,
      item.transactionId || "",
      safeBankAccountLabel(item),
    ]),
    ...receivables.map((item) => [
      "Khoản phải thu",
      item.dueDate,
      item.supplier,
      getLabel(STATUS_LABELS, item.status),
      item.amount,
      "Hóa đơn",
      item.id,
      "",
    ]),
    ...supplierPayables.map((item) => [
      "Khoản phải trả",
      item.dueDate || item.createdAt,
      item.supplierName,
      getLabel(STATUS_LABELS, item.status),
      item.remainingAmount,
      getLabel(SOURCE_KIND_LABELS, item.sourceKind),
      item.id,
      "",
    ]),
  ];
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `giao-dich-doi-soat-${todayInput()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const Field = ({ label, children }) => (
  <label className="tx-field">
    <span>{label}</span>
    {children}
  </label>
);

const EmptyNote = ({ children }) => <div className="empty-note">{children}</div>;

function ConfirmFinancialActionModal({
  title,
  message,
  reasonLabel = "Lý do",
  confirmLabel = "Xác nhận",
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card">
        <button className="drawer-close" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
        <h3>{title}</h3>
        <p>{message}</p>
        <Field label={reasonLabel}>
          <textarea
            aria-label={reasonLabel}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <button
          className="btn-primary tx-submit"
          disabled={!reason.trim()}
          onClick={() => onConfirm(reason.trim())}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

function ManualCashflowModal({ initial, onSubmit, onClose, onVoid }) {
  const [form, setForm] = useState(
    initial || {
      type: "OUTFLOW",
      amount: "",
      category: "operations",
      subcategory: "utility",
      method: "bank_transfer",
      status: "completed",
      occurredAt: todayInput(),
      note: "",
    },
  );
  const update = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const canEdit = !initial || ["draft", "pending"].includes(initial.status);
  const valid = Number(form.amount || 0) > 0 && Boolean(form.occurredAt);

  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card tx-modal-card--wide">
        <button className="drawer-close" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
        <h3>
          {initial
            ? "Cập nhật dòng tiền thủ công"
            : "Ghi nhận thu / chi thủ công"}
        </h3>
        <div className="tx-form-grid">
          <Field label="Loại giao dịch">
            <select
              disabled={!canEdit}
              value={form.type}
              onChange={(event) => update("type", event.target.value)}
            >
              <option value="INFLOW">Thu</option>
              <option value="OUTFLOW">Chi</option>
            </select>
          </Field>
          <Field label="Số tiền">
            <input
              disabled={!canEdit}
              type="number"
              min="1"
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
            />
          </Field>
          <Field label="Danh mục">
            <select
              disabled={!canEdit}
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
            >
              {CASHFLOW_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {getLabel(CASHFLOW_CATEGORY_LABELS, value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nhóm chi tiết">
            <select
              disabled={!canEdit}
              value={form.subcategory}
              onChange={(event) => update("subcategory", event.target.value)}
            >
              {CASHFLOW_SUBCATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {getLabel(CASHFLOW_SUBCATEGORY_LABELS, value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phương thức">
            <select
              disabled={!canEdit}
              value={form.method}
              onChange={(event) => update("method", event.target.value)}
            >
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {getLabel(PAYMENT_METHOD_LABELS, value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select
              disabled={!canEdit}
              value={form.status}
              onChange={(event) => update("status", event.target.value)}
            >
              {CASHFLOW_STATUSES.filter((value) => value !== "voided").map(
                (value) => (
                  <option key={value} value={value}>
                    {getLabel(STATUS_LABELS, value)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Ngày phát sinh">
            <input
              disabled={!canEdit}
              type="date"
              value={String(form.occurredAt || "").slice(0, 10)}
              onChange={(event) => update("occurredAt", event.target.value)}
            />
          </Field>
          <Field label="Ghi chú">
            <textarea
              disabled={!canEdit}
              value={form.note || ""}
              onChange={(event) => update("note", event.target.value)}
            />
          </Field>
        </div>
        <div className="tx-modal-actions">
          {canEdit && (
            <button
              className="btn-primary"
              disabled={!valid}
              onClick={() =>
                onSubmit({
                  ...form,
                  amount: Number(form.amount || 0),
                  currency: "VND",
                })
              }
            >
              Lưu
            </button>
          )}
          {initial && initial.status !== "voided" && (
            <button className="btn-danger-soft" onClick={() => onVoid(initial)}>
              Hủy ghi nhận
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RefundSourcePickerModal({ transactions, refunds, onSelect, onClose }) {
  const eligible = transactions.filter(
    (transaction) =>
      isRefundEligible(transaction) &&
      Number(transaction.amount || 0) -
        refundAmountForTransaction(transaction, refunds) >
        0,
  );
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card tx-modal-card--wide">
        <button className="drawer-close" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
        <h3>Chọn giao dịch cần hoàn tiền</h3>
        <p>Chỉ hiển thị các khoản thu đã hoàn tất và có tham chiếu thanh toán hợp lệ.</p>
        <div className="candidate-list">
          {eligible.length === 0 ? (
            <EmptyNote>Không có giao dịch còn số dư đủ điều kiện hoàn tiền.</EmptyNote>
          ) : (
            eligible.map((transaction) => {
              const used = refundAmountForTransaction(transaction, refunds);
              return (
                <button key={transaction.id} onClick={() => onSelect(transaction)}>
                  <strong>{transaction.description || transaction.referenceId}</strong>
                  <span>
                    {fmt(transaction.amount)} · còn {fmt(Number(transaction.amount) - used)}
                  </span>
                  <small>
                    {transaction.referenceType} · {transaction.referenceId}
                  </small>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function RefundRequestModal({ transaction, refunds, onSubmit, onClose }) {
  const paidAmount = Number(transaction?.amount || transaction?.paidAmount || 0);
  const refundedAmount = refundAmountForTransaction(transaction, refunds);
  const remaining = Math.max(paidAmount - refundedAmount, 0);
  const [amount, setAmount] = useState(remaining > 0 ? remaining : "");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("cash");
  const reference = getRefundReference(transaction);
  const amountNumber = Number(amount || 0);
  const valid =
    Boolean(reference.id) &&
    remaining > 0 &&
    amountNumber > 0 &&
    amountNumber <= remaining &&
    Boolean(reason.trim());

  const input = {
    paymentTransactionId:
      reference.type === "PaymentTransaction" ? reference.id : null,
    invoiceId: reference.type === "Invoice" ? reference.id : null,
    orderId: reference.type === "Order" ? reference.id : null,
    amount: amountNumber,
    method,
    reason: reason.trim(),
  };

  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card">
        <button className="drawer-close" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
        <h3>Tạo yêu cầu hoàn tiền</h3>
        <div className="tx-readonly-summary">
          <span>Giao dịch nguồn</span>
          <strong>{transaction?.description || reference.id}</strong>
          <small>
            Đã thanh toán {fmt(paidAmount)} · đang/đã hoàn {fmt(refundedAmount)} · còn {fmt(remaining)}
          </small>
        </div>
        <Field label="Số tiền hoàn">
          <input
            aria-label="Số tiền hoàn"
            type="number"
            min="1"
            max={remaining}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field label="Phương thức">
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản</option>
            <option value="e_wallet">Ví điện tử</option>
            <option value="provider">Cổng thanh toán</option>
          </select>
        </Field>
        <Field label="Lý do">
          <textarea
            aria-label="Lý do"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        {remaining <= 0 && (
          <div className="finance-error">Giao dịch này không còn số dư để hoàn.</div>
        )}
        <button
          className="btn-primary tx-submit"
          disabled={!valid}
          onClick={() => onSubmit(input)}
        >
          Tạo yêu cầu hoàn tiền
        </button>
      </div>
    </div>
  );
}

function ManualMatchModal({ bankTransaction, reconciliation, onMatch, onClose }) {
  const candidates = reconciliation?.candidateMatches || [];
  const [selected, setSelected] = useState(candidates[0] || null);
  const [note, setNote] = useState("");
  const [forceMatch, setForceMatch] = useState(false);
  const selectedTarget =
    selected?.paymentSessionId || selected?.paymentTransactionId || null;
  const valid = Boolean(selectedTarget) && (!forceMatch || Boolean(note.trim()));

  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card tx-modal-card--wide">
        <button className="drawer-close" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
        <h3>Ghép thủ công giao dịch ngân hàng</h3>
        <p>
          {fmt(bankTransaction?.amount)} ·{" "}
          {bankTransaction?.transferContent || bankTransaction?.description}
        </p>
        <div className="candidate-list">
          {candidates.length === 0 ? (
            <EmptyNote>
              Chưa có giao dịch thanh toán phù hợp để ghép. Hãy kiểm tra lại nội dung chuyển khoản hoặc tạo đúng phiên thanh toán trước.
            </EmptyNote>
          ) : (
            candidates.map((candidate) => (
              <button
                key={`${candidate.kind}-${candidate.id}`}
                className={selected?.id === candidate.id ? "active" : ""}
                onClick={() => setSelected(candidate)}
              >
                <strong>{candidate.reference || candidate.id}</strong>
                <span>
                  {getLabel(CANDIDATE_KIND_LABELS, candidate.kind)} · độ tin cậy {candidate.confidence}
                </span>
                <small>
                  {fmt(candidate.expectedAmount)} · {candidate.reason}
                </small>
              </button>
            ))
          )}
        </div>
        <label className="tx-checkbox">
          <input
            type="checkbox"
            checked={forceMatch}
            disabled={!selectedTarget}
            onChange={(event) => setForceMatch(event.target.checked)}
          />{" "}
          Ghép bắt buộc khi số tiền hoặc thông tin chưa trùng hoàn toàn
        </label>
        <Field label="Ghi chú/lý do">
          <textarea
            aria-label="Ghi chú/lý do"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <button
          className="btn-primary"
          disabled={!valid}
          onClick={() =>
            onMatch({
              bankTransactionId: bankTransaction.id,
              paymentSessionId: selected?.paymentSessionId || null,
              paymentTransactionId: selected?.paymentTransactionId || null,
              forceMatch,
              note: note.trim(),
            })
          }
        >
          Xác nhận ghép
        </button>
      </div>
    </div>
  );
}

function SupplierPayableModal({ payable, onSubmit, onClose }) {
  const [form, setForm] = useState({
    supplierName: payable?.supplierName || "",
    supplierId: payable?.supplierId || "",
    sourceKind: payable?.sourceKind || "manual",
    sourceId: payable?.sourceId || "",
    amount: payable?.amount || "",
    dueDate: payable?.dueDate
      ? String(payable.dueDate).slice(0, 10)
      : todayInput(),
    note: payable?.note || "",
  });
  const amount = Number(form.amount || 0);
  const alreadyPaid = Number(payable?.paidAmount || 0);
  const valid =
    Boolean(form.supplierName.trim()) && amount > 0 && amount >= alreadyPaid;
  const update = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card tx-modal-card--wide">
        <button className="drawer-close" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
        <h3>{payable ? "Sửa khoản phải trả" : "Tạo khoản phải trả"}</h3>
        <div className="tx-form-grid">
          <Field label="Nhà cung cấp">
            <input
              aria-label="supplierName"
              value={form.supplierName}
              onChange={(event) => update("supplierName", event.target.value)}
            />
          </Field>
          <Field label="Mã nhà cung cấp">
            <input
              value={form.supplierId}
              onChange={(event) => update("supplierId", event.target.value)}
            />
          </Field>
          <Field label="Nguồn phát sinh">
            <select
              value={form.sourceKind}
              onChange={(event) => update("sourceKind", event.target.value)}
            >
              <option value="inventory">Kho/nguyên liệu</option>
              <option value="manual">Nhập thủ công</option>
              <option value="supplier_invoice">Hóa đơn nhà cung cấp</option>
              <option value="other">Khác</option>
            </select>
          </Field>
          <Field label="Mã chứng từ nguồn">
            <input
              value={form.sourceId}
              onChange={(event) => update("sourceId", event.target.value)}
            />
          </Field>
          <Field label="Tổng phải trả">
            <input
              aria-label="amount"
              type="number"
              min={Math.max(alreadyPaid, 1)}
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
            />
          </Field>
          <Field label="Đã trả">
            <input value={fmt(alreadyPaid)} disabled />
          </Field>
          <Field label="Hạn thanh toán">
            <input
              type="date"
              value={form.dueDate}
              onChange={(event) => update("dueDate", event.target.value)}
            />
          </Field>
          <Field label="Ghi chú">
            <textarea
              value={form.note}
              onChange={(event) => update("note", event.target.value)}
            />
          </Field>
        </div>
        {amount < alreadyPaid && (
          <div className="finance-error">
            Tổng phải trả không thể nhỏ hơn số tiền đã ghi nhận thanh toán.
          </div>
        )}
        <button
          className="btn-primary tx-submit"
          disabled={!valid}
          onClick={() =>
            onSubmit({
              supplierName: form.supplierName.trim(),
              supplierId: form.supplierId || null,
              sourceKind: form.sourceKind || "manual",
              sourceId: form.sourceId || null,
              amount,
              dueDate: form.dueDate || null,
              note: form.note || "",
            })
          }
        >
          {payable ? "Lưu khoản phải trả" : "Tạo khoản phải trả"}
        </button>
      </div>
    </div>
  );
}

function SupplierPaymentModal({ payable, onSubmit, onClose }) {
  const remaining = Number(payable?.remainingAmount || 0);
  const [form, setForm] = useState({
    amount: remaining,
    method: "bank_transfer",
    paidAt: todayInput(),
    note: "",
  });
  const amount = Number(form.amount || 0);
  const valid =
    amount > 0 &&
    amount <= remaining &&
    Boolean(String(form.note || "").trim());
  const update = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card">
        <button className="drawer-close" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
        <h3>Ghi nhận thanh toán nhà cung cấp</h3>
        <div className="tx-readonly-summary">
          <strong>{payable?.supplierName}</strong>
          <small>Còn phải trả {fmt(remaining)}</small>
        </div>
        <Field label="Số tiền">
          <input
            aria-label="paymentAmount"
            type="number"
            min="1"
            max={remaining}
            value={form.amount}
            onChange={(event) => update("amount", event.target.value)}
          />
        </Field>
        <Field label="Phương thức">
          <select
            value={form.method}
            onChange={(event) => update("method", event.target.value)}
          >
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {getLabel(PAYMENT_METHOD_LABELS, value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ngày thanh toán">
          <input
            type="date"
            value={form.paidAt}
            onChange={(event) => update("paidAt", event.target.value)}
          />
        </Field>
        <Field label="Ghi chú bắt buộc">
          <textarea
            aria-label="Ghi chú bắt buộc"
            value={form.note}
            onChange={(event) => update("note", event.target.value)}
          />
        </Field>
        <button
          className="btn-primary tx-submit"
          disabled={!valid}
          onClick={() => onSubmit({ ...form, amount, note: form.note.trim() })}
        >
          Ghi nhận thanh toán
        </button>
      </div>
    </div>
  );
}

function SupplierPayableDetailDrawer({ payable, onClose }) {
  if (!payable) return null;
  return (
    <aside className="tx-detail-drawer">
      <button className="drawer-close" onClick={onClose} aria-label="Đóng">
        ×
      </button>
      <h3>Chi tiết khoản phải trả</h3>
      <section>
        <h4>Nhà cung cấp</h4>
        <p>{payable.supplierName}</p>
        <small>
          {getLabel(SOURCE_KIND_LABELS, payable.sourceKind)} ·{" "}
          {getLabel(STATUS_LABELS, payable.status)}
        </small>
      </section>
      <section>
        <h4>Số tiền</h4>
        <p>
          {fmt(payable.paidAmount)} đã trả / {fmt(payable.amount)}
        </p>
        <strong>Còn {fmt(payable.remainingAmount)}</strong>
      </section>
      <section>
        <h4>Hạn thanh toán</h4>
        <p>{asDate(payable.dueDate)}</p>
      </section>
      <section>
        <h4>Dòng tiền liên quan</h4>
        {(payable.cashflowIds || []).length ? (
          payable.cashflowIds.map((id) => <p key={id}>{id}</p>)
        ) : (
          <p>-</p>
        )}
      </section>
      <section>
        <h4>Lịch sử xử lý</h4>
        {(payable.auditTrail || []).length ? (
          payable.auditTrail.map((log, index) => (
            <p key={`${log.action}-${index}`}>
              {log.action} · {getLabel(STATUS_LABELS, log.nextStatus)} ·{" "}
              {asDate(log.at)}
            </p>
          ))
        ) : (
          <p>-</p>
        )}
      </section>
    </aside>
  );
}

function TransactionDetailDrawer({
  item,
  onClose,
  onRefund,
  onEditCashflow,
  onVoidCashflow,
  refundEligible,
  canFinanceWrite,
}) {
  if (!item) return null;
  return (
    <aside className="tx-detail-drawer">
      <button className="drawer-close" onClick={onClose} aria-label="Đóng">
        ×
      </button>
      <h3>Chi tiết giao dịch</h3>
      <section>
        <h4>Thông tin chung</h4>
        <p>{item.description || item.note || "Giao dịch"}</p>
        <small>{asDate(item.occurredAt || item.createdAt)}</small>
      </section>
      <section>
        <h4>Số tiền</h4>
        <strong
          className={item.type === "INFLOW" ? "text-success" : "text-danger"}
        >
          {item.type === "INFLOW" ? "+" : "-"}
          {fmt(item.amount)}
        </strong>
      </section>
      <section>
        <h4>Phân loại</h4>
        <p>
          {getLabel(TYPE_LABELS, item.type)} ·{" "}
          {getLabel(CASHFLOW_CATEGORY_LABELS, item.category)} ·{" "}
          {getLabel(
            CASHFLOW_SUBCATEGORY_LABELS,
            item.subcategory || item.source,
          )}
        </p>
        <small>
          {getLabel(PAYMENT_METHOD_LABELS, item.method)} ·{" "}
          {getLabel(STATUS_LABELS, item.status)}
        </small>
      </section>
      <section>
        <h4>Tham chiếu</h4>
        <p>{item.referenceType || item.reference?.kind || "-"}</p>
        <small>{item.referenceId || item.reference?.id || "-"}</small>
      </section>
      <div className="tx-card-actions">
        {refundEligible && (
          <button onClick={() => onRefund(item)}>Tạo hoàn tiền</button>
        )}
        {canFinanceWrite &&
          item.source === "manual" &&
          ["draft", "pending"].includes(item.status) && (
            <button onClick={() => onEditCashflow(item)}>Sửa</button>
          )}
        {canFinanceWrite &&
          item.source === "manual" &&
          item.status !== "voided" && (
            <button onClick={() => onVoidCashflow(item)}>Hủy ghi nhận</button>
          )}
      </div>
    </aside>
  );
}

function RefundDetailDrawer({ refund, onClose, actions }) {
  if (!refund) return null;
  return (
    <aside className="tx-detail-drawer">
      <button className="drawer-close" onClick={onClose} aria-label="Đóng">
        ×
      </button>
      <h3>Chi tiết hoàn tiền</h3>
      <section>
        <h4>Trạng thái xử lý</h4>
        <p>{getLabel(STATUS_LABELS, refund.status)}</p>
        <small>{asDate(refund.updatedAt || refund.createdAt)}</small>
      </section>
      <section>
        <h4>Số tiền & lý do</h4>
        <strong>{fmt(refund.amount)}</strong>
        <p>{refund.reason}</p>
      </section>
      <section>
        <h4>Liên kết</h4>
        <p>Dòng tiền: {refund.cashflowId || "-"}</p>
        <small>
          Thanh toán: {refund.paymentTransactionId || "-"} · Hóa đơn:{" "}
          {refund.invoiceId || "-"} · Đơn hàng: {refund.orderId || "-"}
        </small>
      </section>
      <section>
        <h4>Lịch sử xử lý</h4>
        {(refund.auditTrail || []).length ? (
          refund.auditTrail.map((log, index) => (
            <p key={`${log.action}-${index}`}>
              {log.action} · {getLabel(STATUS_LABELS, log.nextStatus)} ·{" "}
              {asDate(log.at)}
            </p>
          ))
        ) : (
          <p>-</p>
        )}
      </section>
      <div className="tx-card-actions">{actions}</div>
    </aside>
  );
}

const ReconciliationDetailDrawer = ({ item, onClose }) =>
  item ? (
    <aside className="tx-detail-drawer">
      <button className="drawer-close" onClick={onClose} aria-label="Đóng">
        ×
      </button>
      <h3>Chi tiết đối soát</h3>
      <section>
        <h4>Trạng thái</h4>
        <p>{getLabel(STATUS_LABELS, item.status)}</p>
        <small>
          Độ tin cậy {item.matchConfidence || 0} · {item.matchReason || "-"}
        </small>
      </section>
      <section>
        <h4>Số tiền</h4>
        <p>
          Dự kiến {fmt(item.expectedAmount)} · Thực nhận {fmt(item.receivedAmount)}
        </p>
        <small>Chênh lệch {fmt(item.varianceAmount)}</small>
      </section>
      <section>
        <h4>Gợi ý khớp</h4>
        {(item.candidateMatches || []).length ? (
          item.candidateMatches.map((candidate) => (
            <p key={`${candidate.kind}-${candidate.id}`}>
              {candidate.reference || candidate.id} ·{" "}
              {getLabel(CANDIDATE_KIND_LABELS, candidate.kind)} ·{" "}
              {candidate.confidence}
            </p>
          ))
        ) : (
          <p>-</p>
        )}
      </section>
    </aside>
  ) : null;

const TransactionManagement = () => {
  const { user } = useContext(AuthContext) || {};
  const permissions = {
    financeWrite: hasAnyPermission(user, ["finance.write", "payment.write"]),
    refundWrite: hasAnyPermission(user, ["refund.write", "payment.write"]),
    reconciliationWrite: hasAnyPermission(user, [
      "reconciliation.write",
      "payment.write",
    ]),
    export: hasAnyPermission(user, ["finance.export", "report.export"]),
  };
  const navQuery = useMemo(readNavigationQuery, []);
  const tx = useTransactions();
  const [activeTab, setActiveTab] = useState(navQuery.tab || "journal");
  const [selected, setSelected] = useState(null);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [selectedReconciliation, setSelectedReconciliation] = useState(null);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [supplierPayableModal, setSupplierPayableModal] = useState(null);
  const [supplierPaymentModal, setSupplierPaymentModal] = useState(null);
  const [cashflowModal, setCashflowModal] = useState(null);
  const [refundSourcePicker, setRefundSourcePicker] = useState(false);
  const [refundSource, setRefundSource] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [manualMatchContext, setManualMatchContext] = useState(null);
  const [actionError, setActionError] = useState("");

  const runAction = async (operation, onSuccess) => {
    setActionError("");
    try {
      await operation();
      onSuccess?.();
    } catch (error) {
      setActionError(error?.message || "Không thể thực hiện thao tác.");
    }
  };

  useEffect(() => {
    const handler = (event) => {
      if (event?.detail?.page !== "transactions") return;
      const query = event.detail.query || {};
      if (query.tab) setActiveTab(query.tab);
      if (query.type || query.category || query.subcategory) {
        tx.setFilters((previous) => ({
          ...previous,
          type: query.type || previous.type,
          category: query.category || previous.category,
          subcategory: query.subcategory || previous.subcategory,
        }));
      }
    };
    window.addEventListener("manager:navigation-query", handler);
    if (
      navQuery.type !== "all" ||
      navQuery.category ||
      navQuery.subcategory
    ) {
      tx.setFilters((previous) => ({
        ...previous,
        type: navQuery.type,
        category: navQuery.category,
        subcategory: navQuery.subcategory,
      }));
    }
    return () => window.removeEventListener("manager:navigation-query", handler);
    // Navigation query is intentionally applied once; subsequent navigation uses the event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTotals = useMemo(
    () =>
      tx.transactions.reduce(
        (totals, item) => {
          if (item.type === "INFLOW") totals.inflow += Number(item.amount || 0);
          if (item.type === "OUTFLOW") totals.outflow += Number(item.amount || 0);
          return totals;
        },
        { inflow: 0, outflow: 0 },
      ),
    [tx.transactions],
  );
  const updateFilter = (key, value) =>
    tx.setFilters((previous) => ({ ...previous, [key]: value }));
  const selectedRestaurant = tx.restaurants.find(
    (restaurant) => String(restaurant.id) === String(tx.restaurantId),
  );
  const openPayables = tx.supplierPayables.filter(
    (payable) => !["paid", "voided"].includes(payable.status),
  ).length;
  const pendingRefunds = tx.refunds.filter((refund) =>
    ["pending", "approved", "processing", "failed"].includes(refund.status),
  ).length;
  const needReconciliation = tx.reconciliations.filter((reconciliation) =>
    RECONCILIATION_ACTIONABLE_STATUSES.has(reconciliation.status),
  ).length;
  const selectedRefundEligible =
    permissions.refundWrite &&
    isRefundEligible(selected) &&
    Number(selected?.amount || 0) -
      refundAmountForTransaction(selected, tx.refunds) >
      0;

  const refundActions = selectedRefund ? (
    <>
      {selectedRefund.status === "pending" && (
        <>
          <button
            onClick={() =>
              runAction(
                () => tx.approveRefundRequest(selectedRefund.id),
                () => setSelectedRefund(null),
              )
            }
          >
            Duyệt
          </button>
          <button
            onClick={() =>
              setConfirmAction({
                title: "Từ chối hoàn tiền",
                message: "Nhập lý do từ chối để lưu lịch sử xử lý.",
                onConfirm: (reason) =>
                  runAction(
                    () => tx.rejectRefundRequest(selectedRefund.id, reason),
                    () => {
                      setConfirmAction(null);
                      setSelectedRefund(null);
                    },
                  ),
              })
            }
          >
            Từ chối
          </button>
          <button
            onClick={() =>
              setConfirmAction({
                title: "Hủy yêu cầu hoàn tiền",
                message: "Nhập lý do hủy yêu cầu hoàn tiền.",
                onConfirm: (reason) =>
                  runAction(
                    () => tx.cancelRefundRequest(selectedRefund.id, reason),
                    () => {
                      setConfirmAction(null);
                      setSelectedRefund(null);
                    },
                  ),
              })
            }
          >
            Hủy
          </button>
        </>
      )}
      {selectedRefund.status === "approved" && (
        <>
          <button
            onClick={() =>
              runAction(
                () => tx.processRefundRequest(selectedRefund.id, {}),
                () => setSelectedRefund(null),
              )
            }
          >
            Xử lý
          </button>
          <button
            onClick={() =>
              setConfirmAction({
                title: "Hủy yêu cầu hoàn tiền",
                message: "Nhập lý do hủy yêu cầu đã duyệt.",
                onConfirm: (reason) =>
                  runAction(
                    () => tx.cancelRefundRequest(selectedRefund.id, reason),
                    () => {
                      setConfirmAction(null);
                      setSelectedRefund(null);
                    },
                  ),
              })
            }
          >
            Hủy
          </button>
        </>
      )}
      {selectedRefund.status === "failed" && (
        <button
          onClick={() =>
            runAction(
              () => tx.retryRefundRequest(selectedRefund.id, {}),
              () => setSelectedRefund(null),
            )
          }
        >
          Thử lại
        </button>
      )}
    </>
  ) : null;

  return (
    <div className="finance-dashboard transactions-page transactions-page--polished">
      <header className="page-header finance-hero tx-hero">
        <div className="header-left">
          <span className="eyebrow">Giao dịch & kiểm soát</span>
          <h1>Giao dịch, hoàn tiền & đối soát</h1>
          <p>
            Theo dõi dòng tiền, yêu cầu hoàn tiền, giao dịch ngân hàng và công nợ trong một màn hình kiểm soát.
          </p>
          <div className="tx-context-pills" aria-label="Ngữ cảnh giao dịch">
            <span>{selectedRestaurant?.name || "Chưa chọn nhà hàng"}</span>
            <span>
              {asDateOnly(tx.filters.dateFrom)} → {asDateOnly(tx.filters.dateTo)}
            </span>
            <span>{needReconciliation} giao dịch cần đối soát</span>
          </div>
        </div>
        <div className="header-actions finance-toolbar tx-toolbar">
          <select
            className="btn-secondary"
            value={tx.restaurantId || ""}
            onChange={(event) => tx.setRestaurantId(event.target.value)}
          >
            <option value="">Chọn nhà hàng</option>
            {tx.restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary"
            disabled={!tx.restaurantId || !tx.isDateRangeValid || tx.loading}
            onClick={() => runAction(() => tx.refetch())}
          >
            <RefreshCw size={16} /> Làm mới
          </button>
          {permissions.financeWrite && (
            <button
              className="btn-secondary"
              disabled={!tx.restaurantId || !tx.isDateRangeValid}
              onClick={() => setCashflowModal({ mode: "create" })}
            >
              <FilePlus2 size={16} /> Ghi nhận thu/chi
            </button>
          )}
          {permissions.refundWrite && (
            <button
              className="btn-secondary"
              disabled={!tx.restaurantId || !tx.isDateRangeValid}
              onClick={() => setRefundSourcePicker(true)}
            >
              <Undo2 size={16} /> Hoàn tiền từ giao dịch
            </button>
          )}
          {permissions.export && (
            <button
              className="btn-primary"
              disabled={!tx.restaurantId || !tx.isDateRangeValid || tx.loading}
              onClick={() => exportCsv(tx)}
            >
              <Download size={16} /> Xuất CSV
            </button>
          )}
        </div>
      </header>

      {(tx.error || actionError) && (
        <div className="finance-error">
          {actionError ||
            (tx.isDateRangeValid
              ? "Không thể tải dữ liệu giao dịch. Vui lòng thử lại."
              : "Vui lòng chọn đủ khoảng ngày và bảo đảm ngày bắt đầu không sau ngày kết thúc.")}
        </div>
      )}

      <div className="tx-tabs">
        {[
          ["journal", "Nhật ký giao dịch"],
          ["cashflow", "Dòng tiền"],
          ["refund", "Hoàn tiền"],
          ["reconciliation", "Đối soát"],
          ["bank", "Giao dịch ngân hàng"],
          ["debt", "Công nợ"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={activeTab === key ? "active" : ""}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="tx-filter-card card-container">
        <div className="tx-filter-grid">
          <Field label="Từ ngày">
            <input
              type="date"
              value={tx.filters.dateFrom}
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </Field>
          <Field label="Đến ngày">
            <input
              type="date"
              value={tx.filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
          </Field>
          <Field label="Loại">
            <select
              value={tx.filters.type}
              onChange={(event) => updateFilter("type", event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="INFLOW">Thu</option>
              <option value="OUTFLOW">Chi</option>
            </select>
          </Field>
          <Field label="Danh mục">
            <select
              value={tx.filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="">Tất cả</option>
              {CASHFLOW_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {getLabel(CASHFLOW_CATEGORY_LABELS, value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nhóm chi tiết">
            <select
              value={tx.filters.subcategory}
              onChange={(event) => updateFilter("subcategory", event.target.value)}
            >
              <option value="">Tất cả</option>
              {CASHFLOW_SUBCATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {getLabel(CASHFLOW_SUBCATEGORY_LABELS, value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phương thức">
            <select
              value={tx.filters.method}
              onChange={(event) => updateFilter("method", event.target.value)}
            >
              <option value="">Tất cả</option>
              {PAYMENT_METHODS.map((value) => (
                <option key={value} value={value}>
                  {getLabel(PAYMENT_METHOD_LABELS, value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mã tham chiếu">
            <input
              value={tx.filters.referenceId}
              onChange={(event) => updateFilter("referenceId", event.target.value)}
              placeholder="Nhập mã giao dịch/hóa đơn"
            />
          </Field>
          <Field label="Tìm kiếm">
            <div className="search-box">
              <Search size={15} />
              <input
                value={tx.filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Nội dung, nguồn hoặc ghi chú"
              />
            </div>
          </Field>
        </div>
      </section>

      <div className="tx-summary-strip">
        <div>
          <span>Tổng thu</span>
          <strong>{fmt(filteredTotals.inflow)}</strong>
        </div>
        <div>
          <span>Tổng chi</span>
          <strong>{fmt(filteredTotals.outflow)}</strong>
        </div>
        <div>
          <span>Yêu cầu hoàn tiền</span>
          <strong>{pendingRefunds}</strong>
        </div>
        <div>
          <span>Khoản phải trả mở</span>
          <strong>{openPayables}</strong>
        </div>
      </div>

      {activeTab === "journal" && (
        <section className="card-container tx-panel">
          <div className="card-header">
            <h3>Nhật ký giao dịch hợp nhất</h3>
          </div>
          <TransactionTable transactions={tx.transactions} onSelect={setSelected} />
        </section>
      )}

      {activeTab === "cashflow" && (
        <section className="card-container tx-panel">
          <div className="card-header">
            <h3>Dòng tiền thu / chi</h3>
          </div>
          <TransactionTable
            transactions={tx.cashflows.map((cashflow) => ({
              ...cashflow,
              description:
                cashflow.note || cashflow.reference?.kind || "Dòng tiền",
              category: `${getLabel(CASHFLOW_CATEGORY_LABELS, cashflow.category || "other")}/${getLabel(CASHFLOW_SUBCATEGORY_LABELS, cashflow.subcategory || "other")}`,
              referenceType: cashflow.reference?.kind,
              referenceId: cashflow.reference?.id,
            }))}
            onSelect={setSelected}
          />
        </section>
      )}

      {activeTab === "refund" && (
        <section className="card-container tx-panel">
          <div className="card-header">
            <h3>Lịch sử hoàn tiền</h3>
          </div>
          <div className="tx-cards-grid">
            {tx.refunds.length === 0 ? (
              <EmptyNote>Chưa có yêu cầu hoàn tiền.</EmptyNote>
            ) : (
              tx.refunds.map((refund) => (
                <article
                  key={refund.id}
                  className="tx-record-card"
                  onClick={() => setSelectedRefund(refund)}
                >
                  <div>
                    <strong>{fmt(refund.amount)}</strong>
                    <span
                      className={`badge ${refund.status === "success" ? "success" : "warning"}`}
                    >
                      {getLabel(STATUS_LABELS, refund.status)}
                    </span>
                  </div>
                  <p>{refund.reason}</p>
                  <small>
                    {getLabel(PAYMENT_METHOD_LABELS, refund.method)} · Dòng tiền{" "}
                    {refund.cashflowId || "-"}
                  </small>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === "reconciliation" && (
        <section className="card-container tx-panel">
          <div className="card-header">
            <h3>Hàng chờ đối soát</h3>
            <select
              value={tx.reconciliationStatus}
              onChange={(event) => tx.setReconciliationStatus(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="matched">Đã khớp</option>
              <option value="amount_mismatch">Lệch số tiền</option>
              <option value="unmatched">Chưa khớp</option>
              <option value="duplicate">Trùng giao dịch</option>
              <option value="resolved">Đã xử lý</option>
              <option value="ignored">Đã bỏ qua</option>
            </select>
          </div>
          <div className="tx-cards-grid">
            {tx.reconciliations.map((reconciliation) => (
              <article
                key={reconciliation.id}
                className="tx-record-card"
                onClick={() => setSelectedReconciliation(reconciliation)}
              >
                <div>
                  <strong>
                    {reconciliation.paymentReference || reconciliation.id}
                  </strong>
                  <span
                    className={`badge ${reconciliation.status === "matched" ? "success" : "warning"}`}
                  >
                    {getLabel(STATUS_LABELS, reconciliation.status)}
                  </span>
                </div>
                <p>
                  Dự kiến {fmt(reconciliation.expectedAmount)} · Thực nhận{" "}
                  {fmt(reconciliation.receivedAmount)} · Chênh lệch{" "}
                  {fmt(reconciliation.varianceAmount)}
                </p>
                <small>
                  Độ tin cậy {reconciliation.matchConfidence || 0} ·{" "}
                  {reconciliation.matchReason || "-"}
                </small>
                <div className="tx-card-actions">
                  {permissions.reconciliationWrite &&
                    RECONCILIATION_ACTIONABLE_STATUSES.has(
                      reconciliation.status,
                    ) && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmAction({
                            title: "Đóng ngoại lệ đối soát",
                            message:
                              "Ghi chú xử lý là bắt buộc để đóng ngoại lệ.",
                            onConfirm: (note) =>
                              runAction(
                                () =>
                                  tx.resolveReconciliation({
                                    reconciliationId: reconciliation.id,
                                    resolution:
                                      reconciliation.status ===
                                      "amount_mismatch"
                                        ? "accept_mismatch"
                                        : "ignore",
                                    note,
                                  }),
                                () => setConfirmAction(null),
                              ),
                          });
                        }}
                      >
                        <ShieldCheck size={14} /> Đóng
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "bank" && (
        <section className="card-container tx-panel">
          <div className="card-header">
            <h3>Giao dịch ngân hàng</h3>
            <select
              value={tx.bankStatus}
              onChange={(event) => tx.setBankStatus(event.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="unmatched">Chưa khớp</option>
              <option value="matched">Đã khớp</option>
              <option value="amount_mismatch">Lệch số tiền</option>
              <option value="resolved">Đã xử lý</option>
              <option value="ignored">Đã bỏ qua</option>
            </select>
          </div>
          <div className="tx-cards-grid">
            {tx.bankTransactions.map((bankTransaction) => {
              const reconciliation = tx.reconciliations.find(
                (item) => item.bankTransactionId === bankTransaction.id,
              );
              const canAct = BANK_ACTIONABLE_STATUSES.has(
                String(bankTransaction.matchStatus || ""),
              );
              return (
                <article key={bankTransaction.id} className="tx-record-card">
                  <div>
                    <strong>{fmt(bankTransaction.amount)}</strong>
                    <span
                      className={`badge ${bankTransaction.matchStatus === "matched" ? "success" : "warning"}`}
                    >
                      {getLabel(STATUS_LABELS, bankTransaction.matchStatus)}
                    </span>
                  </div>
                  <p>
                    {bankTransaction.transferContent ||
                      bankTransaction.description ||
                      bankTransaction.transactionId}
                  </p>
                  <small>
                    {bankTransaction.provider} ·{" "}
                    {safeBankAccountLabel(bankTransaction)}
                  </small>
                  <div className="tx-card-actions">
                    {permissions.reconciliationWrite && canAct && (
                      <>
                        <button
                          onClick={() =>
                            runAction(() =>
                              tx.reconcileBankTransaction(bankTransaction.id),
                            )
                          }
                        >
                          Tự động khớp
                        </button>
                        <button
                          onClick={() =>
                            setManualMatchContext({
                              bankTransaction,
                              reconciliation,
                            })
                          }
                        >
                          Ghép thủ công
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              title: "Bỏ qua giao dịch ngân hàng",
                              message:
                                "Giao dịch sẽ không còn nằm trong hàng chờ. Nhập lý do để lưu lịch sử.",
                              onConfirm: (reason) =>
                                runAction(
                                  () =>
                                    tx.ignoreBankTransaction(
                                      bankTransaction.id,
                                      reason,
                                    ),
                                  () => setConfirmAction(null),
                                ),
                            })
                          }
                        >
                          Bỏ qua
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "debt" && (
        <section className="card-container tx-panel">
          <div className="card-header warning-bg">
            <h3>Công nợ phải thu / phải trả</h3>
            {permissions.financeWrite && (
              <button
                className="text-btn"
                onClick={() => setSupplierPayableModal({ mode: "create" })}
              >
                Tạo khoản phải trả
              </button>
            )}
          </div>
          <div className="debt-split-grid">
            <div className="debt-column">
              <h4>Khoản phải thu</h4>
              <div className="tx-cards-grid tx-cards-grid--single">
                {tx.receivables.length === 0 ? (
                  <EmptyNote>Chưa có hóa đơn phải thu cần xử lý.</EmptyNote>
                ) : (
                  tx.receivables.map((receivable) => (
                    <article key={receivable.id} className="tx-record-card">
                      <div>
                        <strong>{receivable.supplier}</strong>
                        <span className="badge warning">
                          {getLabel(STATUS_LABELS, receivable.status)}
                        </span>
                      </div>
                      <p>Còn phải thu {fmt(receivable.amount)}</p>
                      <small>Hạn {asDate(receivable.dueDate)}</small>
                    </article>
                  ))
                )}
              </div>
            </div>
            <div className="debt-column">
              <h4>Khoản phải trả nhà cung cấp</h4>
              <div className="tx-cards-grid tx-cards-grid--single">
                {tx.supplierPayables.map((payable) => {
                  const canEdit = !["paid", "voided"].includes(payable.status);
                  const canVoid = canEdit && Number(payable.paidAmount || 0) <= 0;
                  return (
                    <article key={payable.id} className="tx-record-card">
                      <div>
                        <strong>{payable.supplierName}</strong>
                        <span
                          className={`badge ${payable.status === "paid" ? "success" : "warning"}`}
                        >
                          {getLabel(STATUS_LABELS, payable.status)}
                        </span>
                      </div>
                      <p>
                        Còn phải trả {fmt(payable.remainingAmount)} /{" "}
                        {fmt(payable.amount)} · đã trả {fmt(payable.paidAmount)}
                      </p>
                      <small>
                        Hạn {asDate(payable.dueDate)} ·{" "}
                        {getLabel(SOURCE_KIND_LABELS, payable.sourceKind)} ·{" "}
                        {(payable.cashflowIds || []).length} dòng tiền liên quan
                      </small>
                      <div className="tx-card-actions">
                        <button onClick={() => setSelectedPayable(payable)}>
                          Chi tiết
                        </button>
                        {permissions.financeWrite && canEdit && (
                          <>
                            <button
                              onClick={() =>
                                setSupplierPayableModal({
                                  mode: "edit",
                                  payable,
                                })
                              }
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => setSupplierPaymentModal(payable)}
                            >
                              Thanh toán
                            </button>
                            {canVoid && (
                              <button
                                onClick={() =>
                                  setConfirmAction({
                                    title: "Hủy ghi nhận khoản phải trả",
                                    message:
                                      "Chỉ khoản chưa phát sinh thanh toán mới được hủy. Nhập lý do để lưu lịch sử.",
                                    onConfirm: (reason) =>
                                      runAction(
                                        () =>
                                          tx.voidSupplierPayable(
                                            payable.id,
                                            reason,
                                          ),
                                        () => setConfirmAction(null),
                                      ),
                                  })
                                }
                              >
                                Hủy ghi nhận
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {supplierPayableModal && (
        <SupplierPayableModal
          payable={supplierPayableModal.payable}
          onClose={() => setSupplierPayableModal(null)}
          onSubmit={(input) =>
            runAction(
              () =>
                supplierPayableModal.payable
                  ? tx.updateSupplierPayable(
                      supplierPayableModal.payable.id,
                      input,
                    )
                  : tx.createSupplierPayable(input),
              () => setSupplierPayableModal(null),
            )
          }
        />
      )}
      {supplierPaymentModal && (
        <SupplierPaymentModal
          payable={supplierPaymentModal}
          onClose={() => setSupplierPaymentModal(null)}
          onSubmit={(input) =>
            runAction(
              () => tx.recordSupplierPayment(supplierPaymentModal.id, input),
              () => setSupplierPaymentModal(null),
            )
          }
        />
      )}
      {cashflowModal && (
        <ManualCashflowModal
          initial={cashflowModal.item}
          onClose={() => setCashflowModal(null)}
          onSubmit={(input) =>
            runAction(
              () =>
                cashflowModal.item
                  ? tx.updateManualCashflow(cashflowModal.item.id, input)
                  : tx.createManualCashflow(input),
              () => setCashflowModal(null),
            )
          }
          onVoid={(item) =>
            setConfirmAction({
              title: "Hủy ghi nhận dòng tiền",
              message: "Nhập lý do hủy ghi nhận dòng tiền thủ công.",
              onConfirm: (reason) =>
                runAction(
                  () => tx.voidManualCashflow(item.id, reason),
                  () => {
                    setConfirmAction(null);
                    setCashflowModal(null);
                    setSelected(null);
                  },
                ),
            })
          }
        />
      )}
      {refundSourcePicker && (
        <RefundSourcePickerModal
          transactions={tx.transactions}
          refunds={tx.refunds}
          onClose={() => setRefundSourcePicker(false)}
          onSelect={(transaction) => {
            setRefundSourcePicker(false);
            setRefundSource(transaction);
          }}
        />
      )}
      {refundSource && (
        <RefundRequestModal
          transaction={refundSource}
          refunds={tx.refunds}
          onClose={() => setRefundSource(null)}
          onSubmit={(input) =>
            runAction(
              () => tx.createRefundRequest(input),
              () => {
                setRefundSource(null);
                setSelected(null);
                setActiveTab("refund");
              },
            )
          }
        />
      )}
      {manualMatchContext && (
        <ManualMatchModal
          {...manualMatchContext}
          onClose={() => setManualMatchContext(null)}
          onMatch={(input) =>
            runAction(
              () => tx.manualMatchBankTransaction(input),
              () => setManualMatchContext(null),
            )
          }
        />
      )}
      {confirmAction && (
        <ConfirmFinancialActionModal
          {...confirmAction}
          onClose={() => setConfirmAction(null)}
        />
      )}

      <TransactionDetailDrawer
        item={selected}
        onClose={() => setSelected(null)}
        refundEligible={selectedRefundEligible}
        canFinanceWrite={permissions.financeWrite}
        onRefund={(item) => setRefundSource(item)}
        onEditCashflow={(item) => setCashflowModal({ mode: "edit", item })}
        onVoidCashflow={(item) =>
          setConfirmAction({
            title: "Hủy ghi nhận dòng tiền",
            message: "Nhập lý do hủy ghi nhận dòng tiền thủ công.",
            onConfirm: (reason) =>
              runAction(
                () => tx.voidManualCashflow(item.id, reason),
                () => {
                  setConfirmAction(null);
                  setSelected(null);
                },
              ),
          })
        }
      />
      <RefundDetailDrawer
        refund={selectedRefund}
        onClose={() => setSelectedRefund(null)}
        actions={permissions.refundWrite ? refundActions : null}
      />
      <ReconciliationDetailDrawer
        item={selectedReconciliation}
        onClose={() => setSelectedReconciliation(null)}
      />
      <SupplierPayableDetailDrawer
        payable={selectedPayable}
        onClose={() => setSelectedPayable(null)}
      />
    </div>
  );
};

export default TransactionManagement;
