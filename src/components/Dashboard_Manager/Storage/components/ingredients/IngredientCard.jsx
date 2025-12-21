import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import { formatPrice } from "../../../../../utils/formatters";
import "./IngredientCard.scss";

const safeNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const IngredientCard = ({
  ingredient,
  onEdit,
  onDelete,
  onAddStock,
  onShowUsage,
  getStockStatus,
}) => {
  const status = getStockStatus?.(ingredient) || {
    text: "—",
    className: "unknown",
  };

  const baseUnit = ingredient?.baseUnit || "unit";
  const costPerBaseUnit = safeNumber(ingredient?.costPerBaseUnit);

  const available = ingredient?._stock?.available;
  const onHand = ingredient?._stock?.onHand;
  const reserved = ingredient?._stock?.reserved;

  const showStock = available != null; // chỉ show khi đã có stockItems join

  return (
    <Card className="ingredient-card" hover>
      <div className="ingredient-header">
        <div className="ingredient-info">
          <h3 className="ingredient-name">{ingredient?.name || "—"}</h3>
          <div className="ingredient-meta">
            {ingredient?.category ? (
              <span className="ingredient-category">{ingredient.category}</span>
            ) : (
              <span className="ingredient-category ingredient-category--muted">
                Chưa phân loại
              </span>
            )}
            {ingredient?.sku ? (
              <span className="ingredient-sku">SKU: {ingredient.sku}</span>
            ) : null}
          </div>
        </div>

        <span className={`status-badge ${status.className}`}>
          {status.text}
        </span>
      </div>

      <div className="ingredient-content">
        <div className="ingredient-stats">
          <div className="stat-item">
            <div className="stat-value">
              {showStock ? safeNumber(available) : "—"}
            </div>
            <div className="stat-label">Khả dụng ({baseUnit})</div>
          </div>

          <div className="stat-item">
            <div className="stat-value">{formatPrice(costPerBaseUnit)}</div>
            <div className="stat-label">Giá / {baseUnit}</div>
          </div>

          {showStock ? (
            <div className="stat-item stat-item--sub">
              <div className="stat-subrow">
                <span className="stat-subkey">Tồn:</span>
                <span className="stat-subval">{safeNumber(onHand)}</span>
              </div>
              <div className="stat-subrow">
                <span className="stat-subkey">Giữ:</span>
                <span className="stat-subval">{safeNumber(reserved)}</span>
              </div>
            </div>
          ) : (
            <div className="stat-item stat-item--sub">
              <div className="stat-subrow">
                <span className="stat-subkey">Tồn:</span>
                <span className="stat-subval">—</span>
              </div>
              <div className="stat-subrow">
                <span className="stat-subkey">Giữ:</span>
                <span className="stat-subval">—</span>
              </div>
            </div>
          )}
        </div>

        <div className="ingredient-actions">
          <Button
            variant="primary"
            size="sm"
            className="ingredient-btn ingredient-btn--edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
          >
            ✏️ Sửa
          </Button>

          <Button
            variant="success"
            size="sm"
            className="ingredient-btn ingredient-btn--stock"
            onClick={(e) => {
              e.stopPropagation();
              onAddStock?.();
            }}
            title="Nhập kho theo baseUnit của nguyên liệu"
          >
            📦 Nhập kho
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="ingredient-btn ingredient-btn--usage"
            onClick={(e) => {
              e.stopPropagation();
              onShowUsage?.();
            }}
          >
            👁️ Xem món ăn
          </Button>

          <Button
            variant="danger"
            size="sm"
            className="ingredient-btn ingredient-btn--delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
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
