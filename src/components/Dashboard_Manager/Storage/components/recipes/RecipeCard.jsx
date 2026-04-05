// src/components/Dashboard_Manager/Storage/components/recipes/RecipeCard.jsx
import React from "react";
import {
  Edit,
  Eye,
  Trash2,
  ChefHat,
  Layers,
  DollarSign,
  UtensilsCrossed,
} from "lucide-react";
import { formatPrice } from "../../../../../utils/formatters";
import { convertCurrencyAmount, normalizeCurrency } from "../../../../../utils/currency";
import "./RecipeCard.scss";

const RecipeCard = ({
  recipe,
  onEdit,
  onDelete,
  onViewDetails,
  currency = "VND",
  usdToVndRate = 26000,
}) => {
  const activeCurrency = normalizeCurrency(currency, "VND");
  const safeRecipe = recipe || {};

  // Tận dụng _meta được truyền từ RecipeList để tối ưu hiệu năng
  // Nếu không có _meta (trường hợp dùng lẻ), fallback về giá trị mặc định
  const {
    hasRecipe = false,
    hasMissingCost = false,
    totalIngredients = 0,
    totalVariants = 0,
    minCost = 0,
    hasAnyCost = false,
  } = safeRecipe._meta || {};

  const handleCardClick = () => {
    // Ngăn chặn click nếu user đang bôi đen văn bản (optional UX)
    if (window.getSelection().toString()) return;
    if (onEdit && safeRecipe.id) onEdit(safeRecipe.id);
  };

  const handleAction = (e, actionCallback) => {
    e.stopPropagation();
    if (actionCallback && safeRecipe.id) actionCallback(safeRecipe.id);
  };

  return (
    <div className="rc-card" onClick={handleCardClick}>
      {/* 1. Header: Icon & Title */}
      <div className="rc-header">
        <div className="rc-icon-box">
          {/* Nếu có icon từ BE thì hiển thị, nếu không dùng icon mặc định */}
          {safeRecipe.icon ? (
            <span className="rc-emoji-icon">{safeRecipe.icon}</span>
          ) : (
            <UtensilsCrossed size={24} strokeWidth={1.5} />
          )}
        </div>
        <div className="rc-title-area">
          <h3 className="rc-name" title={safeRecipe.name}>
            {safeRecipe.name || "Chưa đặt tên"}
          </h3>
          <span className="rc-category">
            {safeRecipe.category
              ? safeRecipe.category.charAt(0).toUpperCase() +
                safeRecipe.category.slice(1)
              : "Chưa phân loại"}
          </span>
          <div style={{ marginTop: "6px", display: "flex", gap: "6px" }}>
            {!hasRecipe && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#eef2ff",
                  color: "#4338ca",
                  fontWeight: 700,
                }}
              >
                Chưa có recipe
              </span>
            )}
            {hasMissingCost && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#fff7ed",
                  color: "#c2410c",
                  fontWeight: 700,
                }}
              >
                Thiếu cost
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Stats Grid (Metrics) */}
      <div className="rc-stats">
        <div className="rc-stat-item" title="Số lượng nguyên liệu">
          <ChefHat size={16} className="rc-stat-icon" />
          <span className="rc-stat-value">{totalIngredients}</span>
          <span className="rc-stat-label">Nguyên liệu</span>
        </div>

        <div className="rc-stat-item" title="Số biến thể/Size">
          <Layers size={16} className="rc-stat-icon" />
          <span className="rc-stat-value">{totalVariants}</span>
          <span className="rc-stat-label">Variants</span>
        </div>

        <div className="rc-stat-item is-cost" title="Giá vốn thấp nhất">
          <DollarSign size={16} className="rc-stat-icon" />
          <span className="rc-stat-value">
            {hasAnyCost
              ? formatPrice(
                  convertCurrencyAmount(
                    minCost,
                    "VND",
                    activeCurrency,
                    usdToVndRate,
                  ),
                  { currency: activeCurrency },
                )
              : "—"}
          </span>
          <span className="rc-stat-label">Min Cost</span>
        </div>
      </div>

      {/* 3. Description (Short) */}
      <div className="rc-body">
        <p className="rc-desc">
          {safeRecipe.description || "Chưa có mô tả chi tiết cho món này."}
        </p>
      </div>

      {/* 4. Footer Actions */}
      <div className="rc-actions">
        {onViewDetails && (
          <button
            className="rc-btn rc-btn-view"
            onClick={(e) => handleAction(e, onViewDetails)}
            title="Xem chi tiết"
          >
            <Eye size={16} />
            <span>Chi tiết</span>
          </button>
        )}

        <div className="rc-actions-group">
          {onEdit && (
            <button
              className="rc-icon-btn rc-btn-edit"
              onClick={(e) => handleAction(e, onEdit)}
              title="Chỉnh sửa"
            >
              <Edit size={16} />
            </button>
          )}

          {onDelete && (
            <button
              className="rc-icon-btn rc-btn-delete"
              onClick={(e) => handleAction(e, onDelete)}
              title="Xóa món"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeCard;
