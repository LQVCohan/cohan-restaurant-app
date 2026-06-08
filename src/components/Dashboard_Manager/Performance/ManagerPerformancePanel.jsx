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
  const appealOverview = dashboard?.appealOverview;
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
  const hasAppealOverview =
    appealOverview &&
    (appealOverview.pendingCount !== undefined || appealOverview.acceptedCount !== undefined);

  const renderPanelHeader = () => (
    <div className="performance-panel__header">
      <h3>Hiệu suất</h3>
      {showViewAll ? <button type="button" className="btn-link" onClick={() => navigate("/manager#staff")}>Xem chi tiết</button> : null}
    </div>
  );

  const renderPanelState = (stateClass, message, role) => (
    <div className={`performance-panel ${summaryOnly ? "performance-panel--summary" : ""}`}>
      {renderPanelHeader()}
      <div className={stateClass} role={role}>{message}</div>
    </div>
  );

  if (!restaurantId && restaurantLoading) {
    return renderPanelState("performance-loading", "Đang tải dữ liệu hiệu suất...", "status");
  }
  if (!restaurantId) {
    return renderPanelState("performance-empty", "Chưa có nhà hàng được chọn để xem hiệu suất.");
  }
  if (loading) return renderPanelState("performance-loading", "Đang tải dữ liệu hiệu suất...", "status");
  if (error) return renderPanelState("performance-error", "Không thể tải dữ liệu. Vui lòng thử lại.");
  if (isEmpty) return renderPanelState("performance-empty", "Chưa có dữ liệu để hiển thị.");

  return (
    <div className={`performance-panel ${summaryOnly ? "performance-panel--summary" : ""}`}>
      {renderPanelHeader()}

      {isHealthyCompact ? (
        <div className="performance-summary-note performance-summary-note--compact">
          <p>Chưa có cảnh báo hiệu suất rõ ràng.</p>
        </div>
      ) : (
        <>
          <div className="performance-kpi-grid">
            <div className="kpi-card"><span>Điểm trung bình</span><strong>{scoringOverview?.averageScore !== undefined ? formatScore(scoringOverview.averageScore) : "--"}</strong></div>
            <div className="kpi-card"><span>Số nhân viên cần chú ý</span><strong>{scoringOverview?.lowScoreEmployeeCount ?? "--"}</strong></div>
            <div className="kpi-card"><span>Incident cần xử lý</span><strong>{incidentOverview ? `${incidentOverview.pendingReviewCount || 0} / ${incidentOverview.eligibleCount || 0}` : "--"}</strong></div>
            <div className="kpi-card"><span>Tổng incident</span><strong>{incidentOverview?.totalIncidents ?? 0}</strong></div>
            {hasAppealOverview ? (
              <div className="kpi-card"><span>Appeal chờ duyệt</span><strong>{appealOverview.pendingCount ?? 0}</strong></div>
            ) : null}
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
