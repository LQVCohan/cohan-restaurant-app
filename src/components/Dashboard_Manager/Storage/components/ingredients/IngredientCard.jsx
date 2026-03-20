// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCard.jsx
import React, { useMemo, useState } from "react";
import {
  Pencil,
  PackagePlus,
  Eye,
  Trash2,
  DollarSign,
  Box,
  Tag,
} from "lucide-react";

import Modal from "../../../../common/Modal";
import { formatPrice } from "../../../../../utils/formatters";
import "./IngredientCard.scss";

const IngredientCard = ({
  ingredient,
  stockQty = 0,
  onEdit,
  onDelete,
  onAddStock,
  onShowUsage,
  getStockStatus,
  onUpdateCostPerBaseUnit,
}) => {
  const baseUnit = ingredient.baseUnit || ingredient.unit || "";
  const statusObj = getStockStatus ? getStockStatus(ingredient) : null;

  const status = useMemo(() => {
    if (statusObj?.text) return statusObj;
    return { text: "—", class: "status-unknown" };
  }, [statusObj]);

  const canEdit = typeof onEdit === "function";
  const canAddStock = typeof onAddStock === "function";
  const canShowUsage = typeof onShowUsage === "function";
  const canDelete = typeof onDelete === "function";

  // --- Price Modal State ---
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
      await onUpdateCostPerBaseUnit(ingredient.id, numericPrice);
    } else if (onEdit) {
      onEdit({ ...ingredient, costPerBaseUnit: numericPrice });
    }
    setIsPriceModalOpen(false);
  };

  return (
    <>
      <div className="il-card" onClick={() => onShowUsage?.(ingredient.id)}>
        {/* Header Section */}
        <div className="il-card__header">
          <div className="il-card__icon-wrapper">
            {/* Fallback icon nếu ingredient.icon là emoji hoặc string không hợp lệ */}
            {typeof ingredient.icon === "string" &&
            ingredient.icon.length < 5 ? (
              <span style={{ fontSize: "1.5rem" }}>{ingredient.icon}</span>
            ) : (
              <Box size={24} color="#c5a47e" />
            )}
          </div>
          <div className="il-card__title-group">
            <h3 className="il-card__title" title={ingredient.name}>
              {ingredient.name}
            </h3>
            <div className="il-card__subtitle">
              <Tag size={12} />
              <span>{ingredient.category}</span>
            </div>
          </div>
          <span className={`il-status-badge ${status.class}`}>
            {status.text}
          </span>
        </div>

        {/* Content Stats */}
        <div className="il-card__body">
          <div className="il-stats-grid">
            {/* Stock Quantity */}
            <div className="il-stat-box">
              <span className="il-stat-label">Tồn kho</span>
              <div className="il-stat-value-group">
                <span className="il-stat-value">{ingredient.availableStock ?? stockQty}</span>
                <span className="il-stat-unit">{baseUnit}</span>
              </div>
            </div>

            {/* Cost Price (Clickable) */}
            <div
              className="il-stat-box il-stat-box--interactive"
              onClick={openPriceModal}
              title="Nhấp để cập nhật giá nhập"
            >
              <div className="il-stat-label">
                Giá nhập{" "}
                <Pencil size={10} style={{ marginLeft: 4, opacity: 0.5 }} />
              </div>
              <div className="il-stat-value-group">
                <span className="il-stat-value il-text-price">
                  {formatPrice(ingredient.costPerBaseUnit)}
                </span>
                <span className="il-stat-unit">/{baseUnit}</span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="il-card__actions">
            <button
              className="il-action-btn il-btn-edit"
              onClick={(e) => {
                e.stopPropagation();
                if (!canEdit) return;
                onEdit?.(ingredient);
              }}
              disabled={!canEdit}
              title={canEdit ? "Chỉnh sửa thông tin" : "Tính năng chưa khả dụng"}
            >
              <Pencil size={16} />
            </button>

            <button
              className="il-action-btn il-btn-stock"
              onClick={(e) => {
                e.stopPropagation();
                if (!canAddStock) return;
                onAddStock?.(ingredient.id);
              }}
              disabled={!canAddStock}
              title={canAddStock ? "Nhập thêm hàng" : "Tính năng chưa khả dụng"}
            >
              <PackagePlus size={16} />
            </button>

            <button
              className="il-action-btn il-btn-view"
              onClick={(e) => {
                e.stopPropagation();
                if (!canShowUsage) return;
                onShowUsage?.(ingredient.id);
              }}
              disabled={!canShowUsage}
              title={canShowUsage ? "Xem món ăn sử dụng" : "Tính năng đang phát triển"}
            >
              <Eye size={16} />
            </button>

            <div className="il-divider-vertical"></div>

            <button
              className="il-action-btn il-btn-delete"
              onClick={(e) => {
                e.stopPropagation();
                if (!canDelete) return;
                onDelete?.(ingredient.id);
              }}
              disabled={!canDelete}
              title={canDelete ? "Xóa nguyên liệu" : "Tính năng chưa khả dụng"}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Price Update Modal */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title="Cập nhật giá vốn"
        size="sm"
      >
        <div className="il-modal-content">
          <div className="il-form-group">
            <label className="il-label">Giá nhập mới (VND) / {baseUnit}</label>
            <div className="il-input-wrapper">
              <DollarSign size={16} className="il-input-icon" />
              <input
                type="number"
                className="il-input"
                min="0"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="0"
              />
            </div>
            <p className="il-hint">Giá này sẽ dùng để tính lợi nhuận món ăn.</p>
          </div>

          <Modal.Footer>
            <button
              className="il-btn-secondary"
              onClick={() => setIsPriceModalOpen(false)}
            >
              Hủy
            </button>
            <button className="il-btn-primary" onClick={handleSavePrice}>
              Lưu giá
            </button>
          </Modal.Footer>
        </div>
      </Modal>
    </>
  );
};

export default IngredientCard;
