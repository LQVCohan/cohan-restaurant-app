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

const ManagerPerformancePanel = ({
  restaurantId,
  restaurantLoading = false,
  summaryOnly = false,
  showViewAll = false,
  compactWhenHealthy = false,
}) => {
  const navigate = useNavigate();
  const { dashboard, loading, error, isEmpty } = useManagerPerformanceDashboard({ restaurantId });

  const incidentOverview = dashboard?.incidentOverview || {};
  const scoringOverview = dashboard?.scoringOverview || {};
  const recommendedActions = Array.isArray(dashboard?.recommendedActions)
    ? dashboard.recommendedActions
    : [];

  const actionableItems = useMemo(
    () => recommendedActions.filter((item) => Number(item?.count || 0) > 0),
    [recommendedActions],
  );
  const hasIncidentSignals =
    Number(incidentOverview.pendingReviewCount || 0) > 0 ||
    Number(incidentOverview.overdueCount || 0) > 0;
  const isHealthyCompact = summaryOnly && compactWhenHealthy && actionableItems.length === 0 && !hasIncidentSignals;

  if (!restaurantId && restaurantLoading) {
    return <div className="performance-loading">Đang tải dữ liệu hiệu suất...</div>;
  }
  if (!restaurantId) {
    return (
      <div className="performance-empty">
        Chưa có nhà hàng được chọn để xem hiệu suất.
      </div>
    );
  }
  if (loading) return <div className="performance-loading">Đang tải dữ liệu hiệu suất...</div>;
  if (error) return <div className="performance-error">Không tải được dữ liệu hiệu suất.</div>;
  if (isEmpty) return <div className="performance-empty">Chưa có dữ liệu hiệu suất trong kỳ này.</div>;

  return (
    <div className={`performance-panel ${summaryOnly ? "performance-panel--summary" : ""}`}>
      <div className="performance-panel__header">
        <h3>Hiệu suất</h3>
        {showViewAll ? <button type="button" className="btn-link" onClick={() => navigate("/manager#staff")}>Xem chi tiết</button> : null}
      </div>

      {isHealthyCompact ? (
        <div className="performance-summary-note performance-summary-note--compact">
          <p>Chưa có cảnh báo hiệu suất rõ ràng.</p>
        </div>
      ) : (
        <>
          <div className="performance-kpi-grid">
            <div className="kpi-card"><span>Chờ duyệt</span><strong>{incidentOverview.pendingReviewCount || 0}</strong></div>
            <div className="kpi-card"><span>Quá hạn</span><strong>{incidentOverview.overdueCount || 0}</strong></div>
            <div className="kpi-card"><span>Đủ điều kiện áp điểm</span><strong>{incidentOverview.eligibleCount || 0}</strong></div>
            <div className="kpi-card"><span>Điểm trung bình</span><strong>{formatScore(scoringOverview.averageScore || 0)}</strong></div>
          </div>

          {summaryOnly ? (
            <div className="performance-summary-note">
              {actionableItems.length > 0 ? <p>Có {actionableItems.reduce((s, i) => s + Number(i.count || 0), 0)} mục hiệu suất cần xử lý.</p> : <p>Chưa có cảnh báo hiệu suất rõ ràng.</p>}
            </div>
          ) : (
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
          )}
        </>
      )}
    </div>
  );
};

export default ManagerPerformancePanel;