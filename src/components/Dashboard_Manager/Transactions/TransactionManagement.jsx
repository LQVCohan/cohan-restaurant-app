import React, { useEffect, useMemo, useState } from "react";
import { Download, FilePlus2, RefreshCw, Search, ShieldCheck, Undo2 } from "lucide-react";
import "../Finance/FinanceDashboard.scss";
import { TransactionTable } from "../Finance/FinanceComponents";
import { CASHFLOW_CATEGORIES, CASHFLOW_STATUSES, CASHFLOW_SUBCATEGORIES, PAYMENT_METHODS, useTransactions } from "@/hooks/useTransactions";

const fmt = (num) => `${Number(num || 0).toLocaleString("vi-VN")}đ`;
const todayInput = () => new Date().toISOString().slice(0, 10);

function readNavigationQuery() {
  const params = new URLSearchParams(window.location.search || "");
  return {
    tab: params.get("tab") || "journal",
    type: params.get("type") || "all",
    category: params.get("category") || "",
  };
}

function exportCsv({ transactions, cashflows, refunds, reconciliations, bankTransactions }) {
  const rows = [
    ["Kind", "Date", "Description", "Type/Status", "Amount", "Source/Reference"],
    ...transactions.map((t) => ["cashflow", t.occurredAt, t.description, `${t.type}/${t.status}`, t.amount, `${t.source || ""}/${t.referenceId || ""}`]),
    ...cashflows.map((c) => ["cashflow_detail", c.occurredAt, c.note, `${c.category}/${c.subcategory}/${c.status}`, c.amount, c.reference?.kind || c.source || ""]),
    ...refunds.map((r) => ["refund", r.createdAt, r.reason, r.status, r.amount, r.paymentTransactionId || r.invoiceId || r.orderId || ""]),
    ...reconciliations.map((r) => ["reconciliation", r.createdAt, r.note || r.paymentReference, r.status, r.receivedAmount, r.bankTransactionId || r.paymentSessionId || ""]),
    ...bankTransactions.map((b) => ["bank", b.occurredAt || b.createdAt, b.transferContent || b.description, b.matchStatus, b.amount, b.transactionId || ""]),
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

const ManualCashflowForm = ({ onSubmit, onClose }) => {
  const [form, setForm] = useState({ type: "OUTFLOW", amount: "", category: "operations", subcategory: "utility", method: "bank_transfer", status: "completed", occurredAt: todayInput(), note: "" });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="tx-panel elevated">
      <div className="tx-panel__header"><h3>Ghi nhận thu / chi thủ công</h3><button onClick={onClose}>Đóng</button></div>
      <div className="tx-form-grid">
        <Field label="Loại"><select value={form.type} onChange={(e) => update("type", e.target.value)}><option value="INFLOW">Thu</option><option value="OUTFLOW">Chi</option></select></Field>
        <Field label="Số tiền"><input type="number" min="1" value={form.amount} onChange={(e) => update("amount", e.target.value)} /></Field>
        <Field label="Category"><select value={form.category} onChange={(e) => update("category", e.target.value)}>{CASHFLOW_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Subcategory"><select value={form.subcategory} onChange={(e) => update("subcategory", e.target.value)}>{CASHFLOW_SUBCATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Phương thức"><select value={form.method} onChange={(e) => update("method", e.target.value)}>{PAYMENT_METHODS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Trạng thái"><select value={form.status} onChange={(e) => update("status", e.target.value)}>{CASHFLOW_STATUSES.filter((x) => x !== "voided").map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Ngày phát sinh"><input type="date" value={form.occurredAt} onChange={(e) => update("occurredAt", e.target.value)} /></Field>
        <Field label="Ghi chú"><textarea value={form.note} onChange={(e) => update("note", e.target.value)} placeholder="VD: tiền điện tháng 6, chi sửa chữa bếp..." /></Field>
      </div>
      <button className="btn-primary tx-submit" onClick={() => onSubmit({ ...form, amount: Number(form.amount || 0), currency: "VND" })}>Lưu cashflow thủ công</button>
    </div>
  );
};

const RefundForm = ({ onSubmit, onClose }) => {
  const [form, setForm] = useState({ paymentTransactionId: "", invoiceId: "", orderId: "", amount: "", method: "cash", reason: "" });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="tx-panel elevated">
      <div className="tx-panel__header"><h3>Tạo yêu cầu hoàn tiền</h3><button onClick={onClose}>Đóng</button></div>
      <div className="tx-form-grid">
        <Field label="Payment transaction ID"><input value={form.paymentTransactionId} onChange={(e) => update("paymentTransactionId", e.target.value)} /></Field>
        <Field label="Invoice ID"><input value={form.invoiceId} onChange={(e) => update("invoiceId", e.target.value)} /></Field>
        <Field label="Order ID"><input value={form.orderId} onChange={(e) => update("orderId", e.target.value)} /></Field>
        <Field label="Số tiền hoàn"><input type="number" min="1" value={form.amount} onChange={(e) => update("amount", e.target.value)} /></Field>
        <Field label="Phương thức"><select value={form.method} onChange={(e) => update("method", e.target.value)}><option value="cash">cash</option><option value="bank_transfer">bank_transfer</option><option value="e_wallet">e_wallet</option><option value="provider">provider</option></select></Field>
        <Field label="Lý do"><textarea value={form.reason} onChange={(e) => update("reason", e.target.value)} /></Field>
      </div>
      <button className="btn-primary tx-submit" onClick={() => onSubmit({ ...form, amount: Number(form.amount || 0), paymentTransactionId: form.paymentTransactionId || null, invoiceId: form.invoiceId || null, orderId: form.orderId || null })}>Tạo refund request</button>
    </div>
  );
};

const TransactionManagement = () => {
  const navQuery = useMemo(readNavigationQuery, []);
  const [activeTab, setActiveTab] = useState(navQuery.tab || "journal");
  const [selected, setSelected] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const tx = useTransactions();

  useEffect(() => {
    const handler = (event) => {
      if (event?.detail?.page !== "transactions") return;
      const query = event.detail.query || {};
      if (query.tab) setActiveTab(query.tab);
      if (query.type || query.category) {
        tx.setFilters((prev) => ({ ...prev, type: query.type || prev.type, category: query.category || prev.category }));
      }
    };
    window.addEventListener("manager:navigation-query", handler);
    if (navQuery.type !== "all" || navQuery.category) tx.setFilters((prev) => ({ ...prev, type: navQuery.type, category: navQuery.category }));
    return () => window.removeEventListener("manager:navigation-query", handler);
  }, []);

  const filteredTotals = useMemo(() => tx.transactions.reduce((acc, item) => {
    if (item.type === "INFLOW") acc.inflow += Number(item.amount || 0);
    if (item.type === "OUTFLOW") acc.outflow += Number(item.amount || 0);
    return acc;
  }, { inflow: 0, outflow: 0 }), [tx.transactions]);

  const updateFilter = (key, value) => tx.setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="finance-dashboard transactions-page">
      <header className="page-header finance-hero">
        <div className="header-left">
          <span className="eyebrow">UC18 · Transaction operations</span>
          <h1>Giao dịch, hoàn tiền & đối soát</h1>
          <p>Nhật ký thu/chi, cashflow thủ công, refund, bank transaction và xử lý lệch/chưa khớp.</p>
        </div>
        <div className="header-actions finance-toolbar">
          <select className="btn-secondary" value={tx.restaurantId || ""} onChange={(e) => tx.setRestaurantId(e.target.value)}>
            <option value="">Chọn nhà hàng</option>{tx.restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="btn-secondary" onClick={() => tx.refetch()}><RefreshCw size={16} /> Làm mới</button>
          <button className="btn-secondary" onClick={() => setShowManualForm(true)}><FilePlus2 size={16} /> Thu/chi thủ công</button>
          <button className="btn-secondary" onClick={() => setShowRefundForm(true)}><Undo2 size={16} /> Refund</button>
          <button className="btn-primary" onClick={() => exportCsv(tx)}><Download size={16} /> Export CSV</button>
        </div>
      </header>

      {tx.error && <div className="finance-error">Không thể tải dữ liệu giao dịch. Vui lòng thử lại.</div>}

      <div className="tx-tabs">
        {[["journal", "Nhật ký"], ["cashflow", "Cashflow"], ["refund", "Hoàn tiền"], ["reconciliation", "Đối soát"], ["bank", "Bank transactions"], ["debt", "Công nợ"]].map(([key, label]) => (
          <button key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>{label}</button>
        ))}
      </div>

      <section className="tx-filter-card card-container">
        <div className="tx-filter-grid">
          <Field label="Từ ngày"><input type="date" value={tx.filters.dateFrom} onChange={(e) => updateFilter("dateFrom", e.target.value)} /></Field>
          <Field label="Đến ngày"><input type="date" value={tx.filters.dateTo} onChange={(e) => updateFilter("dateTo", e.target.value)} /></Field>
          <Field label="Loại"><select value={tx.filters.type} onChange={(e) => updateFilter("type", e.target.value)}><option value="all">Tất cả</option><option value="INFLOW">Thu</option><option value="OUTFLOW">Chi</option></select></Field>
          <Field label="Category"><select value={tx.filters.category} onChange={(e) => updateFilter("category", e.target.value)}><option value="">Tất cả</option>{CASHFLOW_CATEGORIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Method"><select value={tx.filters.method} onChange={(e) => updateFilter("method", e.target.value)}><option value="">Tất cả</option>{PAYMENT_METHODS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Source"><select value={tx.filters.source} onChange={(e) => updateFilter("source", e.target.value)}><option value="">Tất cả</option>{["order", "reservation", "payroll", "inventory", "manual", "bank", "refund", "system"].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Trạng thái"><input value={tx.filters.status} onChange={(e) => updateFilter("status", e.target.value)} placeholder="completed, pending..." /></Field>
          <Field label="Tìm kiếm"><div className="search-box"><Search size={15} /><input value={tx.filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="note/ref/source" /></div></Field>
        </div>
      </section>

      <div className="tx-summary-strip">
        <div><span>Tổng thu</span><strong>{fmt(filteredTotals.inflow)}</strong></div>
        <div><span>Tổng chi</span><strong>{fmt(filteredTotals.outflow)}</strong></div>
        <div><span>Refund requests</span><strong>{tx.refunds.length}</strong></div>
        <div><span>Reconciliation queue</span><strong>{tx.reconciliations.length}</strong></div>
      </div>

      {showManualForm && <ManualCashflowForm onClose={() => setShowManualForm(false)} onSubmit={async (input) => { await tx.createManualCashflow(input); setShowManualForm(false); }} />}
      {showRefundForm && <RefundForm onClose={() => setShowRefundForm(false)} onSubmit={async (input) => { await tx.createRefundRequest(input); setShowRefundForm(false); setActiveTab("refund"); }} />}

      {activeTab === "journal" && <section className="card-container"><div className="card-header"><h3>Nhật ký giao dịch hợp nhất</h3></div><TransactionTable transactions={tx.transactions} onSelect={setSelected} /></section>}

      {activeTab === "cashflow" && <section className="card-container"><div className="card-header"><h3>Cashflow thu / chi</h3></div><TransactionTable transactions={tx.cashflows.map((c) => ({ id: c.id, occurredAt: c.occurredAt, description: c.note || c.reference?.kind || "Cashflow", category: `${c.category || "other"}/${c.subcategory || "other"}`, type: c.type, amount: c.amount, method: c.method, status: c.status, source: c.source, referenceId: c.reference?.id }))} onSelect={setSelected} /></section>}

      {activeTab === "refund" && <section className="card-container"><div className="card-header"><h3>Lịch sử hoàn tiền</h3></div><div className="tx-cards-grid">{tx.refunds.map((r) => <article key={r.id} className="tx-record-card"><div><strong>{fmt(r.amount)}</strong><span className={`badge ${r.status === "success" ? "success" : "warning"}`}>{r.status}</span></div><p>{r.reason}</p><small>{r.method} · {r.paymentTransactionId || r.invoiceId || r.orderId}</small><div className="tx-card-actions"><button onClick={() => tx.approveRefundRequest(r.id)}>Duyệt</button><button onClick={() => tx.processRefundRequest(r.id, { note: "processed from UI" })}>Xử lý</button><button onClick={() => tx.rejectRefundRequest(r.id, "Rejected from UI")}>Từ chối</button></div></article>)}</div></section>}

      {activeTab === "reconciliation" && <section className="card-container"><div className="card-header"><h3>Queue đối soát</h3><select value={tx.reconciliationStatus} onChange={(e) => tx.setReconciliationStatus(e.target.value)}><option value="all">Tất cả</option><option value="matched">matched</option><option value="amount_mismatch">amount_mismatch</option><option value="unmatched">unmatched</option><option value="duplicate">duplicate</option><option value="resolved">resolved</option><option value="ignored">ignored</option></select></div><div className="tx-cards-grid">{tx.reconciliations.map((r) => <article key={r.id} className="tx-record-card"><div><strong>{r.paymentReference || r.id}</strong><span className={`badge ${r.status === "matched" ? "success" : "warning"}`}>{r.status}</span></div><p>Expected {fmt(r.expectedAmount)} · Received {fmt(r.receivedAmount)} · Δ {fmt(r.varianceAmount)}</p><small>{r.note || "Chưa có ghi chú"}</small><div className="tx-card-actions"><button onClick={() => tx.resolveReconciliation({ reconciliationId: r.id, resolution: r.status === "amount_mismatch" ? "accept_mismatch" : "accept_match", note: "Resolved from UI" })}><ShieldCheck size={14} /> Đóng</button></div></article>)}</div></section>}

      {activeTab === "bank" && <section className="card-container"><div className="card-header"><h3>Giao dịch ngân hàng</h3><select value={tx.bankStatus} onChange={(e) => tx.setBankStatus(e.target.value)}><option value="">Tất cả</option><option value="unmatched">unmatched</option><option value="matched">matched</option><option value="amount_mismatch">amount_mismatch</option><option value="ignored">ignored</option></select></div><div className="tx-cards-grid">{tx.bankTransactions.map((b) => <article key={b.id} className="tx-record-card"><div><strong>{fmt(b.amount)}</strong><span className="badge warning">{b.matchStatus}</span></div><p>{b.transferContent || b.description || b.transactionId}</p><small>{b.provider} · {b.bankAccountNumber}</small><div className="tx-card-actions"><button onClick={() => tx.reconcileBankTransaction(b.id)}>Auto match</button><button onClick={() => window.confirm("Force ignore bank transaction?") && tx.ignoreBankTransaction(b.id, "Ignored from UI")}>Bỏ qua</button></div></article>)}</div></section>}

      {activeTab === "debt" && <section className="card-container"><div className="card-header warning-bg"><h3>Công nợ hóa đơn / khoản phải thu</h3></div><div className="card-body">Công nợ hiện được tổng hợp từ Invoice UNPAID/PARTIAL trong Finance Dashboard. Supplier payable chưa bị gộp nhầm vào số này.</div></section>}

      {selected && <aside className="tx-detail-drawer"><button className="drawer-close" onClick={() => setSelected(null)}>×</button><h3>Chi tiết giao dịch</h3><dl>{Object.entries(selected).map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value ?? "-")}</dd></React.Fragment>)}</dl><div className="insight-text">Audit trail backend được ghi qua AuditLog cho create/update/void cashflow, refund và reconciliation.</div></aside>}
    </div>
  );
};

export default TransactionManagement;
