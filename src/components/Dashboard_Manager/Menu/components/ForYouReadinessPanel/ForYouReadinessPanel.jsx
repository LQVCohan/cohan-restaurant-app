import React from "react";
import "./ForYouReadinessPanel.scss";

const ForYouReadinessPanel = ({
  summary,
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
    withAllergen: 0,
    withTaste: 0,
    readyPercent: 0,
  };

  return (
    <section className="for-you-readiness-panel" aria-label="Độ sẵn sàng gợi ý khẩu vị">
      <div className="for-you-readiness-panel__header">
        <h3 className="for-you-readiness-panel__title">Độ sẵn sàng gợi ý khẩu vị</h3>
        <p className="for-you-readiness-panel__subtitle">
          Bổ sung thông tin chế độ ăn, dị ứng và khẩu vị để hệ thống gợi ý món chính xác hơn cho khách.
        </p>
      </div>

      <div className="for-you-readiness-panel__progress">
        <div className="for-you-readiness-panel__progress-meta">
          <strong>{safeSummary.readyPercent}%</strong>
          <span>{safeSummary.ready}/{safeSummary.total} món đã khai báo khẩu vị</span>
        </div>
        <div className="for-you-readiness-panel__progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeSummary.readyPercent}>
          <div className="for-you-readiness-panel__progress-fill" style={{ width: `${safeSummary.readyPercent}%` }} />
        </div>
      </div>

      <div className="for-you-readiness-panel__stats">
        <article className="for-you-readiness-panel__stat"><span>Đã khai báo</span><strong>{safeSummary.ready}</strong></article>
        <article className="for-you-readiness-panel__stat for-you-readiness-panel__stat--missing"><span>Chưa khai báo</span><strong>{safeSummary.missing}</strong></article>
        <article className="for-you-readiness-panel__stat"><span>Có thông tin dị ứng</span><strong>{safeSummary.withAllergen}</strong></article>
        <article className="for-you-readiness-panel__stat"><span>Có khẩu vị/hương vị</span><strong>{safeSummary.withTaste}</strong></article>
      </div>

      <div className="for-you-readiness-panel__actions">
        {safeSummary.missing > 0 && (
          <button type="button" className="mm-btn mm-btn--primary" onClick={onShowMissing}>Xem món chưa khai báo</button>
        )}
        {safeSummary.missing > 0 && canUpdateItem && firstMissingItem && (
          <button type="button" className="mm-btn mm-btn--secondary" onClick={() => onEditFirstMissing(firstMissingItem)}>Bổ sung món đầu tiên</button>
        )}
        {canBulkEdit && bulkTargetCount > 0 && (
          <button type="button" className="mm-btn mm-btn--secondary" onClick={onOpenBulkEdit}>
            Khai báo hàng loạt
            <small className="for-you-readiness-panel__bulk-helper">{selectedCount > 0 ? `Áp dụng cho ${selectedCount} món đã chọn` : "Áp dụng cho các món chưa khai báo trong danh sách hiện tại"}</small>
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
