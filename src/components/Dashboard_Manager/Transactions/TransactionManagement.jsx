import React, { useContext, useEffect, useMemo, useState } from "react";
import { Download, FilePlus2, RefreshCw, Search, ShieldCheck, Undo2, X } from "lucide-react";
import "../Finance/FinanceDashboard.scss";
import { TransactionTable } from "../Finance/FinanceComponents";
import { AuthContext } from "@/context/AuthContext";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import { CASHFLOW_CATEGORIES, CASHFLOW_STATUSES, CASHFLOW_SUBCATEGORIES, PAYMENT_METHODS, useTransactions } from "@/hooks/useTransactions";

const fmt = (num) => `${Number(num || 0).toLocaleString("vi-VN")}đ`;
const todayInput = () => new Date().toISOString().slice(0, 10);
const safeBankAccountLabel = (bankTransaction = {}) =>
  bankTransaction.bankAccountNumberMasked ||
  (bankTransaction.bankAccountNumberLast4 ? `****${bankTransaction.bankAccountNumberLast4}` : "-");
const asDate = (value) => value ? new Date(value).toLocaleString("vi-VN") : "-";

function readNavigationQuery() {
  const params = new URLSearchParams(window.location.search || "");
  return { tab: params.get("tab") || "journal", type: params.get("type") || "all", category: params.get("category") || "", subcategory: params.get("subcategory") || "" };
}

function exportCsv({ transactions, cashflows, refunds, reconciliations, bankTransactions, supplierPayables }) {
  const rows = [
    ["Kind", "Date", "Description", "Type/Status", "Amount", "Source", "Reference", "Method"],
    ...transactions.map((t) => ["journal", t.occurredAt, t.description, `${t.type}/${t.status}`, t.amount, t.source || "", t.referenceId || "", t.method || ""]),
    ...cashflows.map((c) => ["cashflow", c.occurredAt, c.note, `${c.category}/${c.subcategory}/${c.status}`, c.amount, c.source || "", c.reference?.kind || "", c.method || ""]),
    ...refunds.map((r) => ["refund", r.createdAt, r.reason, r.status, r.amount, "refund", r.paymentTransactionId || r.invoiceId || r.orderId || "", r.method]),
    ...reconciliations.map((r) => ["reconciliation", r.createdAt, r.note || r.paymentReference, `${r.status}/${r.matchConfidence || 0}`, r.receivedAmount, "bank", r.bankTransactionId || r.paymentSessionId || "", r.matchReason || ""]),
    ...bankTransactions.map((b) => ["bank", b.occurredAt || b.createdAt, b.transferContent || b.description, b.matchStatus, b.amount, b.provider, b.transactionId || "", safeBankAccountLabel(b)]),
    ...supplierPayables.map((p) => ["supplier_payable", p.dueDate || p.createdAt, p.supplierName, p.status, p.remainingAmount, p.sourceKind, p.id, ""]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const Field = ({ label, children }) => <label className="tx-field"><span>{label}</span>{children}</label>;

function ConfirmFinancialActionModal({ title, message, reasonLabel = "Lý do", confirmLabel = "Xác nhận", onConfirm, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card">
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <h3>{title}</h3>
        <p>{message}</p>
        <Field label={reasonLabel}><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <button className="btn-primary tx-submit" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>{confirmLabel}</button>
      </div>
    </div>
  );
}

function ManualCashflowModal({ initial, onSubmit, onClose, onVoid }) {
  const [form, setForm] = useState(initial || { type: "OUTFLOW", amount: "", category: "operations", subcategory: "utility", method: "bank_transfer", status: "completed", occurredAt: todayInput(), note: "" });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const canEdit = !initial || ["draft", "pending"].includes(initial.status);
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card tx-modal-card--wide">
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <h3>{initial ? "Cập nhật cashflow thủ công" : "Ghi nhận thu / chi thủ công"}</h3>
        <div className="tx-form-grid">
          <Field label="Loại"><select disabled={!canEdit} value={form.type} onChange={(e) => update("type", e.target.value)}><option value="INFLOW">Thu</option><option value="OUTFLOW">Chi</option></select></Field>
          <Field label="Số tiền"><input disabled={!canEdit} type="number" min="1" value={form.amount} onChange={(e) => update("amount", e.target.value)} /></Field>
          <Field label="Category"><select disabled={!canEdit} value={form.category} onChange={(e) => update("category", e.target.value)}>{CASHFLOW_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Subcategory"><select disabled={!canEdit} value={form.subcategory} onChange={(e) => update("subcategory", e.target.value)}>{CASHFLOW_SUBCATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Phương thức"><select disabled={!canEdit} value={form.method} onChange={(e) => update("method", e.target.value)}>{PAYMENT_METHODS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Trạng thái"><select disabled={!canEdit} value={form.status} onChange={(e) => update("status", e.target.value)}>{CASHFLOW_STATUSES.filter((x) => x !== "voided").map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Ngày phát sinh"><input disabled={!canEdit} type="date" value={String(form.occurredAt || "").slice(0, 10)} onChange={(e) => update("occurredAt", e.target.value)} /></Field>
          <Field label="Ghi chú"><textarea disabled={!canEdit} value={form.note || ""} onChange={(e) => update("note", e.target.value)} /></Field>
        </div>
        <div className="tx-modal-actions">
          {canEdit && <button className="btn-primary" onClick={() => onSubmit({ ...form, amount: Number(form.amount || 0), currency: "VND" })}>Lưu</button>}
          {initial && <button className="btn-danger-soft" onClick={() => onVoid(initial)}>Void với lý do</button>}
        </div>
      </div>
    </div>
  );
}

function RefundRequestModal({ transaction, onSubmit, onClose }) {
  const paidAmount = Number(transaction?.amount || transaction?.paidAmount || 0);
  const refundedAmount = Number(transaction?.refundedAmount || 0);
  const remaining = Math.max(paidAmount - refundedAmount, 0);
  const [amount, setAmount] = useState(remaining || "");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("cash");
  const referenceId = transaction?.referenceId || transaction?.id;
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card">
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <h3>Tạo yêu cầu hoàn tiền</h3>
        <div className="tx-readonly-summary"><span>Giao dịch nguồn</span><strong>{transaction?.description || referenceId}</strong><small>Đã thanh toán {fmt(paidAmount)} · đã hoàn {fmt(refundedAmount)} · còn {fmt(remaining || paidAmount)}</small></div>
        <Field label="Số tiền hoàn"><input type="number" min="1" max={remaining || paidAmount} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Phương thức"><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">cash</option><option value="bank_transfer">bank_transfer</option><option value="e_wallet">e_wallet</option><option value="provider">provider/mock</option></select></Field>
        <Field label="Lý do"><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <button className="btn-primary tx-submit" disabled={!reason.trim() || !(Number(amount) > 0) || (remaining > 0 && Number(amount) > remaining)} onClick={() => onSubmit({ paymentTransactionId: transaction?.referenceType === "PaymentTransaction" ? referenceId : null, invoiceId: transaction?.referenceType === "Invoice" ? referenceId : null, orderId: transaction?.referenceType === "Order" ? referenceId : null, amount: Number(amount), method, reason })}>Tạo refund request</button>
      </div>
    </div>
  );
}

function ManualMatchModal({ bankTransaction, reconciliation, onMatch, onClose }) {
  const candidates = reconciliation?.candidateMatches || [];
  const [selected, setSelected] = useState(candidates[0] || null);
  const [note, setNote] = useState("");
  const [forceMatch, setForceMatch] = useState(false);
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card tx-modal-card--wide">
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <h3>Manual match giao dịch ngân hàng</h3>
        <p>{fmt(bankTransaction?.amount)} · {bankTransaction?.transferContent || bankTransaction?.description}</p>
        <div className="candidate-list">
          {candidates.length === 0 ? <div className="empty-note">Không có candidate đủ tin cậy. Có thể force match nhưng bắt buộc ghi lý do.</div> : candidates.map((candidate) => (
            <button key={`${candidate.kind}-${candidate.id}`} className={selected?.id === candidate.id ? "active" : ""} onClick={() => setSelected(candidate)}>
              <strong>{candidate.reference || candidate.id}</strong><span>{candidate.kind} · confidence {candidate.confidence}</span><small>{fmt(candidate.expectedAmount)} · {candidate.reason}</small>
            </button>
          ))}
        </div>
        <label className="tx-checkbox"><input type="checkbox" checked={forceMatch} onChange={(e) => setForceMatch(e.target.checked)} /> Force match</label>
        <Field label="Ghi chú/lý do"><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <button className="btn-primary" disabled={(forceMatch || !selected) && !note.trim()} onClick={() => onMatch({ bankTransactionId: bankTransaction.id, paymentSessionId: selected?.paymentSessionId || null, paymentTransactionId: selected?.paymentTransactionId || null, forceMatch, note })}>Xác nhận match</button>
      </div>
    </div>
  );
}


function SupplierPayableModal({ payable, onSubmit, onClose }) {
  const [form, setForm] = useState(payable || {
    supplierName: "",
    supplierId: "",
    sourceKind: "manual",
    sourceId: "",
    amount: "",
    paidAmount: "0",
    dueDate: todayInput(),
    note: "",
  });
  const amount = Number(form.amount || 0);
  const paidAmount = Number(form.paidAmount || 0);
  const valid = form.supplierName?.trim() && amount > 0 && paidAmount <= amount;
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card tx-modal-card--wide">
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <h3>{payable ? "Sửa khoản phải trả" : "Tạo khoản phải trả"}</h3>
        <div className="tx-form-grid">
          <Field label="Nhà cung cấp"><input aria-label="supplierName" value={form.supplierName || ""} onChange={(e) => update("supplierName", e.target.value)} /></Field>
          <Field label="Supplier ID (optional)"><input value={form.supplierId || ""} onChange={(e) => update("supplierId", e.target.value)} /></Field>
          <Field label="Nguồn"><select value={form.sourceKind || "manual"} onChange={(e) => update("sourceKind", e.target.value)}><option value="inventory">inventory</option><option value="manual">manual</option><option value="supplier_invoice">supplier_invoice</option><option value="other">other</option></select></Field>
          <Field label="Source ID (optional)"><input value={form.sourceId || ""} onChange={(e) => update("sourceId", e.target.value)} /></Field>
          <Field label="Tổng phải trả"><input aria-label="amount" type="number" min="1" value={form.amount || ""} onChange={(e) => update("amount", e.target.value)} /></Field>
          <Field label="Đã trả"><input type="number" min="0" value={form.paidAmount || "0"} onChange={(e) => update("paidAmount", e.target.value)} /></Field>
          <Field label="Hạn thanh toán"><input type="date" value={String(form.dueDate || "").slice(0, 10)} onChange={(e) => update("dueDate", e.target.value)} /></Field>
          <Field label="Ghi chú"><textarea value={form.note || ""} onChange={(e) => update("note", e.target.value)} /></Field>
        </div>
        {paidAmount > amount && <div className="finance-error">Số đã trả không được vượt tổng phải trả.</div>}
        <button className="btn-primary tx-submit" disabled={!valid} onClick={() => onSubmit({
          supplierName: form.supplierName.trim(),
          supplierId: form.supplierId || null,
          sourceKind: form.sourceKind || "manual",
          sourceId: form.sourceId || null,
          amount,
          paidAmount,
          dueDate: form.dueDate || null,
          note: form.note || "",
        })}>{payable ? "Lưu khoản phải trả" : "Tạo khoản phải trả"}</button>
      </div>
    </div>
  );
}

function SupplierPaymentModal({ payable, onSubmit, onClose }) {
  const remaining = Number(payable?.remainingAmount || 0);
  const [form, setForm] = useState({ amount: remaining, method: "bank_transfer", paidAt: todayInput(), note: "" });
  const amount = Number(form.amount || 0);
  const valid = amount > 0 && amount <= remaining && String(form.note || "").trim();
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card">
        <button className="drawer-close" onClick={onClose}><X size={16} /></button>
        <h3>Ghi nhận thanh toán NCC</h3>
        <div className="tx-readonly-summary"><strong>{payable?.supplierName}</strong><small>Còn phải trả {fmt(remaining)}</small></div>
        <Field label="Số tiền"><input aria-label="paymentAmount" type="number" min="1" max={remaining} value={form.amount} onChange={(e) => update("amount", e.target.value)} /></Field>
        <Field label="Phương thức"><select value={form.method} onChange={(e) => update("method", e.target.value)}>{PAYMENT_METHODS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Ngày thanh toán"><input type="date" value={form.paidAt} onChange={(e) => update("paidAt", e.target.value)} /></Field>
        <Field label="Ghi chú bắt buộc"><textarea value={form.note} onChange={(e) => update("note", e.target.value)} /></Field>
        <button className="btn-primary tx-submit" disabled={!valid} onClick={() => onSubmit({ ...form, amount })}>Ghi nhận thanh toán</button>
      </div>
    </div>
  );
}

function SupplierPayableDetailDrawer({ payable, onClose }) {
  if (!payable) return null;
  return (
    <aside className="tx-detail-drawer">
      <button className="drawer-close" onClick={onClose}>×</button>
      <h3>Chi tiết khoản phải trả</h3>
      <section><h4>Nhà cung cấp</h4><p>{payable.supplierName}</p><small>{payable.sourceKind} · {payable.status}</small></section>
      <section><h4>Số tiền</h4><p>{fmt(payable.paidAmount)} đã trả / {fmt(payable.amount)}</p><strong>Còn {fmt(payable.remainingAmount)}</strong></section>
      <section><h4>Hạn thanh toán</h4><p>{asDate(payable.dueDate)}</p></section>
      <section><h4>Cashflow</h4>{(payable.cashflowIds || []).length ? payable.cashflowIds.map((id) => <p key={id}>{id}</p>) : <p>-</p>}</section>
      <section><h4>Audit trail</h4>{(payable.auditTrail || []).length ? payable.auditTrail.map((log, idx) => <p key={idx}>{log.action} · {log.nextStatus || "-"} · {asDate(log.at)}</p>) : <p>-</p>}</section>
    </aside>
  );
}

function TransactionDetailDrawer({ item, onClose, onRefund, onEditCashflow, onVoidCashflow, canRefund, canFinanceWrite }) {
  if (!item) return null;
  return (
    <aside className="tx-detail-drawer">
      <button className="drawer-close" onClick={onClose}>×</button>
      <h3>Chi tiết giao dịch</h3>
      <section><h4>Thông tin chung</h4><p>{item.description || item.note || "Giao dịch"}</p><small>{asDate(item.occurredAt || item.createdAt)}</small></section>
      <section><h4>Số tiền</h4><strong className={item.type === "INFLOW" ? "text-success" : "text-danger"}>{item.type === "INFLOW" ? "+" : "-"}{fmt(item.amount)}</strong></section>
      <section><h4>Phân loại</h4><p>{item.type} · {item.category} · {item.subcategory || item.source}</p><small>{item.method || "-"} · {item.status || "-"}</small></section>
      <section><h4>Reference</h4><p>{item.referenceType || item.reference?.kind || "-"}</p><small>{item.referenceId || item.reference?.id || "-"}</small></section>
      <div className="tx-card-actions">{canRefund && item.type === "INFLOW" && <button onClick={() => onRefund(item)}>Tạo hoàn tiền</button>}{canFinanceWrite && item.source === "manual" && ["draft", "pending"].includes(item.status) && <button onClick={() => onEditCashflow(item)}>Sửa</button>}{canFinanceWrite && item.source === "manual" && <button onClick={() => onVoidCashflow(item)}>Void</button>}</div>
    </aside>
  );
}

function RefundDetailDrawer({ refund, onClose, actions }) {
  if (!refund) return null;
  return (
    <aside className="tx-detail-drawer">
      <button className="drawer-close" onClick={onClose}>×</button>
      <h3>Chi tiết hoàn tiền</h3>
      <section><h4>Lifecycle</h4><p>{refund.status}</p><small>{asDate(refund.updatedAt || refund.createdAt)}</small></section>
      <section><h4>Số tiền & lý do</h4><strong>{fmt(refund.amount)}</strong><p>{refund.reason}</p></section>
      <section><h4>Liên kết</h4><p>cashflow: {refund.cashflowId || "-"}</p><small>payment: {refund.paymentTransactionId || "-"} · invoice: {refund.invoiceId || "-"} · order: {refund.orderId || "-"}</small></section>
      <section><h4>Audit trail</h4>{(refund.auditTrail || []).map((log, idx) => <p key={idx}>{log.action} · {log.nextStatus} · {asDate(log.at)}</p>)}</section>
      <div className="tx-card-actions">{actions}</div>
    </aside>
  );
}

const ReconciliationDetailDrawer = ({ item, onClose }) => item ? (
  <aside className="tx-detail-drawer"><button className="drawer-close" onClick={onClose}>×</button><h3>Đối soát</h3><section><h4>Trạng thái</h4><p>{item.status}</p><small>Confidence {item.matchConfidence || 0} · {item.matchReason || "-"}</small></section><section><h4>Số tiền</h4><p>Expected {fmt(item.expectedAmount)} · Received {fmt(item.receivedAmount)}</p><small>Variance {fmt(item.varianceAmount)}</small></section><section><h4>Candidates</h4>{(item.candidateMatches || []).map((c) => <p key={`${c.kind}-${c.id}`}>{c.reference || c.id} · {c.kind} · {c.confidence}</p>)}</section></aside>
) : null;

const TransactionManagement = () => {
  const { user } = useContext(AuthContext) || {};
  const permissions = {
    financeWrite: hasAnyPermission(user, ["finance.write", "payment.write"]),
    refundWrite: hasAnyPermission(user, ["refund.write", "payment.write"]),
    reconciliationWrite: hasAnyPermission(user, ["reconciliation.write", "payment.write"]),
    export: hasAnyPermission(user, ["finance.export", "report.export"]),
  };
  const navQuery = useMemo(readNavigationQuery, []);
  const [activeTab, setActiveTab] = useState(navQuery.tab || "journal");
  const [selected, setSelected] = useState(null);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [selectedReconciliation, setSelectedReconciliation] = useState(null);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [supplierPayableModal, setSupplierPayableModal] = useState(null);
  const [supplierPaymentModal, setSupplierPaymentModal] = useState(null);
  const [cashflowModal, setCashflowModal] = useState(null);
  const [refundSource, setRefundSource] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [manualMatchContext, setManualMatchContext] = useState(null);
  const tx = useTransactions();

  useEffect(() => {
    const handler = (event) => {
      if (event?.detail?.page !== "transactions") return;
      const query = event.detail.query || {};
      if (query.tab) setActiveTab(query.tab);
      if (query.type || query.category || query.subcategory) tx.setFilters((prev) => ({ ...prev, type: query.type || prev.type, category: query.category || prev.category, subcategory: query.subcategory || prev.subcategory }));
    };
    window.addEventListener("manager:navigation-query", handler);
    if (navQuery.type !== "all" || navQuery.category || navQuery.subcategory) tx.setFilters((prev) => ({ ...prev, type: navQuery.type, category: navQuery.category, subcategory: navQuery.subcategory }));
    return () => window.removeEventListener("manager:navigation-query", handler);
  }, []);

  const filteredTotals = useMemo(() => tx.transactions.reduce((acc, item) => {
    if (item.type === "INFLOW") acc.inflow += Number(item.amount || 0);
    if (item.type === "OUTFLOW") acc.outflow += Number(item.amount || 0);
    return acc;
  }, { inflow: 0, outflow: 0 }), [tx.transactions]);
  const updateFilter = (key, value) => tx.setFilters((prev) => ({ ...prev, [key]: value }));

  const receivables = tx.transactions.filter((item) => item.status === "UNPAID" || item.status === "PARTIAL");

  return (
    <div className="finance-dashboard transactions-page">
      <header className="page-header finance-hero">
        <div className="header-left"><span className="eyebrow">UC18 · Transaction operations</span><h1>Giao dịch, hoàn tiền & đối soát</h1><p>Module vận hành tài chính với dữ liệu nhạy cảm được mask, workflow có lý do bắt buộc và audit trail.</p></div>
        <div className="header-actions finance-toolbar">
          <select className="btn-secondary" value={tx.restaurantId || ""} onChange={(e) => tx.setRestaurantId(e.target.value)}><option value="">Chọn nhà hàng</option>{tx.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <button className="btn-secondary" onClick={() => tx.refetch()}><RefreshCw size={16} /> Làm mới</button>
          {permissions.financeWrite && <button className="btn-secondary" onClick={() => setCashflowModal({ mode: "create" })}><FilePlus2 size={16} /> Thu/chi thủ công</button>}
          {permissions.refundWrite && <button className="btn-secondary" onClick={() => setRefundSource(tx.transactions.find((item) => item.type === "INFLOW") || null)}><Undo2 size={16} /> Refund từ giao dịch</button>}
          {permissions.export && <button className="btn-primary" onClick={() => exportCsv(tx)}><Download size={16} /> Export CSV</button>}
        </div>
      </header>

      {tx.error && <div className="finance-error">Không thể tải dữ liệu giao dịch. Vui lòng thử lại.</div>}
      <div className="tx-tabs">{[["journal", "Nhật ký"], ["cashflow", "Cashflow"], ["refund", "Hoàn tiền"], ["reconciliation", "Đối soát"], ["bank", "Bank transactions"], ["debt", "Công nợ"]].map(([key, label]) => <button key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>{label}</button>)}</div>

      <section className="tx-filter-card card-container"><div className="tx-filter-grid">
        <Field label="Từ ngày"><input type="date" value={tx.filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} /></Field>
        <Field label="Đến ngày"><input type="date" value={tx.filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} /></Field>
        <Field label="Loại"><select value={tx.filters.type} onChange={(e) => updateFilter("type", e.target.value)}><option value="all">Tất cả</option><option value="INFLOW">Thu</option><option value="OUTFLOW">Chi</option></select></Field>
        <Field label="Category"><select value={tx.filters.category} onChange={(e) => updateFilter("category", e.target.value)}><option value="">Tất cả</option>{CASHFLOW_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Subcategory"><select value={tx.filters.subcategory} onChange={(e) => updateFilter("subcategory", e.target.value)}><option value="">Tất cả</option>{CASHFLOW_SUBCATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Method"><select value={tx.filters.method} onChange={(e) => updateFilter("method", e.target.value)}><option value="">Tất cả</option>{PAYMENT_METHODS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Reference ID"><input value={tx.filters.referenceId} onChange={(e) => updateFilter("referenceId", e.target.value)} placeholder="ObjectId" /></Field>
        <Field label="Tìm kiếm"><div className="search-box"><Search size={15} /><input value={tx.filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="note/ref/source" /></div></Field>
      </div></section>

      <div className="tx-summary-strip"><div><span>Tổng thu</span><strong>{fmt(filteredTotals.inflow)}</strong></div><div><span>Tổng chi</span><strong>{fmt(filteredTotals.outflow)}</strong></div><div><span>Refund requests</span><strong>{tx.refunds.length}</strong></div><div><span>Payables mở</span><strong>{tx.supplierPayables.filter((p) => !["paid", "voided"].includes(p.status)).length}</strong></div></div>

      {activeTab === "journal" && <section className="card-container"><div className="card-header"><h3>Nhật ký giao dịch hợp nhất</h3></div><TransactionTable transactions={tx.transactions} onSelect={setSelected} /></section>}
      {activeTab === "cashflow" && <section className="card-container"><div className="card-header"><h3>Cashflow thu / chi</h3></div><TransactionTable transactions={tx.cashflows.map((c) => ({ ...c, description: c.note || c.reference?.kind || "Cashflow", category: `${c.category || "other"}/${c.subcategory || "other"}`, referenceType: c.reference?.kind, referenceId: c.reference?.id }))} onSelect={setSelected} /></section>}
      {activeTab === "refund" && <section className="card-container"><div className="card-header"><h3>Lịch sử hoàn tiền</h3></div><div className="tx-cards-grid">{tx.refunds.map((r) => <article key={r.id} className="tx-record-card" onClick={() => setSelectedRefund(r)}><div><strong>{fmt(r.amount)}</strong><span className={`badge ${r.status === "success" ? "success" : "warning"}`}>{r.status}</span></div><p>{r.reason}</p><small>{r.method} · cashflow {r.cashflowId || "-"}</small></article>)}</div></section>}
      {activeTab === "reconciliation" && <section className="card-container"><div className="card-header"><h3>Queue đối soát</h3><select value={tx.reconciliationStatus} onChange={(e) => tx.setReconciliationStatus(e.target.value)}><option value="all">Tất cả</option><option value="matched">matched</option><option value="amount_mismatch">amount_mismatch</option><option value="unmatched">unmatched</option><option value="duplicate">duplicate</option><option value="resolved">resolved</option><option value="ignored">ignored</option></select></div><div className="tx-cards-grid">{tx.reconciliations.map((r) => <article key={r.id} className="tx-record-card" onClick={() => setSelectedReconciliation(r)}><div><strong>{r.paymentReference || r.id}</strong><span className={`badge ${r.status === "matched" ? "success" : "warning"}`}>{r.status}</span></div><p>Expected {fmt(r.expectedAmount)} · Received {fmt(r.receivedAmount)} · Δ {fmt(r.varianceAmount)}</p><small>Confidence {r.matchConfidence || 0} · {r.matchReason || "-"}</small><div className="tx-card-actions">{permissions.reconciliationWrite && <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ title: "Resolve đối soát", message: "Ghi chú xử lý là bắt buộc để đóng ngoại lệ.", onConfirm: (note) => tx.resolveReconciliation({ reconciliationId: r.id, resolution: r.status === "amount_mismatch" ? "accept_mismatch" : "accept_match", note }).then(() => setConfirmAction(null)) }); }}><ShieldCheck size={14} /> Đóng</button>}</div></article>)}</div></section>}
      {activeTab === "bank" && <section className="card-container"><div className="card-header"><h3>Giao dịch ngân hàng</h3><select value={tx.bankStatus} onChange={(e) => tx.setBankStatus(e.target.value)}><option value="">Tất cả</option><option value="unmatched">unmatched</option><option value="matched">matched</option><option value="amount_mismatch">amount_mismatch</option><option value="ignored">ignored</option></select></div><div className="tx-cards-grid">{tx.bankTransactions.map((b) => { const recon = tx.reconciliations.find((r) => r.bankTransactionId === b.id); return <article key={b.id} className="tx-record-card"><div><strong>{fmt(b.amount)}</strong><span className="badge warning">{b.matchStatus}</span></div><p>{b.transferContent || b.description || b.transactionId}</p><small>{b.provider} · {safeBankAccountLabel(b)}</small><div className="tx-card-actions">{permissions.reconciliationWrite && <><button onClick={() => tx.reconcileBankTransaction(b.id)}>Auto match</button><button onClick={() => setManualMatchContext({ bankTransaction: b, reconciliation: recon })}>Manual match</button><button onClick={() => setConfirmAction({ title: "Bỏ qua giao dịch ngân hàng", message: "Giao dịch sẽ không còn nằm trong queue cần xử lý. Nhập lý do để audit.", onConfirm: (reason) => tx.ignoreBankTransaction(b.id, reason).then(() => setConfirmAction(null)) })}>Bỏ qua</button></>}</div></article>; })}</div></section>}
      {activeTab === "debt" && <section className="card-container"><div className="card-header warning-bg"><h3>Công nợ phải thu / phải trả</h3>{permissions.financeWrite && <button className="text-btn" onClick={() => setSupplierPayableModal({ mode: "create" })}>Tạo khoản phải trả</button>}</div><div className="debt-split-grid"><div className="debt-column"><h4>Khoản phải thu</h4><article className="tx-record-card"><strong>Hóa đơn UNPAID/PARTIAL</strong><p>{receivables.length ? `${receivables.length} hóa đơn cần xử lý` : "Theo dõi từ Invoice UNPAID/PARTIAL trong dashboard"}</p></article></div><div className="debt-column"><h4>Khoản phải trả nhà cung cấp</h4><div className="tx-cards-grid tx-cards-grid--single">{tx.supplierPayables.map((p) => <article key={p.id} className="tx-record-card"><div><strong>{p.supplierName}</strong><span className={`badge ${p.status === "paid" ? "success" : "warning"}`}>{p.status}</span></div><p>Còn phải trả {fmt(p.remainingAmount)} / {fmt(p.amount)} · đã trả {fmt(p.paidAmount)}</p><small>Due {asDate(p.dueDate)} · {p.sourceKind} · cashflows {(p.cashflowIds || []).length}</small><div className="tx-card-actions"><button onClick={() => setSelectedPayable(p)}>Chi tiết</button>{permissions.financeWrite && !["paid", "voided"].includes(p.status) && <><button onClick={() => setSupplierPayableModal({ mode: "edit", payable: p })}>Sửa</button><button onClick={() => setSupplierPaymentModal(p)}>Thanh toán</button><button onClick={() => setConfirmAction({ title: "Void khoản phải trả", message: "Nhập lý do void khoản phải trả. Thao tác này được audit.", onConfirm: (reason) => tx.voidSupplierPayable(p.id, reason).then(() => setConfirmAction(null)) })}>Void</button></>}</div></article>)}</div></div></div></section>}

      {supplierPayableModal && <SupplierPayableModal payable={supplierPayableModal.payable} onClose={() => setSupplierPayableModal(null)} onSubmit={async (input) => { supplierPayableModal.payable ? await tx.updateSupplierPayable(supplierPayableModal.payable.id, input) : await tx.createSupplierPayable(input); setSupplierPayableModal(null); }} />}
      {supplierPaymentModal && <SupplierPaymentModal payable={supplierPaymentModal} onClose={() => setSupplierPaymentModal(null)} onSubmit={async (input) => { await tx.recordSupplierPayment(supplierPaymentModal.id, input); setSupplierPaymentModal(null); }} />}
      {cashflowModal && <ManualCashflowModal initial={cashflowModal.item} onClose={() => setCashflowModal(null)} onSubmit={async (input) => { cashflowModal.item ? await tx.updateManualCashflow(cashflowModal.item.id, input) : await tx.createManualCashflow(input); setCashflowModal(null); }} onVoid={(item) => setConfirmAction({ title: "Void cashflow", message: "Void cashflow bắt buộc lý do và được audit.", onConfirm: (reason) => tx.voidManualCashflow(item.id, reason).then(() => { setConfirmAction(null); setCashflowModal(null); }) })} />}
      {refundSource && <RefundRequestModal transaction={refundSource} onClose={() => setRefundSource(null)} onSubmit={async (input) => { await tx.createRefundRequest(input); setRefundSource(null); setActiveTab("refund"); }} />}
      {manualMatchContext && <ManualMatchModal {...manualMatchContext} onClose={() => setManualMatchContext(null)} onMatch={(input) => tx.manualMatchBankTransaction(input).then(() => setManualMatchContext(null))} />}
      {confirmAction && <ConfirmFinancialActionModal {...confirmAction} onClose={() => setConfirmAction(null)} />}
      <TransactionDetailDrawer item={selected} onClose={() => setSelected(null)} onRefund={setRefundSource} onEditCashflow={(item) => setCashflowModal({ mode: "edit", item })} onVoidCashflow={(item) => setConfirmAction({ title: "Void cashflow", message: "Nhập lý do void cashflow.", onConfirm: (reason) => tx.voidManualCashflow(item.id, reason).then(() => setConfirmAction(null)) })} canRefund={permissions.refundWrite} canFinanceWrite={permissions.financeWrite} />
      <RefundDetailDrawer refund={selectedRefund} onClose={() => setSelectedRefund(null)} actions={permissions.refundWrite && selectedRefund ? <>{selectedRefund.status === "pending" && <><button onClick={() => tx.approveRefundRequest(selectedRefund.id)}>Duyệt</button><button onClick={() => setConfirmAction({ title: "Từ chối refund", message: "Nhập lý do từ chối.", onConfirm: (reason) => tx.rejectRefundRequest(selectedRefund.id, reason).then(() => setConfirmAction(null)) })}>Từ chối</button><button onClick={() => setConfirmAction({ title: "Hủy refund", message: "Nhập lý do hủy refund.", onConfirm: (reason) => tx.cancelRefundRequest(selectedRefund.id, reason).then(() => setConfirmAction(null)) })}>Hủy</button></>}{selectedRefund.status === "approved" && <><button onClick={() => tx.processRefundRequest(selectedRefund.id, { note: "processed from UI" })}>Xử lý</button><button onClick={() => setConfirmAction({ title: "Hủy refund", message: "Nhập lý do hủy refund.", onConfirm: (reason) => tx.cancelRefundRequest(selectedRefund.id, reason).then(() => setConfirmAction(null)) })}>Hủy</button></>}{selectedRefund.status === "failed" && <button onClick={() => tx.retryRefundRequest(selectedRefund.id, { note: "retry from UI" })}>Thử lại</button>}</> : null} />
      <SupplierPayableDetailDrawer payable={selectedPayable} onClose={() => setSelectedPayable(null)} />
      <ReconciliationDetailDrawer item={selectedReconciliation} onClose={() => setSelectedReconciliation(null)} />
    </div>
  );
};

export default TransactionManagement;
