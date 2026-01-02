// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCard.jsx
import React, { useMemo, useState } from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import Modal, { ModalFooter } from "../../../../common/Modal";
import { formatPrice } from "../../../../../utils/formatters";
import "./IngredientCard.scss";

const IngredientCard = ({
  ingredient,
  stockQty = 0, // ✅ tồn từ stockItems (đã filter theo warehouseId ở query cha)
  onEdit,
  onDelete,
  onAddStock,
  onShowUsage,
  getStockStatus,

  // ✅ callback chuẩn: cập nhật costPerBaseUnit
  onUpdateCostPerBaseUnit,
}) => {
  const baseUnit = ingredient.baseUnit || ingredient.unit || "";
  const statusObj = getStockStatus ? getStockStatus(ingredient) : null;

  const status = useMemo(() => {
    if (statusObj?.text) return statusObj;
    // fallback nếu truyền sai
    return { text: "—", class: "status--in" };
  }, [statusObj]);

  // ====== Modal giá nhập ======
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceInput, setPriceInput] = useState(
    ingredient?.costPerBaseUnit ?? ""
  );

  const openPriceModal = (e) => {
    e?.stopPropagation();
    setPriceInput(ingredient?.costPerBaseUnit ?? "");
    setIsPriceModalOpen(true);
  };

  const handleSavePrice = async () => {
    const numericPrice = Number(priceInput);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) return;

    if (onUpdateCostPerBaseUnit) {
      await onUpdateCostPerBaseUnit(ingredient.id, {
        costPerBaseUnit: numericPrice,
      });
    } else if (onEdit) {
      // fallback: mở edit với dữ liệu đã đổi (nếu bạn muốn xử lý trong modal edit chính)
      onEdit({ ...ingredient, costPerBaseUnit: numericPrice });
    }

    setIsPriceModalOpen(false);
  };

  return (
    <>
      <Card
        className="ingredient-card"
        hover
        onClick={() => onShowUsage?.(ingredient.id)}
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
              <div className="stat-value">{stockQty}</div>
              <div className="stat-label">Tồn ({baseUnit})</div>
            </div>

            <div
              className="stat-item stat-item--clickable"
              onClick={openPriceModal}
            >
              <div className="stat-value">
                {formatPrice(ingredient.costPerBaseUnit)}
              </div>
              <div className="stat-label">Giá nhập/{baseUnit}</div>
            </div>
          </div>

          <div className="ingredient-actions">
            <Button
              variant="primary"
              size="sm"
              className="ingredient-btn ingredient-btn--edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(ingredient);
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
                onAddStock?.(ingredient.id);
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
                onShowUsage?.(ingredient.id);
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
                onDelete?.(ingredient.id);
              }}
            >
              🗑️ Xóa
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title={`Cập nhật giá nhập - ${ingredient.name}`}
        size="sm"
      >
        <div className="ingredient-price-modal">
          <div className="form-row">
            <label>Giá nhập / {baseUnit}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="Nhập giá"
            />
            <p className="helper-text">
              Giá này là <b>costPerBaseUnit</b> theo đơn vị gốc.
            </p>
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
