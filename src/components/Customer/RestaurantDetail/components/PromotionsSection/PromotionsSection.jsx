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
      <div className="promo-section">
        <div className="promo-loading">Đang tải khuyến mãi...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="promo-section">
        <div className="promo-error">Không thể tải khuyến mãi.</div>
      </div>
    );
  }

  if (!promotions.length) {
    return (
      <div className="promo-section">
        <div className="promo-empty">
          Hiện chưa có khuyến mãi đang áp dụng cho nhà hàng này.
        </div>
      </div>
    );
  }

  return (
    <div className="promo-section">
      <div className="promo-grid">
        {promotions.map((promo) => {
          const isPercent = promo.discountType === "PERCENT";
          const endAt = promo.endAt
            ? new Date(promo.endAt).toLocaleDateString("vi-VN")
            : "Không giới hạn";

          return (
            <div key={promo.id} className="promo-card">
              <div className="promo-header">
                <span className="promo-scope">{promo.scope || "ORDER"}</span>
                <span className="promo-discount">
                  {isPercent
                    ? `-${promo.discountValue}%`
                    : `-${Number(promo.discountValue || 0).toLocaleString()}đ`}
                </span>
              </div>
              <h4>{promo.name}</h4>
              <p>{promo.description || "Ưu đãi đang áp dụng."}</p>
              <div className="promo-footer">HSD: {endAt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PromotionsSection;
