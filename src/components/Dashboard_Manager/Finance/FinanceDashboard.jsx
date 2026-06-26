import React, { useMemo } from "react";
import { Calendar, Download, RefreshCw, Route } from "lucide-react";
import "./FinanceDashboard.scss";
import "./FinanceDashboardPolish.scss";
import "./FinanceDashboardPolishPriority.scss";
import { FinanceStats, RevenueChart, ReceivableDebts } from "./FinanceComponents";
import { useFinance } from "@/hooks/useFinance";
import { useRestaurantCurrency } from "@/hooks/useRestaurantCurrency";

const formatVnd = (value) =>
  Number(value || 0).toLocaleString("vi-VN", { style: "currency", currency: "VND" });

const COST_LABELS = {
  cogs: "Nguyên liệu",
  labor: "Nhân sự",
  operations: "Vận hành",
  other: "Chi phí khác",
};

const RECONCILIATION_STATUS_LABELS = {
  matched: "Đã khớp",
  amount_mismatch: "Lệch số tiền",
  unresolved: "Chưa xử lý",
  unmatched: "Chưa khớp",
  resolved: "Đã xử lý",
};

const RANGE_LABELS = {
  week: "Tuần này",
  month: "Tháng này",
  quarter: "Quý này",
  year: "Năm nay",
  custom: "Khoảng ngày tùy chọn",
};

const getReconciliationStatusLabel = (status) =>
  RECONCILIATION_STATUS_LABELS[String(status || "").toLowerCase()] || status || "Chưa rõ";

const navigateTransactions = (query = {}) => {
  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: { page: "transactions", query, source: "finance-dashboard" },
    }),
  );
};

const exportDashboardCsv = ({ summary, trend, costBreakdown, debts, reconciliationSummary }) => {
  const rows = [
    ["Nhóm dữ liệu", "Chỉ số", "Giá trị"],
    ["Thiết lập", "Đơn vị tiền tệ", "VND"],
    ["Chỉ số chính", "Doanh thu ghi nhận", summary.revenue],
    ["Chỉ số chính", "Chi phí đã ghi nhận", summary.expense],
    ["Chỉ số chính", "Lợi nhuận tạm tính", summary.profit],
    ["Chỉ số chính", "Tiền vào", summary.cashIn],
    ["Chỉ số chính", "Tiền ra", summary.cashOut],
    ["Chỉ số chính", "Thanh toán thành công", summary.payment],
    ["Chỉ số chính", "Hoàn tiền", summary.refund],
    ["Chỉ số chính", "Khoản phải thu", summary.receivable ?? summary.debt],
    ["Chỉ số chính", "Khoản phải trả", summary.payable || 0],
    ["Chỉ số chính", "Tỷ lệ chi phí chính", summary.primeCostRate || 0],
    ["Cơ cấu chi phí", COST_LABELS.cogs, costBreakdown.cogs],
    ["Cơ cấu chi phí", COST_LABELS.labor, costBreakdown.labor],
    ["Cơ cấu chi phí", COST_LABELS.operations, costBreakdown.operations],
    ["Cơ cấu chi phí", COST_LABELS.other, costBreakdown.other],
    ["Đối soát", "Đã khớp", reconciliationSummary.matched],
    ["Đối soát", "Lệch số tiền", reconciliationSummary.amountMismatch],
    ["Đối soát", "Chưa khớp", reconciliationSummary.unmatched],
    ...trend.map((p) => ["Xu hướng", p.key, `Doanh thu: ${p.revenue}; Chi phí: ${p.expense}; Lợi nhuận: ${p.profit}`]),
    ...debts.map((d) => ["Khoản phải thu", d.supplier, d.amount]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bao-cao-tai-chinh-${new Date().toISOString().slice(0, 10)}.csv`;
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
  const selectedRestaurant = (restaurants || []).find((restaurant) => String(restaurant.id) === String(restaurantId));
  const netCashFlow = Number(summary?.cashIn || 0) - Number(summary?.cashOut || 0);

  const handleCurrencyChange = async (value) => {
    setActiveCurrency(value);
    setCurrency(value);
    await persistSettings({ defaultCurrency: value });
  };

  return (
    <div className="finance-dashboard finance-dashboard--polished">
      <header className="page-header finance-hero">
        <div className="header-left">
          <span className="eyebrow">Tài chính & dòng tiền</span>
          <h1>Tổng quan tài chính & dòng tiền</h1>
          <p>Theo dõi doanh thu, chi phí, lợi nhuận, công nợ và đối soát trong một màn hình để quản lý ca ra quyết định nhanh hơn.</p>
          <div className="finance-context-pills" aria-label="Ngữ cảnh tài chính">
            <span>{selectedRestaurant?.name || "Chưa chọn nhà hàng"}</span>
            <span>{RANGE_LABELS[range] || "Kỳ hiện tại"}</span>
            <span>Dòng tiền ròng: {formatVnd(netCashFlow)}</span>
          </div>
        </div>
        <div className="header-actions finance-toolbar" aria-label="Bộ lọc tài chính">
          <select className="btn-secondary" value={restaurantId || ""} onChange={(e) => setRestaurantId(e.target.value)}>
            <option value="">Chọn nhà hàng</option>
            {(restaurants || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className="btn-secondary" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="quarter">Quý này</option>
            <option value="year">Năm nay</option>
            <option value="custom">Khoảng ngày tùy chọn</option>
          </select>
          {range === "custom" && (
            <>
              <input className="btn-secondary" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Từ ngày" />
              <input className="btn-secondary" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Đến ngày" />
            </>
          )}
          <select className="btn-secondary" value={activeCurrency} onChange={(e) => handleCurrencyChange(e.target.value)} aria-label="Đơn vị tiền tệ">
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </select>
          <input className="btn-secondary rate-input" type="number" min="1" defaultValue={manualUsdToVndRate} onBlur={async (e) => {
            const v = Number(e.target.value);
            if (v > 0) await persistSettings({ manualUsdToVndRate: v });
          }} title="Tỷ giá USD sang VND" aria-label="Tỷ giá USD sang VND" />
          <button className="btn-secondary" onClick={() => refetch()}><RefreshCw size={16} /> Làm mới</button>
          <button className="btn-primary" onClick={() => exportDashboardCsv({ summary, trend, costBreakdown: safeCostBreakdown, debts, reconciliationSummary })}><Download size={16} /> Xuất CSV</button>
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
              <h3>Thu, chi và lợi nhuận theo thời gian</h3>
              <p>Dữ liệu lấy từ dòng tiền đã ghi nhận, không tính các giao dịch đã hủy.</p>
            </div>
            <Calendar size={18} />
          </div>
          <div className="card-body">{loading ? <div className="finance-loading-state">Đang tải dữ liệu tài chính...</div> : <RevenueChart trend={trend || []} />}</div>
        </section>

        <section className="card-container cost-card">
          <div className="card-header"><h3>Cơ cấu chi phí</h3><Route size={18} /></div>
          <div className="card-body cost-structure">
            {[
              [COST_LABELS.cogs, "cogs", "red", "inventory", "cogs"],
              [COST_LABELS.labor, "labor", "orange", "payroll", "labor"],
              [COST_LABELS.operations, "operations", "blue", "operations", ""],
              [COST_LABELS.other, "other", "slate", "other", ""],
            ].map(([label, key, color, source, subcategory]) => (
              <button key={key} type="button" className="cost-row cost-drilldown" onClick={() => navigateTransactions({ tab: "journal", category: source, subcategory })}>
                <div className="label"><span>{label}</span><strong>{formatVnd(safeCostBreakdown[key])}</strong></div>
                <div className="progress"><div className={`fill ${color}`} style={{ width: percent(safeCostBreakdown[key]) }} /></div>
                <div className="value">{percent(safeCostBreakdown[key])}</div>
              </button>
            ))}
            <div className="insight-text">Chi phí chính gồm nguyên liệu và nhân sự. Chọn từng nhóm để mở danh sách giao dịch liên quan.</div>
          </div>
        </section>

        <section className="card-container reconciliation-card">
          <div className="card-header"><h3>Tình trạng đối soát</h3><button className="text-btn" onClick={() => navigateTransactions({ tab: "reconciliation" })}>Xử lý</button></div>
          <div className="card-body recon-summary">
            <div className="recon-tile matched"><span>Đã khớp</span><strong>{reconciliationSummary?.matched || 0}</strong></div>
            <div className="recon-tile mismatch"><span>Lệch số tiền</span><strong>{reconciliationSummary?.amountMismatch || 0}</strong></div>
            <div className="recon-tile unmatched"><span>Chưa khớp</span><strong>{reconciliationSummary?.unmatched || 0}</strong></div>
            <div className="mini-list">
              {(reconciliations || []).slice(0, 5).map((item) => (
                <div key={item.id} className="mini-list-row">
                  <span>{item.reference || item.id}</span>
                  <b>{getReconciliationStatusLabel(item.status)}</b>
                </div>
              ))}
              {(reconciliations || []).length === 0 ? <div className="mini-list-empty">Chưa có giao dịch cần đối soát.</div> : null}
            </div>
          </div>
        </section>

        <section className="card-container span-2 finance-debt-card">
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
