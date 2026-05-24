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
import { useRestaurantCurrency } from "@/hooks/useRestaurantCurrency";

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
    reconciliations,
    reconciliationSummary,
    costBreakdown,
    loading,
    error,
    refetch,
    restaurantId,
    setRestaurantId,
    restaurants,
  } = useFinance();
  const {
    activeCurrency,
    setActiveCurrency,
    manualUsdToVndRate,
    persistSettings,
  } = useRestaurantCurrency(restaurantId);

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
          <select
            className="btn-secondary"
            value={restaurantId || ""}
            onChange={(e) => setRestaurantId(e.target.value)}
          >
            <option value="">Chọn nhà hàng</option>
            {(restaurants || []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            className="btn-secondary"
            value={activeCurrency}
            onChange={async (e) => {
              setActiveCurrency(e.target.value);
              await persistSettings({ defaultCurrency: e.target.value });
            }}
          >
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </select>
          <input
            className="btn-secondary"
            type="number"
            min="1"
            defaultValue={manualUsdToVndRate}
            onBlur={async (e) => {
              const v = Number(e.target.value);
              if (v > 0) {
                await persistSettings({ manualUsdToVndRate: v });
              }
            }}
            title="Tỷ giá USD -> VND"
          />
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
          <div className="card-container transactions-card">
            <div className="card-header"><h3>Đối soát chuyển khoản</h3></div>
            <div className="card-body">
              <div>Matched: <b>{reconciliationSummary.matched}</b> | Amount mismatch: <b>{reconciliationSummary.amountMismatch}</b> | Unmatched: <b>{reconciliationSummary.unmatched}</b></div>
              <table className="clean-table">
                <thead><tr><th>Thời gian</th><th>Số tiền</th><th>Reference</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
                <tbody>
                  {(reconciliations || []).slice(0, 10).map((r) => (
                    <tr key={r.id}>
                      <td>{r.time ? new Date(r.time).toLocaleString("vi-VN") : "-"}</td>
                      <td>{Number(r.amount || 0).toLocaleString("vi-VN")}đ</td>
                      <td>{r.reference || "-"}</td>
                      <td>{r.status}</td>
                      <td>{r.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
