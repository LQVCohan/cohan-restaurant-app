import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import "./PromotionsSection.scss";

const GET_PROMOTIONS = gql`
  query PromotionsByRestaurant(
    $restaurantId: ID!
    $activeOnly: Boolean = true
    $limit: Int = 20
    $offset: Int = 0
  ) {
    promotionsByRestaurant(
      restaurantId: $restaurantId
      activeOnly: $activeOnly
      limit: $limit
      offset: $offset
    ) {
      id
      name
      description
      scope
      discountType
      discountValue
      startAt
      endAt
      isActive
    }
  }
`;

const PromotionsSection = ({ restaurantId }) => {
  const { data, loading, error } = useQuery(GET_PROMOTIONS, {
    variables: { restaurantId, activeOnly: true, limit: 20, offset: 0 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const promotions = useMemo(
    () => data?.promotionsByRestaurant ?? [],
    [data]
  );

  if (loading) {
    return (
      <div className="promo-section tab-panel-shell">
        <div className="promo-section-header">
          <p className="section-eyebrow">Ưu đãi</p>
          <h2>Khuyến mãi</h2>
          <p>Các chương trình đang được nhà hàng áp dụng.</p>
        </div>
        <div className="promo-loading section-card">
          <span className="promo-loading-icon" aria-hidden="true">🏷️</span>
          <span>Đang tải khuyến mãi...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="promo-section tab-panel-shell">
        <div className="promo-section-header">
          <p className="section-eyebrow">Ưu đãi</p>
          <h2>Khuyến mãi</h2>
          <p>Các chương trình đang được nhà hàng áp dụng.</p>
        </div>
        <div className="promo-error empty-state-card" role="alert">
          <span className="empty-state-icon" aria-hidden="true">🏷️</span>
          <h3 className="empty-state-title">Không thể tải khuyến mãi</h3>
          <p className="empty-state-description">Vui lòng thử lại sau.</p>
        </div>
      </div>
    );
  }

  if (!promotions.length) {
    return (
      <div className="promo-section tab-panel-shell">
        <div className="promo-section-header">
          <p className="section-eyebrow">Ưu đãi</p>
          <h2>Khuyến mãi</h2>
          <p>Các chương trình đang được nhà hàng áp dụng.</p>
        </div>
        <div className="promo-empty empty-state-card">
          <span className="empty-state-icon" aria-hidden="true">🏷️</span>
          <h3 className="empty-state-title">Chưa có khuyến mãi</h3>
          <p className="empty-state-description">Nhà hàng hiện chưa có chương trình ưu đãi nào.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="promo-section tab-panel-shell">
      <div className="promo-section-header">
        <p className="section-eyebrow">Ưu đãi</p>
        <h2>Khuyến mãi</h2>
        <p>Các chương trình đang được nhà hàng áp dụng.</p>
      </div>
      <div className="promo-grid">
        {promotions.map((promo) => {
          const isPercent = promo.discountType === "PERCENT";
          const endAt = promo.endAt
            ? new Date(promo.endAt).toLocaleDateString("vi-VN")
            : "Không giới hạn";

          return (
            <div key={promo.id} className="promo-card">
              <div className="promo-header">
                <span className="promo-scope">{promo.isActive ? "Đang diễn ra" : promo.scope || "ORDER"}</span>
                <span className="promo-discount">
                  {isPercent
                    ? `-${promo.discountValue}%`
                    : `-${Number(promo.discountValue || 0).toLocaleString()}đ`}
                </span>
              </div>
              <h4>{promo.name}</h4>
              <p>{promo.description || "Ưu đãi đang áp dụng."}</p>
              <div className="promo-footer">Thời gian áp dụng đến: {endAt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PromotionsSection;
