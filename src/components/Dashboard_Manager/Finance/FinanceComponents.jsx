import React from "react";
import {
  AlertCircle,
  CreditCard,
  DollarSign,
  HandCoins,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { formatCurrencyAmount } from "@/utils/currency";

const defaultFormatMoney = (value) => formatCurrencyAmount(value, "VND");

const STATUS_LABELS = {
  completed: "Hoàn tất",
  success: "Thành công",
  pending: "Chờ xử lý",
  failed: "Thất bại",
  unpaid: "Chưa thanh toán",
  partial: "Thanh toán một phần",
  overdue: "Quá hạn",
  paid: "Đã thanh toán",
};

const getStatusLabel = (status) =>
  STATUS_LABELS[String(status || "").toLowerCase()] || status || "Chưa rõ";

export const FinanceStats = ({
  summary = {},
  onNavigate = () => {},
  formatMoney = defaultFormatMoney,
}) => {
  const primeCostRate = Number(summary.primeCostRate || 0).toFixed(1);
  const cards = [
    {
      key: "revenue",
      label: "Doanh thu ghi nhận",
      value: formatMoney(summary.revenue),
      sub: `Đã nhận: ${formatMoney(summary.payment)}`,
      icon: DollarSign,
      route: { tab: "journal", type: "INFLOW", category: "sale" },
    },
    {
      key: "expense",
      label: "Chi phí đã ghi nhận",
      value: formatMoney(summary.expense),
      sub: `Tiền ra: ${formatMoney(summary.cashOut)}`,
      icon: TrendingDown,
      route: { tab: "journal", type: "OUTFLOW" },
    },
    {
      key: "profit",
      label: "Lợi nhuận tạm tính",
      value: formatMoney(summary.profit),
      sub: `Doanh thu sau hoàn: ${formatMoney(
        Number(summary.revenue || 0) - Number(summary.refund || 0),
      )}`,
      icon: Wallet,
      route: { tab: "journal" },
    },
    {
      key: "cash",
      label: "Dòng tiền ròng",
      value: formatMoney(
        Number(summary.cashIn || 0) - Number(summary.cashOut || 0),
      ),
      sub: `Vào ${formatMoney(summary.cashIn)} · Ra ${formatMoney(
        summary.cashOut,
      )}`,
      icon: CreditCard,
      route: { tab: "journal" },
    },
    {
      key: "refund",
      label: "Hoàn tiền",
      value: formatMoney(summary.refund),
      sub: "Các khoản đã hoàn cho khách",
      icon: AlertCircle,
      route: { tab: "refund" },
    },
    {
      key: "debt",
      label: "Khoản phải thu",
      value: formatMoney(summary.receivable ?? summary.debt),
      sub: `Phải trả nhà cung cấp: ${formatMoney(summary.payable || 0)}`,
      icon: HandCoins,
      route: { tab: "debt" },
    },
    {
      key: "prime-cost",
      label: "Tỷ lệ chi phí chính",
      value: `${primeCostRate}%`,
      sub: "Nguyên liệu + nhân sự / doanh thu",
      icon: AlertCircle,
      route: { tab: "journal", type: "OUTFLOW" },
    },
    {
      key: "settlement",
      label: "Hóa đơn đã thanh toán",
      value: formatMoney(summary.settlement),
      sub: "Giá trị hóa đơn đã thu đủ",
      icon: CreditCard,
      route: { tab: "reconciliation" },
    },
  ];

  return (
    <div className="finance-stats-grid">
      {cards.map(({ key, label, value, sub, icon: Icon, route }) => (
        <button
          key={key}
          type="button"
          className={`stat-card ${key}`}
          onClick={() => onNavigate(route)}
          aria-label={`${label}: ${value}. Mở dữ liệu liên quan`}
        >
          <div className="icon-wrapper" aria-hidden="true">
            <Icon size={22} />
          </div>
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

export const ReceivableDebts = ({
  debts = [],
  formatMoney = defaultFormatMoney,
}) => (
  <div className="debt-list">
    {debts.length === 0 ? (
      <div className="finance-empty-state">
        Không có hóa đơn chưa thanh toán trong kỳ này.
      </div>
    ) : (
      debts.map((debt) => (
        <div key={debt.id} className="debt-item">
          <div className="debt-info">
            <div className="supplier-name">{debt.supplier}</div>
            <div className="due-date text-danger">
              Hạn thanh toán: {" "}
              {debt.dueDate
                ? new Date(debt.dueDate).toLocaleDateString("vi-VN")
                : "Chưa có ngày"}
            </div>
          </div>
          <div className="debt-amount">
            <div>{formatMoney(debt.amount)}</div>
            <small>{getStatusLabel(debt.status)}</small>
          </div>
        </div>
      ))
    )}
  </div>
);

export const SupplierDebts = ReceivableDebts;

export const TransactionTable = ({
  transactions = [],
  onSelect,
  formatMoney = defaultFormatMoney,
}) => (
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
            <td colSpan="5" className="text-center text-muted table-empty-cell">
              Chưa có giao dịch trong kỳ lọc
            </td>
          </tr>
        ) : (
          transactions.map((transaction) => {
            const date = new Date(transaction.occurredAt);
            const isInflow = transaction.type === "INFLOW";
            const isSuccess = ["completed", "success"].includes(
              String(transaction.status || "").toLowerCase(),
            );
            const handleSelect = () => onSelect?.(transaction);
            return (
              <tr
                key={transaction.id}
                onClick={handleSelect}
                onKeyDown={(event) => {
                  if (onSelect && ["Enter", " "].includes(event.key)) {
                    event.preventDefault();
                    handleSelect();
                  }
                }}
                tabIndex={onSelect ? 0 : undefined}
                className={onSelect ? "clickable-row" : ""}
              >
                <td className="date-col">
                  <b>{`${date.getDate()}`.padStart(2, "0")}</b>/
                  {`${date.getMonth() + 1}`.padStart(2, "0")}
                </td>
                <td>
                  <div className="desc">{transaction.description}</div>
                  <div className="category">{transaction.category}</div>
                </td>
                <td className="source-col">
                  <span className="source-tag bank">
                    {transaction.source || "Hệ thống"}
                  </span>
                </td>
                <td
                  className={
                    isInflow
                      ? "text-success font-bold"
                      : "text-danger font-bold"
                  }
                >
                  {isInflow ? "+" : "-"}
                  {formatMoney(transaction.amount)}
                </td>
                <td>
                  <span className={`badge ${isSuccess ? "success" : "warning"}`}>
                    {getStatusLabel(transaction.status)}
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

export const RevenueChart = ({
  trend = [],
  formatMoney = defaultFormatMoney,
}) => {
  const maxValue = Math.max(
    1,
    ...trend.map((point) =>
      Math.max(
        Number(point.revenue || 0),
        Number(point.expense || 0),
        Math.abs(Number(point.profit || 0)),
      ),
    ),
  );

  return (
    <div className="finance-chart">
      <div className="finance-chart-legend" aria-label="Chú thích biểu đồ">
        <span className="income">Doanh thu</span>
        <span className="expense">Chi phí</span>
        <span className="profit">Lợi nhuận</span>
      </div>
      <div className="chart-placeholder-ui">
        {trend.length === 0 ? (
          <div className="chart-empty">
            Chưa có dữ liệu thu chi trong kỳ đã chọn.
          </div>
        ) : (
          trend.map((point) => {
            const profit = Number(point.profit || 0);
            return (
              <div key={point.key} className="chart-bar-group">
                <div className="chart-bars">
                  <div
                    className="bar income"
                    title={`Doanh thu: ${formatMoney(point.revenue)}`}
                    aria-label={`Doanh thu ${point.key}: ${formatMoney(
                      point.revenue,
                    )}`}
                    style={{
                      height: `${(Number(point.revenue || 0) / maxValue) * 100}%`,
                    }}
                  />
                  <div
                    className="bar expense"
                    title={`Chi phí: ${formatMoney(point.expense)}`}
                    aria-label={`Chi phí ${point.key}: ${formatMoney(
                      point.expense,
                    )}`}
                    style={{
                      height: `${(Number(point.expense || 0) / maxValue) * 100}%`,
                    }}
                  />
                  <div
                    className={`bar profit ${profit < 0 ? "loss" : ""}`}
                    title={`${profit < 0 ? "Lỗ" : "Lợi nhuận"}: ${formatMoney(
                      profit,
                    )}`}
                    aria-label={`${profit < 0 ? "Lỗ" : "Lợi nhuận"} ${
                      point.key
                    }: ${formatMoney(profit)}`}
                    style={{
                      height: `${(Math.abs(profit) / maxValue) * 100}%`,
                    }}
                  />
                </div>
                <div className="label">{point.key}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
