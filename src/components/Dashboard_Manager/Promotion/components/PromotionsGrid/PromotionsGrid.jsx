import React from "react";
import PromotionCard from "../PromotionCard/PromotionCard";
import "./PromotionsGrid.scss";

const PromotionsGrid = ({ promotions, onEdit, onDelete, onDuplicate }) => {
  if (promotions.length === 0) {
    return (
      <div className="promotions-card">
        <div className="empty-state">
          <span className="empty-icon">🎁</span>
          <h3 className="empty-title">Chưa có khuyến mãi nào</h3>
          <p className="empty-description">
            Tạo khuyến mãi đầu tiên để thu hút khách hàng
          </p>
          <button className="btn btn-primary" onClick={() => onEdit()}>
            ➕ Tạo Khuyến Mãi Đầu Tiên
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="promotions-card">
      <div className="promotions-grid">
        {promotions.map((promotion) => (
          <PromotionCard
            key={promotion.id}
            promotion={promotion}
            onEdit={() => onEdit(promotion)}
            onDelete={() => onDelete(promotion.id)}
            onDuplicate={() => onDuplicate(promotion.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default PromotionsGrid;
