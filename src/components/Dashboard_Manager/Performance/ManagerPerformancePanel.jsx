import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useManagerPerformanceDashboard } from "@/hooks/useManagerPerformanceDashboard";
import "./ManagerPerformancePanel.scss";

const ACTION_LABELS = {
  review_overdue_incidents: "Xử lý incident quá hạn",
  apply_or_waive_eligible_incidents: "Duyệt áp điểm hoặc miễn trừ",
  review_low_score_employees: "Kiểm tra nhân viên điểm thấp",
  check_repeated_off_schedule: "Kiểm tra làm ngoài lịch lặp lại",
  check_repeated_corrections: "Kiểm tra sửa công lặp lại",
};

const formatScore = (value) => Number(value || 0).toFixed(1).replace(/\.0$/, "");
const formatDelta = (value) => {
  const numeric = Number(value || 0);
  if (numeric === 0) return "0";
  return `${numeric > 0 ? "+" : ""}${numeric}`;
};

const ManagerPerformancePanel = ({ restaurantId, summaryOnly = false, showViewAll = false }) => {
  const navigate = useNavigate();
  const { dashboard, loading, error, isEmpty } = useManagerPerformanceDashboard({ restaurantId });

  const topRiskEmployees = useMemo(
    () => (summaryOnly ? (dashboard.topRiskEmployees || []).slice(0, 3) : dashboard.topRiskEmployees || []),
    [dashboard.topRiskEmployees, summaryOnly]
  );

  const actionableItems = useMemo(
    () => (dashboard.recommendedActions || []).filter((item) => Number(item?.count || 0) > 0),
    [dashboard.recommendedActions]
  );

  if (!restaurantId) return <div className="performance-empty">Vui lòng chọn nhà hàng để xem hiệu suất.</div>;
  if (loading) return <div className="performance-loading">Đang tải dữ liệu hiệu suất...</div>;
  if (error) return <div className="performance-error">Không tải được dữ liệu hiệu suất.</div>;
  if (isEmpty) return <div className="performance-empty">Chưa có dữ liệu incident hoặc hiệu suất trong kỳ này.</div>;

  return (
    <div className={`performance-panel ${summaryOnly ? "performance-panel--summary" : ""}`}>
      <div className="performance-panel__header">
        <h3>Hiệu suất & trách nhiệm</h3>
        {showViewAll ? (
          <button type="button" className="btn-link" onClick={() => navigate("/manager/performance")}>
            Xem dashboard hiệu suất
          </button>
        ) : null}
      </div>

      <div className="performance-kpi-grid">
        <div className="kpi-card"><span>Chờ duyệt</span><strong>{dashboard.incidentOverview.pendingReviewCount}</strong></div>
        <div className="kpi-card"><span>Quá hạn</span><strong>{dashboard.incidentOverview.overdueCount}</strong></div>
        <div className="kpi-card"><span>Đủ điều kiện áp điểm</span><strong>{dashboard.incidentOverview.eligibleCount}</strong></div>
        <div className="kpi-card"><span>Điểm trung bình</span><strong>{formatScore(dashboard.scoringOverview.averageScore)}</strong></div>
      </div>

      <div className="performance-section">
        <h4>Nhân viên rủi ro</h4>
        {topRiskEmployees.length ? (
          <div className="simple-table simple-table--summary">
            {topRiskEmployees.map((emp, index) => (
              <div className="simple-table__row" key={`${emp.employeeId || "unknown"}-${index}`}>
                <span className="employee-name">{emp.employeeName || "Nhân viên chưa xác định"}</span>
                <span>Điểm: {formatScore(emp.finalPerformanceScore)}</span>
                <span>Thay đổi: {formatDelta(emp.totalScoreDelta)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="performance-empty performance-empty--compact">
            <p>Chưa có cảnh báo hiệu suất.</p>
            <p>Các chỉ số vận hành đang ổn định.</p>
          </div>
        )}
      </div>

      <div className="performance-section">
        <h4>Khuyến nghị hành động</h4>
        {actionableItems.length ? (
          <ul className="action-list">
            {actionableItems.map((item) => (
              <li key={`${item.action}-${item.priority}`}>
                <span>{ACTION_LABELS[item.action] || item.action}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="action-list__empty">Không có khuyến nghị cần xử lý.</p>
        )}
      </div>
    </div>
  );
};

export default ManagerPerformancePanel;
