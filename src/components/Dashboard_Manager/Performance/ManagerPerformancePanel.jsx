import React, { useMemo } from "react";
import { useManagerPerformanceDashboard } from "@/hooks/useManagerPerformanceDashboard";
import "./ManagerPerformancePanel.scss";

const ACTION_LABELS = {
  review_overdue_incidents: "Xử lý sự cố quá hạn",
  apply_or_waive_eligible_incidents: "Duyệt trừ điểm hoặc miễn trừ",
  review_low_score_employees: "Kiểm tra nhân viên có điểm thấp",
  check_repeated_off_schedule: "Kiểm tra tình trạng làm ngoài lịch nhiều lần",
  check_repeated_corrections: "Kiểm tra tình trạng sửa công nhiều lần",
};

const formatScore = (value) =>
  Number(value || 0)
    .toFixed(1)
    .replace(/\.0$/, "");

const ManagerPerformancePanel = ({
  restaurantId,
  restaurantLoading = false,
  summaryOnly = false,
  showViewAll = false,
  compactWhenHealthy = false,
}) => {
  const { dashboard, loading, error, isEmpty } =
    useManagerPerformanceDashboard({ restaurantId });

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
  const hasScoreData =
    Number(scoringOverview?.highestScore || 0) > 0 ||
    Number(scoringOverview?.averageScore || 0) > 0;
  const isHealthyCompact =
    summaryOnly &&
    compactWhenHealthy &&
    hasScoreData &&
    actionableItems.length === 0 &&
    !hasIncidentSignals;
  const hasAppealOverview =
    appealOverview &&
    (appealOverview.pendingCount !== undefined ||
      appealOverview.acceptedCount !== undefined);

  const handleViewDetails = () => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: {
          page: "staff",
          query: {
            staffPage: "performance",
            ...(restaurantId ? { restaurantId } : {}),
          },
          source: "manager-performance-dashboard",
        },
      }),
    );
  };

  const renderPanelHeader = () => (
    <div className="performance-panel__header">
      <h3>Hiệu suất nhân viên</h3>
      {showViewAll ? (
        <button
          type="button"
          className="btn-link"
          onClick={handleViewDetails}
          aria-label="Xem chi tiết hiệu suất nhân viên"
        >
          Xem chi tiết
        </button>
      ) : null}
    </div>
  );

  const renderPanelState = (stateClass, message, role) => (
    <div
      className={`performance-panel ${summaryOnly ? "performance-panel--summary" : ""}`}
    >
      {renderPanelHeader()}
      <div className={stateClass} role={role}>
        {message}
      </div>
    </div>
  );

  if (!restaurantId && restaurantLoading) {
    return renderPanelState(
      "performance-loading",
      "Đang tải dữ liệu hiệu suất nhân viên...",
      "status",
    );
  }
  if (!restaurantId) {
    return renderPanelState(
      "performance-empty",
      "Hãy chọn nhà hàng để xem hiệu suất nhân viên.",
    );
  }
  if (loading) {
    return renderPanelState(
      "performance-loading",
      "Đang tải dữ liệu hiệu suất nhân viên...",
      "status",
    );
  }
  if (error) {
    return renderPanelState(
      "performance-error",
      "Không thể tải dữ liệu hiệu suất. Vui lòng thử lại.",
    );
  }
  if (isEmpty) {
    return renderPanelState(
      "performance-empty",
      "Chưa phát sinh dữ liệu đánh giá hoặc điều chỉnh điểm trong tháng này.",
    );
  }

  return (
    <div
      className={`performance-panel ${summaryOnly ? "performance-panel--summary" : ""}`}
    >
      {renderPanelHeader()}

      {isHealthyCompact ? (
        <div className="performance-summary-note performance-summary-note--compact">
          <div className="performance-summary-score">
            <span>Điểm trung bình</span>
            <strong>{formatScore(scoringOverview.averageScore)}</strong>
          </div>
          <p>Không có vấn đề hiệu suất cần xử lý trong tháng này.</p>
        </div>
      ) : (
        <>
          <div className="performance-kpi-grid">
            <div className="kpi-card">
              <span>Điểm trung bình</span>
              <strong>
                {scoringOverview?.averageScore !== undefined
                  ? formatScore(scoringOverview.averageScore)
                  : "--"}
              </strong>
            </div>
            <div className="kpi-card">
              <span>Nhân viên cần chú ý</span>
              <strong>{scoringOverview?.lowScoreEmployeeCount ?? "--"}</strong>
            </div>
            <div className="kpi-card">
              <span>Sự cố chờ xử lý</span>
              <strong>
                {incidentOverview
                  ? `${incidentOverview.pendingReviewCount || 0} / ${incidentOverview.eligibleCount || 0}`
                  : "--"}
              </strong>
            </div>
            <div className="kpi-card">
              <span>Tổng số sự cố</span>
              <strong>{incidentOverview?.totalIncidents ?? 0}</strong>
            </div>
            {hasAppealOverview ? (
              <div className="kpi-card">
                <span>Yêu cầu xem xét chờ duyệt</span>
                <strong>{appealOverview.pendingCount ?? 0}</strong>
              </div>
            ) : null}
          </div>

          {summaryOnly ? (
            <div className="performance-summary-note">
              {actionableItems.length > 0 ? (
                <p>
                  Có{" "}
                  {actionableItems.reduce(
                    (sum, item) => sum + Number(item.count || 0),
                    0,
                  )}{" "}
                  vấn đề hiệu suất cần xử lý.
                </p>
              ) : (
                <p>Không có vấn đề hiệu suất cần xử lý.</p>
              )}
            </div>
          ) : (
            <div className="performance-section">
              <h4>Việc cần xử lý</h4>
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
                <p className="action-list__empty">Không có việc cần xử lý.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ManagerPerformancePanel;
