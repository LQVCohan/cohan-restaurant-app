import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import { formatPrice } from "../../../../../utils/formatters";

const SupplyCard = ({
  supply,
  onEdit,
  onDelete,
  onAddStock,
  getStockStatus,
}) => {
  const status = getStockStatus(supply);

  return (
    <Card className="supply-card" hoverable onClick={() => onEdit(supply.id)}>
      <div className="supply-header">
        <div className="supply-icon">{supply.icon}</div>
        <div className="supply-info">
          <h3 className="supply-name">{supply.name}</h3>
          <span className="supply-category">{supply.category}</span>
        </div>
        <span className={`status-badge ${status.class}`}>{status.text}</span>
      </div>

      <div className="supply-content">
        <div className="supply-stats">
          <div className="stat-item">
            <div className="stat-value">{supply.currentStock}</div>
            <div className="stat-label">Tồn kho ({supply.unit})</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{formatPrice(supply.costPrice)}</div>
            <div className="stat-label">Giá nhập/{supply.unit}</div>
          </div>
        </div>

        <div className="supply-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(supply.id);
            }}
          >
            ✏️ Sửa
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAddStock(supply.id);
            }}
          >
            📦 Nhập kho
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(supply.id);
            }}
          >
            🗑️ Xóa
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default SupplyCard;
