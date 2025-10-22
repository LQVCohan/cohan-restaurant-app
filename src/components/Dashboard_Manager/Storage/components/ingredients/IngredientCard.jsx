import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import { formatPrice } from "../../../../../utils/formatters";
import "./IngredientCard.scss";
const IngredientCard = ({
  ingredient,
  onEdit,
  onDelete,
  onAddStock,
  onShowUsage,
  getStockStatus,
}) => {
  const status = getStockStatus(ingredient);

  return (
    <Card
      className="ingredient-card"
      hoverable
      onClick={() => onShowUsage(ingredient.id)}
    >
      <div className="ingredient-header">
        <div className="ingredient-icon">{ingredient.icon}</div>
        <div className="ingredient-info">
          <h3 className="ingredient-name">{ingredient.name}</h3>
          <span className="ingredient-category">{ingredient.category}</span>
        </div>
        <span className={`status-badge ${status.class}`}>{status.text}</span>
      </div>

      <div className="ingredient-content">
        <div className="ingredient-stats">
          <div className="stat-item">
            <div className="stat-value">{ingredient.currentStock}</div>
            <div className="stat-label">Tồn kho ({ingredient.unit})</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {formatPrice(ingredient.costPrice)}
            </div>
            <div className="stat-label">Giá nhập/{ingredient.unit}</div>
          </div>
        </div>

        <div className="ingredient-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(ingredient.id);
            }}
          >
            ✏️ Sửa
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddStock(ingredient.id);
            }}
          >
            📦 Nhập kho
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onShowUsage(ingredient.id);
            }}
          >
            👁️ Xem món ăn
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(ingredient.id);
            }}
          >
            🗑️ Xóa
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default IngredientCard;
