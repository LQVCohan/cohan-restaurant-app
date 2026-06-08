import React, { useMemo } from "react";
import { Calendar, Download, RefreshCw, Route } from "lucide-react";
import "./FinanceDashboard.scss";
import { FinanceStats, RevenueChart, ReceivableDebts } from "./FinanceComponents";
import { useFinance } from "@/hooks/useFinance";
import { useRestaurantCurrency } from "@/hooks/useRestaurantCurrency";

const formatVnd = (value) =>
  Number(value || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

const navigateTransactions = (query = {}) => {
  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: { page: "transactions", query, source: "finance-dashboard" },
    }),
  );
};

const exportDashboardCsv = ({ summary, trend, costBreakdown, debts, reconciliationSummary }) => {
  const rows = [
    ["Section", "Metric", "Value"],
    ["KPI", "Revenue", summary.revenue],
    ["KPI", "Expense", summary.expense],
    ["KPI", "Profit", summary.profit],
    ["KPI", "Cash In", summary.cashIn],
    ["KPI", "Cash Out", summary.cashOut],
    ["KPI", "Payments", summary.payment],
    ["KPI", "Refunds", summary.refund],
    ["KPI", "Receivable", summary.receivable ?? summary.debt],
    ["KPI", "Payable", summary.payable || 0],
    ["KPI", "Prime Cost Rate", summary.primeCostRate || 0],
    ["Cost", "COGS", costBreakdown.cogs],
    ["Cost", "Labor", costBreakdown.labor],
    ["Cost", "Operations", costBreakdown.operations],
    ["Cost", "Other", costBreakdown.other],
    ["Reconciliation", "Matched", reconciliationSummary.matched],
    ["Reconciliation", "Amount mismatch", reconciliationSummary.amountMismatch],
    ["Reconciliation", "Unmatched", reconciliationSummary.unmatched],
    ...trend.map((p) => ["Trend", p.key, `revenue=${p.revenue};expense=${p.expense};profit=${p.profit}`]),
    ...debts.map((d) => ["Receivable", d.supplier, d.amount]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finance-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const FinanceDashboard = () => {
  const {
    range,
    setRange,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    summary,
    trend,
    debts,
    reconciliations,
    reconciliationSummary,
    costBreakdown,
    loading,
    error,
    refetch,
    restaurantId,
    setRestaurantId,
    restaurants,
    setCurrency,
  } = useFinance();
  const { activeCurrency, setActiveCurrency, manualUsdToVndRate, persistSettings } = useRestaurantCurrency(restaurantId);

  const safeCostBreakdown = useMemo(() => ({
    cogs: Number(costBreakdown?.cogs || 0),
    labor: Number(costBreakdown?.labor || 0),
    operations: Number(costBreakdown?.operations || 0),
    other: Number(costBreakdown?.other || 0),
  }), [costBreakdown]);
  const totalCost = Object.values(safeCostBreakdown).reduce((sum, value) => sum + value, 0);
  const percent = (value) => (totalCost > 0 ? `${Math.round((Number(value || 0) / totalCost) * 100)}%` : "0%");

  const handleCurrencyChange = async (value) => {
    setActiveCurrency(value);
    setCurrency(value);
    await persistSettings({ defaultCurrency: value });
  };

  return (
    <div className="finance-dashboard">
      <header className="page-header finance-hero">
        <div className="header-left">
          <span className="eyebrow">UC18 · Finance command center</span>
          <h1>Tổng quan tài chính & dòng tiền</h1>
          <p>Dashboard chỉ tập trung KPI, lợi nhuận, cost structure, công nợ tổng quan và tín hiệu đối soát.</p>
        </div>
        <div className="header-actions finance-toolbar">
          <select className="btn-secondary" value={restaurantId || ""} onChange={(e) => setRestaurantId(e.target.value)}>
            <option value="">Chọn nhà hàng</option>
            {(restaurants || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="btn-secondary" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="week">Tuần</option>
            <option value="month">Tháng</option>
            <option value="quarter">Quý</option>
            <option value="year">Năm</option>
            <option value="custom">Khoảng ngày</option>
          </select>
          {range === "custom" && (
            <>
              <input className="btn-secondary" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input className="btn-secondary" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </>
          )}
          <select className="btn-secondary" value={activeCurrency} onChange={(e) => handleCurrencyChange(e.target.value)}>
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </select>
          <input className="btn-secondary rate-input" type="number" min="1" defaultValue={manualUsdToVndRate} onBlur={async (e) => {
            const v = Number(e.target.value);
            if (v > 0) await persistSettings({ manualUsdToVndRate: v });
          }} title="Tỷ giá USD -> VND" />
          <button className="btn-secondary" onClick={() => refetch()}><RefreshCw size={16} /> Làm mới</button>
          <button className="btn-primary" onClick={() => exportDashboardCsv({ summary, trend, costBreakdown: safeCostBreakdown, debts, reconciliationSummary })}><Download size={16} /> Export CSV</button>
        </div>
      </header>

      {error && <div className="finance-error">Không thể tải dữ liệu tài chính. Vui lòng thử lại.</div>}

      <section className="stats-section">
        <FinanceStats summary={summary} onNavigate={navigateTransactions} />
      </section>

      <div className="finance-focus-grid">
        <section className="card-container chart-card span-2">
          <div className="card-header">
            <div>
              <h3>Thu / chi / lợi nhuận theo thời gian</h3>
              <p>Dữ liệu đến từ Cashflow đã chuẩn hóa, loại trừ dòng voided để tránh double count.</p>
            </div>
            <Calendar size={18} />
          </div>
          <div className="card-body">{loading ? <div>Đang tải dữ liệu...</div> : <RevenueChart trend={trend || []} />}</div>
        </section>

        <section className="card-container cost-card">
          <div className="card-header"><h3>Cấu trúc chi phí</h3><Route size={18} /></div>
          <div className="card-body cost-structure">
            {[
              ["COGS / nguyên liệu", "cogs", "red", "inventory"],
              ["Labor / nhân sự", "labor", "orange", "payroll"],
              ["Operations / vận hành", "operations", "blue", "operations"],
              ["Other / khác", "other", "slate", "other"],
            ].map(([label, key, color, source]) => (
              <button key={key} type="button" className="cost-row cost-drilldown" onClick={() => navigateTransactions({ tab: "journal", category: source })}>
                <div className="label"><span>{label}</span><strong>{formatVnd(safeCostBreakdown[key])}</strong></div>
                <div className="progress"><div className={`fill ${color}`} style={{ width: percent(safeCostBreakdown[key]) }} /></div>
                <div className="value">{percent(safeCostBreakdown[key])}</div>
              </button>
            ))}
            <div className="insight-text">Prime cost = COGS + Labor. Drill-down từng nhóm sẽ mở Transactions theo nguồn phát sinh để truy vết.</div>
          </div>
        </section>

        <section className="card-container reconciliation-card">
          <div className="card-header"><h3>Tình trạng đối soát</h3><button className="text-btn" onClick={() => navigateTransactions({ tab: "reconciliation" })}>Xử lý</button></div>
          <div className="card-body recon-summary">
            <div className="recon-tile matched"><span>Khớp</span><strong>{reconciliationSummary?.matched || 0}</strong></div>
            <div className="recon-tile mismatch"><span>Lệch tiền</span><strong>{reconciliationSummary?.amountMismatch || 0}</strong></div>
            <div className="recon-tile unmatched"><span>Chưa khớp</span><strong>{reconciliationSummary?.unmatched || 0}</strong></div>
            <div className="mini-list">
              {(reconciliations || []).slice(0, 5).map((item) => (
                <div key={item.id} className="mini-list-row">
                  <span>{item.reference || item.id}</span>
                  <b>{item.status}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card-container span-2">
          <div className="card-header warning-bg">
            <h3>Công nợ hóa đơn / khoản phải thu</h3>
            <button className="text-btn" onClick={() => navigateTransactions({ tab: "debt" })}>Xem chi tiết</button>
          </div>
          <ReceivableDebts debts={debts || []} />
        </section>
      </div>
    </div>
  );
};

export default FinanceDashboard;
