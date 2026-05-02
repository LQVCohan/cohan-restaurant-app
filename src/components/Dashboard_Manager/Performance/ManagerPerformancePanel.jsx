import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useManagerPerformanceDashboard } from "@/hooks/useManagerPerformanceDashboard";

const RISK_LABELS = {
  critical: "Rất cao",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

const ACTION_LABELS = {
  review_overdue_incidents: "Xử lý incident quá hạn",
  apply_or_waive_eligible_incidents: "Duyệt áp điểm hoặc miễn trừ",
  review_low_score_employees: "Kiểm tra nhân viên điểm thấp",
  check_repeated_off_schedule: "Kiểm tra làm ngoài lịch lặp lại",
  check_repeated_corrections: "Kiểm tra sửa công lặp lại",
};

const formatScore = (value) => Number(value || 0).toFixed(1).replace(/\.0$/, "");
const formatPercent = (value) => `${Number(value || 0).toFixed(1).replace(/\.0$/, "")}%`;
const formatAction = (value = "") =>
  value
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

const ManagerPerformancePanel = ({
  restaurantId,
  summaryOnly = false,
  showViewAll = false,
}) => {
  const navigate = useNavigate();
  const { dashboard, loading, error, isEmpty } = useManagerPerformanceDashboard({
    restaurantId,
  });

  const topRiskEmployees = useMemo(
    () => (summaryOnly ? dashboard.topRiskEmployees.slice(0, 3) : dashboard.topRiskEmployees),
    [dashboard.topRiskEmployees, summaryOnly]
  );

  if (!restaurantId) {
    return <div className="performance-empty">Vui lòng chọn nhà hàng để xem hiệu suất.</div>;
  }

  if (loading) {
    return <div className="performance-loading">Đang tải dữ liệu hiệu suất...</div>;
  }

  if (error) {
    return <div className="performance-error">Không tải được dữ liệu hiệu suất.</div>;
  }

  if (isEmpty) {
    return <div className="performance-empty">Chưa có dữ liệu incident hoặc hiệu suất trong kỳ này.</div>;
  }

  return (
    <div className="performance-panel">
      <div className="performance-panel__header">
        <h3>Hiệu suất & trách nhiệm</h3>
        {showViewAll ? (
          <button className="btn-link" onClick={() => navigate("/manager/performance")}>
            Xem dashboard hiệu suất
          </button>
        ) : null}
      </div>

      {dashboard.incidentOverview.pendingReviewCount > 0 ? <button className="btn-link" onClick={() => navigate("/manager/performance")}>Xử lý incident</button> : null}

      <div className="performance-kpi-grid">
        <div className="kpi-card"><span>Chờ duyệt</span><strong>{dashboard.incidentOverview.pendingReviewCount}</strong></div>
        <div className="kpi-card"><span>Quá hạn</span><strong>{dashboard.incidentOverview.overdueCount}</strong></div>
        <div className="kpi-card"><span>Đủ điều kiện áp điểm</span><strong>{dashboard.incidentOverview.eligibleCount}</strong></div>
        <div className="kpi-card"><span>Điểm TB</span><strong>{formatScore(dashboard.scoringOverview.averageScore)}</strong></div>
        <div className="kpi-card"><span>Nhân viên điểm thấp</span><strong>{dashboard.scoringOverview.lowScoreEmployeeCount}</strong></div>
        {!summaryOnly && (
          <div className="kpi-card"><span>SLA đúng hạn</span><strong>{formatPercent(dashboard.slaOverview.slaComplianceRate)}</strong></div>
        )}
      </div>

      <div className="performance-section">
        <h4>Top nhân viên rủi ro</h4>
        <div className="simple-table">
          <div className="simple-table__head"><span>Nhân viên</span><span>Rủi ro</span><span>Điểm</span><span>Delta</span></div>
          {topRiskEmployees.length ? topRiskEmployees.map((emp) => (
            <div className="simple-table__row" key={emp.employeeId}>
              <span>{emp.employeeId}</span>
              <span>{RISK_LABELS[emp.riskLevel] || emp.riskLevel}</span>
              <span>{formatScore(emp.finalPerformanceScore)}</span>
              <span>{emp.totalScoreDelta}</span>
            </div>
          )) : <div className="simple-table__empty">Không có nhân viên rủi ro.</div>}
        </div>
      </div>

      <div className="performance-section">
        <h4>Khuyến nghị hành động</h4>
        <ul className="action-list">
          {dashboard.recommendedActions.length ? dashboard.recommendedActions.map((item) => (
            <li key={`${item.action}-${item.priority}`}>
              <span>{ACTION_LABELS[item.action] || formatAction(item.action)}</span>
              <strong>{item.count}</strong>
            </li>
          )) : <li>Không có khuyến nghị.</li>}
        </ul>
      </div>

      {!summaryOnly && (
        <>
          <div className="performance-section">
            <h4>Top loại sự kiện</h4>
            <ul className="event-list">
              {dashboard.topEventTypes.map((event) => (
                <li key={event.eventType}><span>{event.eventType}</span><strong>{event.count}</strong></li>
              ))}
            </ul>
          </div>
          <div className="performance-section">
            <h4>Tổng quan SLA</h4>
            <p>
              Cần review: {dashboard.slaOverview.totalRequiringReview} • Quá hạn: {dashboard.slaOverview.overdueCount} • Sắp đến hạn: {dashboard.slaOverview.dueSoonCount}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ManagerPerformancePanel;
