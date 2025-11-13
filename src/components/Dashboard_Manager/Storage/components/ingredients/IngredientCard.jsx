// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCard.jsx
import React, { useState } from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import Modal, { ModalFooter } from "../../../../common/Modal";
import { formatPrice } from "../../../../../utils/formatters";
import "./IngredientCard.scss";

const IngredientCard = ({
  ingredient,
  onEdit,
  onDelete,
  onAddStock,
  onShowUsage,
  getStockStatus,
  onUpdateCostPrice, // optional: callback lưu giá nhập
}) => {
  const status = getStockStatus(ingredient);

  // ==== state cho modal giá nhập ====
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceInput, setPriceInput] = useState(ingredient?.costPrice ?? "");
  const [unitInput, setUnitInput] = useState(ingredient?.unit ?? "");
  const [currency, setCurrency] = useState("vnd"); // mặc định VND

  const openPriceModal = (e) => {
    e?.stopPropagation();
    setPriceInput(ingredient?.costPrice ?? "");
    setUnitInput(ingredient?.unit ?? "");
    setCurrency("vnd");
    setIsPriceModalOpen(true);
  };

  const handleSavePrice = () => {
    const numericPrice = parseFloat(priceInput);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      // có thể dùng toast/thông báo nếu bạn muốn
      return;
    }

    // Ưu tiên callback chuyên cho giá nhập, fallback qua onEdit nếu chưa truyền
    if (onUpdateCostPrice) {
      onUpdateCostPrice(ingredient.id, {
        costPrice: numericPrice,
        unit: unitInput || ingredient.unit,
        currency,
      });
    } else if (onEdit) {
      onEdit({
        ...ingredient,
        costPrice: numericPrice,
        unit: unitInput || ingredient.unit,
        currency,
      });
    }

    setIsPriceModalOpen(false);
  };

  return (
    <>
      <Card
        className="ingredient-card"
        hover
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

            {/* Ô giá nhập – click để mở modal */}
            <div
              className="stat-item stat-item--clickable"
              onClick={openPriceModal}
            >
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
              className="ingredient-btn ingredient-btn--edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(ingredient);
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
                onAddStock(ingredient.id);
              }}
            >
              📦 Nhập kho
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ingredient-btn ingredient-btn--usage"
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
              className="ingredient-btn ingredient-btn--delete"
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

      {/* Modal cập nhật giá nhập */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title={`Cập nhật giá nhập - ${ingredient.name}`}
        size="sm"
      >
        <div className="ingredient-price-modal">
          <div className="form-row">
            <label>Giá nhập</label>
            <div className="price-input-group">
              <input
                type="number"
                min="0"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="Nhập giá"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="vnd">VND</option>
                <option value="usd">USD</option>
                <option value="eur">EUR</option>
              </select>
            </div>
            <p className="helper-text">
              Đơn giá áp dụng cho mỗi đơn vị bên dưới.
            </p>
          </div>

          <div className="form-row">
            <label>Đơn vị</label>
            <input
              type="text"
              value={unitInput}
              onChange={(e) => setUnitInput(e.target.value)}
              placeholder={ingredient.unit || "vd: kg, ml, g…"}
            />
          </div>

          <ModalFooter>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setIsPriceModalOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSavePrice}
            >
              Lưu
            </button>
          </ModalFooter>
        </div>
      </Modal>
    </>
  );
};

export default IngredientCard;
