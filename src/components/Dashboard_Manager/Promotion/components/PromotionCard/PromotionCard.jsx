import React from "react";
import {
  RESTAURANTS,
  PROMOTION_TYPES,
  STATUS_TYPES,
  TARGET_AUDIENCE,
} from "../../../../../utils/constants";
import "./PromotionCard.scss";

const PromotionCard = ({ promotion, onEdit, onDelete, onDuplicate }) => {
  const getDiscountText = () => {
    switch (promotion.type) {
      case "percentage":
        return `${promotion.discountValue}%`;
      case "fixed":
        return `${promotion.discountValue.toLocaleString()}đ`;
      case "freeship":
        return "Miễn phí";
      default:
        return "Đặc biệt";
    }
  };

  const getStatusClass = () => `status-${promotion.status}`;

  return (
    <div className="promotion-card fade-in">
      <div className="card-header">
        <div className="card-title">
          <div>
            <h3 className="promotion-name">{promotion.name}</h3>
            <div className="promotion-description">{promotion.description}</div>
          </div>
          <span className="promotion-type">
            {PROMOTION_TYPES[promotion.type]}
          </span>
        </div>
      </div>

      <div className="card-body">
        <div className={`status-indicator ${getStatusClass()}`}>
          <div className="status-dot"></div>
          <span className="status-text">{STATUS_TYPES[promotion.status]}</span>
        </div>

        <div className="promotion-details">
          <div className="detail-item">
            <span className="detail-label">Mã KM</span>
            <span className="detail-value">{promotion.code}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Giá trị</span>
            <span className="detail-value">{getDiscountText()}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Đối tượng</span>
            <span className="detail-value">
              {TARGET_AUDIENCE[promotion.targetAudience]}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Nhà hàng</span>
            <span className="detail-value">
              {RESTAURANTS[promotion.restaurantId]}
            </span>
          </div>
        </div>

        <div className="promotion-conditions">
          <div className="conditions-title">📋 Điều kiện áp dụng:</div>
          <ul className="conditions-list">
            {promotion.conditions.map((condition, index) => (
              <li key={index}>{condition}</li>
            ))}
          </ul>
        </div>

        <div className="card-actions">
          <button
            className="btn btn-small btn-duplicate"
            onClick={onDuplicate}
            title="Sao chép"
          >
            📋
          </button>
          <button
            className="btn btn-small btn-edit"
            onClick={onEdit}
            title="Chỉnh sửa"
          >
            ✏️
          </button>
          <button
            className="btn btn-small btn-delete"
            onClick={onDelete}
            title="Xóa"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromotionCard;
