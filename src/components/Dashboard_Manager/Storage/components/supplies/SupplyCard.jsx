import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import "./SupplyCard.scss";

const SupplyCard = ({ supply, onEdit, onDelete, onToggleActive }) => {
  const {
    name,
    category,
    unit,
    costPerUnit,
    pricePerUnit,
    minStock,
    isActive,
    updatedAt,
  } = supply;

  const statusClass = isActive ? "active" : "inactive";
  const statusText = isActive ? "Đang dùng" : "Ngừng";

  return (
    <Card className="supply-card">
      <div className="supply-header">
        <h3>{name}</h3>
        <span className={`badge ${statusClass}`}>{statusText}</span>
      </div>

      <div className="supply-body">
        <div className="info-row">
          <span className="label">Danh mục:</span>
          <span className="value">{category || "—"}</span>
        </div>

        <div className="info-row">
          <span className="label">Đơn vị:</span>
          <span className="value">{unit}</span>
        </div>

        <div className="info-row">
          <span className="label">Giá nhập:</span>
          <span className="value">
            {costPerUnit ? `${costPerUnit.toLocaleString()}đ/${unit}` : "—"}
          </span>
        </div>

        {pricePerUnit ? (
          <div className="info-row">
            <span className="label">Giá bán:</span>
            <span className="value">
              {pricePerUnit.toLocaleString()}đ/{unit}
            </span>
          </div>
        ) : null}

        <div className="info-row">
          <span className="label">Tồn tối thiểu:</span>
          <span className="value">{minStock ?? 0}</span>
        </div>

        <div className="info-row">
          <span className="label">Cập nhật:</span>
          <span className="value small">
            {new Date(updatedAt).toLocaleDateString("vi-VN")}
          </span>
        </div>
      </div>

      <div className="actions">
        <Button size="sm" onClick={onEdit}>
          ✏️ Sửa
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          🗑️ Xóa
        </Button>
        <Button
          size="sm"
          variant={isActive ? "secondary" : "success"}
          onClick={onToggleActive}
        >
          {isActive ? "🚫 Ngừng" : "✅ Kích hoạt"}
        </Button>
      </div>
    </Card>
  );
};

export default SupplyCard;
