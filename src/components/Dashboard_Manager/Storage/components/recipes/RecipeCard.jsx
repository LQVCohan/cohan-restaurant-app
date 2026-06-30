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

const MENU_ITEM_STATUS_META = {
  available: { label: "Có sẵn", bg: "#dcfce7", color: "#166534" },
  unavailable: { label: "Tạm ngưng", bg: "#fee2e2", color: "#b91c1c" },
  out_of_stock: { label: "Hết món", bg: "#ffedd5", color: "#c2410c" },
  hidden: { label: "Ẩn", bg: "#e2e8f0", color: "#334155" },
};

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
  const recipeName = safeRecipe.name || "Chưa đặt tên";

  // Tận dụng _meta được truyền từ RecipeList để tối ưu hiệu năng
  // Nếu không có _meta (trường hợp dùng lẻ), fallback về giá trị mặc định
  const {
    hasRecipe = false,
    hasMissingCost = false,
    hasMissingIngredient = false,
    hasNoReplacementIngredient = false,
    estimatedCostValid = true,
    missingIngredientCount = 0,
    totalIngredients = 0,
    totalVariants = 0,
    minCost = 0,
    hasAnyCost = false,
  } = safeRecipe._meta || {};

  const statusMeta = MENU_ITEM_STATUS_META[safeRecipe.status] || {
    label: "Không rõ",
    bg: "#e2e8f0",
    color: "#334155",
  };

  const handleCardClick = () => {
    // Ngăn chặn click nếu user đang bôi đen văn bản (optional UX)
    if (window.getSelection().toString()) return;
    if (onEdit && safeRecipe.id) onEdit(safeRecipe.id);
  };

  const handleCardKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleCardClick();
  };

  const handleAction = (e, actionCallback) => {
    e.stopPropagation();
    if (actionCallback && safeRecipe.id) actionCallback(safeRecipe.id);
  };

  return (
    <div
      className="rc-card"
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Mở chỉnh sửa công thức ${recipeName}`}
    >
      {/* 1. Header: Icon & Title */}
      <div className="rc-header">
        <div className="rc-icon-box" aria-hidden="true">
          {/* Nếu có icon từ BE thì hiển thị, nếu không dùng icon mặc định */}
          {safeRecipe.icon ? (
            <span className="rc-emoji-icon">{safeRecipe.icon}</span>
          ) : (
            <UtensilsCrossed size={24} strokeWidth={1.5} />
          )}
        </div>
        <div className="rc-title-area">
          <h3 className="rc-name" title={safeRecipe.name}>
            {recipeName}
          </h3>
          <span className="rc-category">
            {safeRecipe.category
              ? safeRecipe.category.charAt(0).toUpperCase() +
                safeRecipe.category.slice(1)
              : "Chưa phân loại"}
          </span>
          <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "999px",
                background: statusMeta.bg,
                color: statusMeta.color,
                fontWeight: 700,
              }}
            >
              {statusMeta.label}
            </span>
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
            {hasMissingIngredient && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#fff1f2",
                  color: "#be123c",
                  fontWeight: 700,
                }}
                title="Công thức đang tham chiếu nguyên liệu đã bị xóa hoặc không còn tồn tại."
              >
                {`Thiếu NL (${missingIngredientCount})`}
              </span>
            )}
            {hasNoReplacementIngredient && (
              <span
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#ffedd5",
                  color: "#9a3412",
                  fontWeight: 700,
                }}
                title="Công thức đang có dòng chưa có nguyên liệu bù, không thể tin cậy chi phí ước tính."
              >
                Chưa có nguyên liệu bù
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
            {estimatedCostValid
              ? hasAnyCost
              ? formatPrice(
                  convertCurrencyAmount(
                    minCost,
                    "VND",
                    activeCurrency,
                    usdToVndRate,
                  ),
                  { currency: activeCurrency },
                )
              : "—"
              : "N/A"}
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
            type="button"
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
              type="button"
              className="rc-icon-btn rc-btn-edit"
              onClick={(e) => handleAction(e, onEdit)}
              title="Chỉnh sửa"
              aria-label={`Chỉnh sửa công thức ${recipeName}`}
            >
              <Edit size={16} />
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              className="rc-icon-btn rc-btn-delete"
              onClick={(e) => handleAction(e, onDelete)}
              title="Xóa món"
              aria-label={`Xóa công thức ${recipeName}`}
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
