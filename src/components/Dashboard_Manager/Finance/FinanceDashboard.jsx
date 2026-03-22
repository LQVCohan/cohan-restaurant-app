import React from "react";
import { Download, Calendar, AlertCircle } from "lucide-react";
import "./FinanceDashboard.scss";
import {
  FinanceStats,
  RevenueChart,
  TransactionTable,
  SupplierDebts,
} from "./FinanceComponents";
import { useFinance } from "@/hooks/useFinance";

const FinanceDashboard = () => {
  const {
    range,
    setRange,
    typeFilter,
    setTypeFilter,
    summary,
    trend,
    transactions,
    debts,
    costBreakdown,
    loading,
    error,
    refetch,
  } = useFinance();

  const totalCost =
    costBreakdown.cogs +
    costBreakdown.labor +
    costBreakdown.operations +
    costBreakdown.other;

  const percent = (value) =>
    totalCost > 0 ? `${Math.round((Number(value || 0) / totalCost) * 100)}%` : "0%";

  return (
    <div className="finance-dashboard">
      <header className="page-header">
        <div className="header-left">
          <h1>Quản Trị Tài Chính Nhà Hàng</h1>
          <p>Theo dõi doanh thu, chi phí, lợi nhuận, công nợ và đối soát theo kỳ</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setRange("week")}>
            <Calendar size={16} /> <span>Tuần</span>
          </button>
          <button className="btn-secondary" onClick={() => setRange("month")}>
            <Calendar size={16} /> <span>Tháng</span>
          </button>
          <button className="btn-secondary" onClick={() => setRange("quarter")}>
            <Calendar size={16} /> <span>Quý</span>
          </button>
          <button className="btn-secondary" onClick={() => refetch()}>
            <Download size={16} /> <span>Làm mới ({range})</span>
          </button>
        </div>
      </header>

      {error && <div className="finance-error">Không tải được dữ liệu tài chính: {error.message}</div>}

      <section className="stats-section">
        <FinanceStats summary={summary} />
      </section>

      <div className="main-layout-grid-v2">
        <div className="col-main">
          <div className="card-container chart-card">
            <div className="card-header">
              <h3>Biểu đồ Thu / Chi / Lợi nhuận</h3>
            </div>
            <div className="card-body">{loading ? <div>Đang tải...</div> : <RevenueChart trend={trend} />}</div>
          </div>

          <div className="card-container transactions-card">
            <div className="card-header">
              <h3>Nhật ký giao dịch</h3>
              <div className="simple-filter">
                <button onClick={() => setTypeFilter("all")} className={typeFilter === "all" ? "active" : ""}>
                  Tất cả
                </button>
                <button onClick={() => setTypeFilter("inflow")} className={typeFilter === "inflow" ? "active" : ""}>
                  Thu
                </button>
                <button onClick={() => setTypeFilter("outflow")} className={typeFilter === "outflow" ? "active" : ""}>
                  Chi
                </button>
              </div>
            </div>
            {loading ? <div className="card-body">Đang tải giao dịch...</div> : <TransactionTable transactions={transactions} />}
          </div>
        </div>

        <div className="col-side">
          <div className="card-container debt-card">
            <div className="card-header warning-bg">
              <h3>
                <AlertCircle size={16} /> Công nợ phải xử lý
              </h3>
            </div>
            <div className="card-body no-padding">{loading ? <div className="p-3">Đang tải...</div> : <SupplierDebts debts={debts} />}</div>
          </div>

          <div className="card-container cost-structure">
            <div className="card-header">
              <h3>Cấu trúc chi phí</h3>
            </div>
            <div className="card-body">
              <div className="cost-row">
                <div className="label">COGS (Nguyên liệu)</div>
                <div className="progress">
                  <div className="fill red" style={{ width: percent(costBreakdown.cogs) }}></div>
                </div>
                <div className="value">{percent(costBreakdown.cogs)}</div>
              </div>
              <div className="cost-row">
                <div className="label">Nhân sự (Labor)</div>
                <div className="progress">
                  <div className="fill orange" style={{ width: percent(costBreakdown.labor) }}></div>
                </div>
                <div className="value">{percent(costBreakdown.labor)}</div>
              </div>
              <div className="cost-row">
                <div className="label">Vận hành</div>
                <div className="progress">
                  <div className="fill blue" style={{ width: percent(costBreakdown.operations) }}></div>
                </div>
                <div className="value">{percent(costBreakdown.operations)}</div>
              </div>

              <div className="insight-text">
                💡 <b>Gợi ý:</b> Theo dõi tỷ trọng COGS/Labor so với doanh thu để giữ lợi nhuận ổn định.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
