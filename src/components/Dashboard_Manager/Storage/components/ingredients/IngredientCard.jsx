// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCard.jsx
import React, { useContext, useEffect, useMemo, useState } from "react";
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
import { AuthContext } from "../../../../../context/AuthContext";
import { formatPrice } from "../../../../../utils/formatters";
import { convertCurrencyAmount, normalizeCurrency } from "../../../../../utils/currency";
import { toIngredientCategoryVi } from "../../../../../utils/ingredientCategoryI18n";
import {
  hasPermission,
  NO_PERMISSION_MESSAGE,
} from "../../../../../utils/frontendPermissionAccess";
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
  currency = "VND",
  usdToVndRate = 26000,
}) => {
  const { user } = useContext(AuthContext);
  const canWriteInventory = hasPermission(user, "inventory.write");
  const canWriteStock = hasPermission(user, "stock.write");
  const baseUnit = ingredient.baseUnit || ingredient.unit || "";
  const ingredientName = ingredient.name || "nguyên liệu";
  const statusObj = getStockStatus ? getStockStatus(ingredient) : null;

  const status = useMemo(() => {
    if (statusObj?.text) return statusObj;
    return { text: "—", class: "status-unknown" };
  }, [statusObj]);

  const canEdit = canWriteInventory && typeof onEdit === "function";
  const canAddStock = canWriteStock && typeof onAddStock === "function";
  const canShowUsage = typeof onShowUsage === "function";
  const canDelete = canWriteInventory && typeof onDelete === "function";
  const canUpdateCost =
    canWriteInventory &&
    (typeof onUpdateCostPerBaseUnit === "function" || typeof onEdit === "function");

  // --- Price Modal State ---
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const activeCurrency = normalizeCurrency(currency, "VND");
  const [priceInput, setPriceInput] = useState("");

  const openPriceModal = (e) => {
    e?.stopPropagation();
    if (!canUpdateCost) return;
    setPriceInput(
      String(
        convertCurrencyAmount(
          ingredient?.costPerBaseUnit ?? 0,
          "VND",
          activeCurrency,
          usdToVndRate,
        ),
      ),
    );
    setIsPriceModalOpen(true);
  };

  useEffect(() => {
    if (!isPriceModalOpen) return;
    setPriceInput(
      String(
        convertCurrencyAmount(
          ingredient?.costPerBaseUnit ?? 0,
          "VND",
          activeCurrency,
          usdToVndRate,
        ),
      ),
    );
  }, [activeCurrency, ingredient?.costPerBaseUnit, isPriceModalOpen, usdToVndRate]);

  const handleSavePrice = async () => {
    if (!canUpdateCost) return;
    const numericPrice = Number(priceInput);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) return;
    const vndPrice = convertCurrencyAmount(
      numericPrice,
      activeCurrency,
      "VND",
      usdToVndRate,
    );

    if (onUpdateCostPerBaseUnit) {
      await onUpdateCostPerBaseUnit(ingredient.id, vndPrice);
    } else if (onEdit) {
      onEdit({ ...ingredient, costPerBaseUnit: vndPrice });
    }
    setIsPriceModalOpen(false);
  };

  return (
    <>
      <article className="il-card">
        {/* Header Section */}
        <div className="il-card__header">
          <div className="il-card__icon-wrapper" aria-hidden="true">
            {/* Fallback icon nếu ingredient.icon là emoji hoặc string không hợp lệ */}
            {typeof ingredient.icon === "string" &&
            ingredient.icon.length < 5 ? (
              <span className="il-card__emoji-icon">{ingredient.icon}</span>
            ) : (
              <Box size={24} color="#c5a47e" />
            )}
          </div>
          <div className="il-card__title-group">
            <h3 className="il-card__title" title={ingredient.name}>
              {ingredient.name}
            </h3>
            <div className="il-card__subtitle">
              <Tag size={12} aria-hidden="true" />
              <span>{toIngredientCategoryVi(ingredient.category)}</span>
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

            <div className="il-stat-box">
              <span className="il-stat-label">Ngưỡng cảnh báo</span>
              <div className="il-stat-value-group">
                <span className="il-stat-value">{ingredient.minStock ?? 0}</span>
                <span className="il-stat-unit">{baseUnit}</span>
              </div>
            </div>

            {/* Cost Price (Clickable) */}
            <button
              type="button"
              className={`il-stat-box ${canUpdateCost ? "il-stat-box--interactive" : ""}`}
              onClick={openPriceModal}
              title={canUpdateCost ? "Nhấp để cập nhật giá nhập" : NO_PERMISSION_MESSAGE}
              aria-label={`Cập nhật giá nhập cho ${ingredientName}`}
              disabled={!canUpdateCost}
            >
              <div className="il-stat-label">
                Giá nhập{" "}
                {canUpdateCost && <Pencil size={10} className="il-stat-label__edit-icon" aria-hidden="true" />}
              </div>
              <div className="il-stat-value-group">
                <span className="il-stat-value il-text-price">
                  {formatPrice(
                    convertCurrencyAmount(
                      ingredient.costPerBaseUnit,
                      "VND",
                      activeCurrency,
                      usdToVndRate,
                    ),
                    { currency: activeCurrency },
                  )}
                </span>
                <span className="il-stat-unit">/{baseUnit}</span>
              </div>
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="il-card__actions">
            <button
              type="button"
              className="il-action-btn il-btn-edit"
              onClick={(e) => {
                e.stopPropagation();
                if (!canEdit) return;
                onEdit?.(ingredient);
              }}
              disabled={!canEdit}
              title={canEdit ? "Chỉnh sửa thông tin" : NO_PERMISSION_MESSAGE}
              aria-label={`Chỉnh sửa ${ingredientName}`}
            >
              <Pencil size={16} />
            </button>

            <button
              type="button"
              className="il-action-btn il-btn-stock"
              onClick={(e) => {
                e.stopPropagation();
                if (!canAddStock) return;
                onAddStock?.(ingredient.id);
              }}
              disabled={!canAddStock}
              title={canAddStock ? "Nhập thêm hàng" : NO_PERMISSION_MESSAGE}
              aria-label={`Nhập thêm hàng cho ${ingredientName}`}
            >
              <PackagePlus size={16} />
            </button>

            <button
              type="button"
              className="il-action-btn il-btn-view"
              onClick={(e) => {
                e.stopPropagation();
                if (!canShowUsage) return;
                onShowUsage?.(ingredient.id);
              }}
              disabled={!canShowUsage}
              title={canShowUsage ? "Xem món ăn sử dụng" : "Chưa có dữ liệu món ăn sử dụng nguyên liệu này"}
              aria-label={`Xem món ăn sử dụng ${ingredientName}`}
            >
              <Eye size={16} />
            </button>

            <div className="il-divider-vertical" aria-hidden="true"></div>

            <button
              type="button"
              className="il-action-btn il-btn-delete"
              onClick={(e) => {
                e.stopPropagation();
                if (!canDelete) return;
                onDelete?.(ingredient.id);
              }}
              disabled={!canDelete}
              title={canDelete ? "Xóa nguyên liệu" : NO_PERMISSION_MESSAGE}
              aria-label={`Xóa ${ingredientName}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </article>

      {/* Price Update Modal */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        title="Cập nhật giá vốn"
        size="sm"
      >
        <div className="il-modal-content">
          <div className="il-form-group">
            <label className="il-label" htmlFor={`ingredient-price-${ingredient.id}`}>
              Giá nhập mới ({activeCurrency}) / {baseUnit}
            </label>
            <div className="il-input-wrapper">
              <DollarSign size={16} className="il-input-icon" aria-hidden="true" />
              <input
                id={`ingredient-price-${ingredient.id}`}
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
              type="button"
              className="il-btn-secondary"
              onClick={() => setIsPriceModalOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="il-btn-primary"
              onClick={handleSavePrice}
              disabled={!canUpdateCost}
              title={canUpdateCost ? "Lưu giá" : NO_PERMISSION_MESSAGE}
            >
              Lưu giá
            </button>
          </Modal.Footer>
        </div>
      </Modal>
    </>
  );
};

export default IngredientCard;
