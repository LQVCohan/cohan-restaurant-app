import React from "react";
import "./ForYouReadinessPanel.scss";

const StatCard = ({ label, value, variant = "default" }) => (
  <article className={`for-you-readiness-panel__stat for-you-readiness-panel__stat--${variant}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </article>
);

const ForYouReadinessPanel = ({
  summary,
  restaurantSummaries = [],
  canUpdateItem,
  firstMissingItem,
  onShowMissing,
  onEditFirstMissing,
  selectedCount = 0,
  bulkTargetCount = 0,
  canBulkEdit = false,
  onOpenBulkEdit,
}) => {
  const safeSummary = summary || {
    total: 0,
    ready: 0,
    missing: 0,
    complete: 0,
    withAllergen: 0,
    withTaste: 0,
    missingDiet: 0,
    missingAllergen: 0,
    missingTaste: 0,
    readyPercent: 0,
  };
  const shouldShowRestaurantGroups = Array.isArray(restaurantSummaries) && restaurantSummaries.length > 1;

  return (
    <section className="for-you-readiness-panel" aria-label="Chất lượng dữ liệu gợi ý khẩu vị">
      <div className="for-you-readiness-panel__header">
        <span className="for-you-readiness-panel__eyebrow">Dữ liệu gợi ý khẩu vị</span>
        <h3 className="for-you-readiness-panel__title">Chất lượng dữ liệu gợi ý khẩu vị</h3>
        <p className="for-you-readiness-panel__subtitle">
          Bổ sung khẩu vị, dị ứng và diet tags để AI gợi ý món chính xác hơn.
        </p>
      </div>

      <div className="for-you-readiness-panel__progress">
        <div className="for-you-readiness-panel__progress-meta">
          <strong>{safeSummary.readyPercent}%</strong>
          <span>{safeSummary.ready}/{safeSummary.total} món có ít nhất một nhóm metadata</span>
        </div>
        <div className="for-you-readiness-panel__progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeSummary.readyPercent}>
          <div className="for-you-readiness-panel__progress-fill" style={{ width: `${safeSummary.readyPercent}%` }} />
        </div>
      </div>

      <div className="for-you-readiness-panel__stats for-you-readiness-panel__stats--quality">
        <StatCard label="Tổng món" value={safeSummary.total} />
        <StatCard label="Đủ dữ liệu" value={safeSummary.complete || 0} variant="complete" />
        <StatCard label="Thiếu dữ liệu" value={safeSummary.missing} variant="missing" />
        <StatCard label="Thiếu diet" value={safeSummary.missingDiet || 0} variant="missing-soft" />
        <StatCard label="Thiếu dị ứng" value={safeSummary.missingAllergen || 0} variant="missing-soft" />
        <StatCard label="Thiếu khẩu vị" value={safeSummary.missingTaste || 0} variant="missing-soft" />
      </div>

      {shouldShowRestaurantGroups && (
        <div className="for-you-readiness-panel__restaurants">
          {restaurantSummaries.map((restaurant) => (
            <div className="for-you-readiness-panel__restaurant" key={restaurant.restaurantId}>
              <span>{restaurant.restaurantName}</span>
              <strong>{restaurant.ready}/{restaurant.total}</strong>
              <small>Thiếu dị ứng: {restaurant.missingAllergen || 0}</small>
            </div>
          ))}
        </div>
      )}

      <div className="for-you-readiness-panel__actions">
        {safeSummary.missing > 0 && (
          <button type="button" className="mm-btn mm-btn--primary" onClick={onShowMissing}>Xem món thiếu khẩu vị</button>
        )}
        {safeSummary.missing > 0 && canUpdateItem && firstMissingItem && (
          <button type="button" className="mm-btn mm-btn--secondary" onClick={() => onEditFirstMissing(firstMissingItem)}>Bổ sung món đầu</button>
        )}
        {canBulkEdit && bulkTargetCount > 0 && (
          <button type="button" className="mm-btn mm-btn--secondary" onClick={onOpenBulkEdit}>
            Bổ sung hàng loạt
            <small className="for-you-readiness-panel__bulk-helper">{selectedCount > 0 ? `Áp dụng cho ${selectedCount} món đã chọn` : "Áp dụng cho các món thiếu khẩu vị trong danh sách hiện tại"}</small>
          </button>
        )}
        {safeSummary.missing === 0 && safeSummary.total > 0 && (
          <p className="for-you-readiness-panel__success">Tất cả món trong danh sách hiện tại đã có thông tin khẩu vị hoặc dị ứng.</p>
        )}
      </div>
    </section>
  );
};

export default ForYouReadinessPanel;
