import React from "react";
import "./ForYouReadinessPanel.scss";

const StatCard = ({ label, value, variant = "default" }) => (
  <article
    className={`for-you-readiness-panel__stat for-you-readiness-panel__stat--${variant}`}
  >
    <span>{label}</span>
    <strong>{value}</strong>
  </article>
);

const clampPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

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
  const readyPercent = clampPercent(safeSummary.readyPercent);
  const shouldShowRestaurantGroups =
    Array.isArray(restaurantSummaries) && restaurantSummaries.length > 1;

  return (
    <section
      className="for-you-readiness-panel"
      aria-label="Mức độ hoàn thiện thông tin khẩu vị và dị ứng"
    >
      <div className="for-you-readiness-panel__header">
        <span className="for-you-readiness-panel__eyebrow">
          Dữ liệu tư vấn món
        </span>
        <h3 className="for-you-readiness-panel__title">
          Mức độ hoàn thiện khẩu vị và dị ứng
        </h3>
        <p className="for-you-readiness-panel__subtitle">
          Bổ sung chế độ ăn, thành phần dị ứng và khẩu vị để nhân viên tư vấn món
          chính xác hơn.
        </p>
      </div>

      <div className="for-you-readiness-panel__progress">
        <div className="for-you-readiness-panel__progress-meta">
          <strong>{readyPercent}%</strong>
          <span>
            {safeSummary.ready}/{safeSummary.total} món đã đủ thông tin tư vấn
          </span>
        </div>
        <div
          className="for-you-readiness-panel__progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readyPercent}
        >
          <div
            className="for-you-readiness-panel__progress-fill"
            style={{ "--ready-percent": `${readyPercent}%` }}
          />
        </div>
      </div>

      <div className="for-you-readiness-panel__stats for-you-readiness-panel__stats--quality">
        <StatCard label="Tổng số món" value={safeSummary.total} />
        <StatCard
          label="Chưa hoàn thiện"
          value={safeSummary.missing}
          variant="missing"
        />
        <StatCard
          label="Thiếu thông tin dị ứng"
          value={safeSummary.missingAllergen || 0}
          variant="missing-soft"
        />
        <StatCard
          label="Thiếu thông tin khẩu vị"
          value={safeSummary.missingTaste || 0}
          variant="missing-soft"
        />
      </div>

      {shouldShowRestaurantGroups && (
        <div className="for-you-readiness-panel__restaurants">
          {restaurantSummaries.map((restaurant) => (
            <div
              className="for-you-readiness-panel__restaurant"
              key={restaurant.restaurantId}
            >
              <span>{restaurant.restaurantName}</span>
              <strong>
                {restaurant.ready}/{restaurant.total} món hoàn thiện
              </strong>
              <small>
                Thiếu thông tin dị ứng: {restaurant.missingAllergen || 0}
              </small>
            </div>
          ))}
        </div>
      )}

      <div className="for-you-readiness-panel__actions">
        {safeSummary.missing > 0 && (
          <button
            type="button"
            className="mm-btn mm-btn--primary"
            onClick={onShowMissing}
          >
            Lọc các món chưa hoàn thiện
          </button>
        )}
        {safeSummary.missing > 0 && canUpdateItem && firstMissingItem && (
          <button
            type="button"
            className="mm-btn mm-btn--secondary"
            onClick={() => onEditFirstMissing(firstMissingItem)}
          >
            Bổ sung món đầu tiên
          </button>
        )}
        {canBulkEdit && bulkTargetCount > 0 && (
          <button
            type="button"
            className="mm-btn mm-btn--secondary"
            onClick={onOpenBulkEdit}
          >
            Cập nhật hàng loạt
            <small className="for-you-readiness-panel__bulk-helper">
              {selectedCount > 0
                ? `Áp dụng cho ${selectedCount} món đã chọn`
                : "Áp dụng cho các món chưa hoàn thiện trong danh sách hiện tại"}
            </small>
          </button>
        )}
        {safeSummary.missing === 0 && safeSummary.total > 0 && (
          <p className="for-you-readiness-panel__success">
            Tất cả món trong danh sách hiện tại đã có đủ thông tin tư vấn.
          </p>
        )}
      </div>
    </section>
  );
};

export default ForYouReadinessPanel;
