import React from "react";
import { AlertCircle, CreditCard, DollarSign, HandCoins, TrendingDown, Wallet } from "lucide-react";

const fmt = (num) => `${Number(num || 0).toLocaleString("vi-VN")}đ`;

const STATUS_LABELS = {
  completed: "Hoàn tất",
  success: "Thành công",
  SUCCESS: "Thành công",
  pending: "Chờ xử lý",
  PENDING: "Chờ xử lý",
  failed: "Thất bại",
  FAILED: "Thất bại",
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán một phần",
  overdue: "Quá hạn",
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Thanh toán một phần",
  PAID: "Đã thanh toán",
};

const getStatusLabel = (status) => STATUS_LABELS[status] || STATUS_LABELS[String(status || "").toLowerCase()] || status || "Chưa rõ";

export const FinanceStats = ({ summary = {}, onNavigate = () => {} }) => {
  const primeCostRate = Number(summary.primeCostRate ?? (summary.revenue > 0 ? (summary.expense / summary.revenue) * 100 : 0)).toFixed(1);
  const cards = [
    { key: "revenue", label: "Doanh thu ghi nhận", value: fmt(summary.revenue), sub: `Đã nhận: ${fmt(summary.payment)}`, icon: DollarSign, route: { tab: "journal", type: "INFLOW", category: "sale" } },
    { key: "expense", label: "Chi phí đã ghi nhận", value: fmt(summary.expense), sub: `Tiền ra: ${fmt(summary.cashOut)}`, icon: TrendingDown, route: { tab: "journal", type: "OUTFLOW" } },
    { key: "profit", label: "Lợi nhuận tạm tính", value: fmt(summary.profit), sub: `Sau hoàn tiền: ${fmt(Number(summary.revenue || 0) - Number(summary.refund || 0))}`, icon: Wallet, route: { tab: "journal" } },
    { key: "cash", label: "Dòng tiền ròng", value: fmt(Number(summary.cashIn || 0) - Number(summary.cashOut || 0)), sub: `Vào ${fmt(summary.cashIn)} · Ra ${fmt(summary.cashOut)}`, icon: CreditCard, route: { tab: "journal" } },
    { key: "refund", label: "Hoàn tiền", value: fmt(summary.refund), sub: "Các khoản đã hoàn cho khách", icon: AlertCircle, route: { tab: "refund" } },
    { key: "debt", label: "Khoản phải thu", value: fmt(summary.receivable ?? summary.debt), sub: `Phải trả nhà cung cấp: ${fmt(summary.payable || 0)}`, icon: HandCoins, route: { tab: "debt" } },
    { key: "prime-cost", label: "Tỷ lệ chi phí chính", value: `${primeCostRate}%`, sub: "Nguyên liệu + nhân sự / doanh thu", icon: AlertCircle, route: { tab: "journal", category: "payroll", subcategory: "labor" } },
    { key: "settlement", label: "Đã đối soát", value: fmt(summary.settlement), sub: "Giá trị hóa đơn đã thanh toán", icon: CreditCard, route: { tab: "reconciliation" } },
  ];

  return (
    <div className="finance-stats-grid">
      {cards.map(({ key, label, value, sub, icon: Icon, route }) => (
        <button key={key} type="button" className={`stat-card ${key}`} onClick={() => onNavigate(route)}>
          <div className="icon-wrapper"><Icon size={24} /></div>
          <div className="stat-content">
            <span className="label">{label}</span>
            <div className="value">{value}</div>
            <span className="sub-text">{sub}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export const ReceivableDebts = ({ debts = [] }) => (
  <div className="debt-list">
    {debts.length === 0 ? (
      <div className="finance-empty-state">Không có hóa đơn chưa thanh toán trong kỳ này.</div>
    ) : (
      debts.map((d) => (
        <div key={d.id} className="debt-item">
          <div className="debt-info">
            <div className="supplier-name">{d.supplier}</div>
            <div className="due-date text-danger">Cập nhật: {d.dueDate ? new Date(d.dueDate).toLocaleDateString("vi-VN") : "Chưa có ngày"}</div>
          </div>
          <div className="debt-amount">
            <div>{fmt(d.amount)}</div>
            <small>{getStatusLabel(d.status)}</small>
          </div>
        </div>
      ))
    )}
  </div>
);

export const SupplierDebts = ReceivableDebts;

export const TransactionTable = ({ transactions = [], onSelect }) => (
  <div className="table-responsive">
    <table className="clean-table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nội dung</th>
          <th>Nguồn</th>
          <th>Số tiền</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {transactions.length === 0 ? (
          <tr><td colSpan="5" className="text-center text-muted" style={{ padding: "2rem" }}>Chưa có giao dịch trong kỳ lọc</td></tr>
        ) : (
          transactions.map((t) => {
            const d = new Date(t.occurredAt);
            return (
              <tr key={t.id} onClick={() => onSelect?.(t)} className={onSelect ? "clickable-row" : ""}>
                <td className="date-col"><b>{`${d.getDate()}`.padStart(2, "0")}</b>/{`${d.getMonth() + 1}`.padStart(2, "0")}</td>
                <td><div className="desc">{t.description}</div><div className="category">{t.category}</div></td>
                <td className="source-col"><span className="source-tag bank">{t.source || "Hệ thống"}</span></td>
                <td className={t.type === "INFLOW" ? "text-success font-bold" : "text-danger font-bold"}>{t.type === "INFLOW" ? "+" : "-"}{fmt(t.amount)}</td>
                <td><span className={`badge ${t.status === "completed" || t.status === "SUCCESS" ? "success" : "warning"}`}>{getStatusLabel(t.status)}</span></td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);

export const RevenueChart = ({ trend = [] }) => {
  const maxValue = Math.max(1, ...trend.map((x) => Math.max(Number(x.revenue || 0), Number(x.expense || 0), Math.abs(Number(x.profit || 0)))));
  return (
    <div className="chart-placeholder-ui">
      {trend.length === 0 ? (
        <div className="chart-empty">Chưa có dữ liệu thu chi trong kỳ đã chọn.</div>
      ) : (
        trend.map((point) => (
          <div key={point.key} className="chart-bar-group">
            <div className="bar income" title={`Thu: ${fmt(point.revenue)}`} style={{ height: `${(Number(point.revenue || 0) / maxValue) * 100}%` }} />
            <div className="bar expense" title={`Chi: ${fmt(point.expense)}`} style={{ height: `${(Number(point.expense || 0) / maxValue) * 100}%` }} />
            <div className="bar profit" title={`Lợi nhuận: ${fmt(point.profit)}`} style={{ height: `${(Math.abs(Number(point.profit || 0)) / maxValue) * 100}%` }} />
            <div className="label">{point.key}</div>
          </div>
        ))
      )}
    </div>
  );
};
