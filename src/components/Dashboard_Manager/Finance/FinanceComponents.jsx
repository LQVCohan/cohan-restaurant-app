import React from "react";
import {
  DollarSign,
  Wallet,
  AlertCircle,
  CreditCard,
  TrendingDown,
  HandCoins,
} from "lucide-react";

const fmt = (num) => `${Number(num || 0).toLocaleString("vi-VN")}đ`;

export const FinanceStats = ({ summary }) => {
  const primeCostRate =
    summary.revenue > 0 ? ((summary.expense / summary.revenue) * 100).toFixed(1) : 0;

  return (
    <div className="finance-stats-grid">
      <div className="stat-card revenue">
        <div className="icon-wrapper">
          <DollarSign size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Doanh Thu</span>
          <div className="value">{fmt(summary.revenue)}</div>
          <span className="sub-text">Đối soát: {fmt(summary.settlement)}</span>
        </div>
      </div>

      <div className="stat-card prime-cost">
        <div className="icon-wrapper">
          <AlertCircle size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Prime Cost</span>
          <div className="value">{primeCostRate}%</div>
          <span className="sub-text">Chi phí / Doanh thu</span>
        </div>
      </div>

      <div className="stat-card profit">
        <div className="icon-wrapper">
          <Wallet size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Lợi Nhuận</span>
          <div className="value">{fmt(summary.profit)}</div>
          <span className="sub-text">Thuần: {fmt(summary.revenue - summary.refund)}</span>
        </div>
      </div>

      <div className="stat-card cash">
        <div className="icon-wrapper">
          <CreditCard size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Thu/Chi Tiền</span>
          <div className="value">{fmt(summary.cashIn - summary.cashOut)}</div>
          <span className="sub-text">
            Thu: {fmt(summary.payment)} | Hoàn: {fmt(summary.refund)}
          </span>
        </div>
      </div>

      <div className="stat-card expense">
        <div className="icon-wrapper">
          <TrendingDown size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Tổng Chi Phí</span>
          <div className="value">{fmt(summary.expense)}</div>
          <span className="sub-text">Bao gồm chi vận hành</span>
        </div>
      </div>

      <div className="stat-card debt">
        <div className="icon-wrapper">
          <HandCoins size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Công Nợ</span>
          <div className="value">{fmt(summary.debt)}</div>
          <span className="sub-text">UNPAID/PARTIAL invoices</span>
        </div>
      </div>
    </div>
  );
};

export const SupplierDebts = ({ debts }) => (
  <div className="debt-list">
    {debts.length === 0 ? (
      <div className="p-3 text-muted text-center">Không có khoản công nợ mở</div>
    ) : (
      debts.map((d) => (
        <div key={d.id} className="debt-item">
          <div className="debt-info">
            <div className="supplier-name">{d.supplier}</div>
            <div className="due-date text-danger">
              Hạn: {d.dueDate ? new Date(d.dueDate).toLocaleDateString("vi-VN") : "N/A"}
            </div>
          </div>
          <div className="debt-amount">
            <div>{fmt(d.amount)}</div>
            <small>{d.status}</small>
          </div>
        </div>
      ))
    )}
  </div>
);

export const TransactionTable = ({ transactions }) => (
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
          <tr>
            <td colSpan="5" className="text-center text-muted" style={{ padding: "2rem" }}>
              Chưa có giao dịch trong kỳ lọc
            </td>
          </tr>
        ) : (
          transactions.map((t) => {
            const d = new Date(t.occurredAt);
            return (
              <tr key={t.id}>
                <td className="date-col">
                  <b>{`${d.getDate()}`.padStart(2, "0")}</b>/{`${d.getMonth() + 1}`.padStart(2, "0")}
                </td>
                <td>
                  <div className="desc">{t.description}</div>
                  <div className="category">{t.category}</div>
                </td>
                <td className="source-col">
                  <span className="source-tag bank">{t.source || "Hệ thống"}</span>
                </td>
                <td className={t.type === "INFLOW" ? "text-success font-bold" : "text-danger font-bold"}>
                  {t.type === "INFLOW" ? "+" : "-"}
                  {fmt(t.amount)}
                </td>
                <td>
                  <span className={`badge ${t.status === "completed" ? "success" : "warning"}`}>
                    {t.status || "completed"}
                  </span>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>
);

export const RevenueChart = ({ trend = [] }) => {
  const maxValue = Math.max(1, ...trend.map((x) => Math.max(x.revenue, x.expense)));

  return (
    <div className="chart-placeholder-ui">
      {trend.length === 0 ? (
        <div className="chart-empty">Chưa có dữ liệu chart</div>
      ) : (
        trend.map((point) => (
          <div key={point.key} className="chart-bar-group">
            <div
              className="bar income"
              title={`Thu: ${fmt(point.revenue)}`}
              style={{ height: `${(point.revenue / maxValue) * 100}%` }}
            />
            <div
              className="bar expense"
              title={`Chi: ${fmt(point.expense)}`}
              style={{ height: `${(point.expense / maxValue) * 100}%` }}
            />
            <span className="label">{point.key}</span>
          </div>
        ))
      )}
    </div>
  );
};
