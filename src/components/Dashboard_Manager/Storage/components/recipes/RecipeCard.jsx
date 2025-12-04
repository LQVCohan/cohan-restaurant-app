// src/components/Dashboard_Manager/Storage/components/recipes/RecipeCard.jsx
import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import { formatPrice } from "../../../../../utils/formatters";

const RecipeCard = ({ recipe, onEdit, onDelete, onViewDetails }) => {
  const safeRecipe = recipe || {};
  const variants = Array.isArray(safeRecipe.servingVariants)
    ? safeRecipe.servingVariants
    : [];

  const getComponents = (variant) => {
    if (!variant) return [];
    if (Array.isArray(variant.Ingredients)) return variant.Ingredients;
    if (Array.isArray(variant.ingredients)) return variant.ingredients;
    return [];
  };

  // Đếm số nguyên liệu UNIQUE theo ingredientId
  const calcTotalIngredients = () => {
    const ids = new Set();
    variants.forEach((v) => {
      const comps = getComponents(v);
      comps.forEach((c) => {
        if (c && c.ingredientId) {
          ids.add(String(c.ingredientId));
        }
      });
    });
    return ids.size;
  };

  const totalIngredients = calcTotalIngredients();
  const totalVariants = variants.length;

  // Tính chi phí thấp nhất giữa các phương pháp
  const calcMinCost = () => {
    if (!variants.length) return { minCost: 0, hasAnyCost: false };

    const costs = variants.map((v) => {
      const comps = getComponents(v);
      return comps.reduce((sum, c) => {
        const qty = Number(c?.quantify) || 0;
        const unitCost = Number(c?.costPerBaseUnit);
        if (!Number.isFinite(unitCost) || unitCost <= 0) return sum;
        return sum + qty * unitCost;
      }, 0);
    });

    const filtered = costs.filter((v) => Number.isFinite(v) && v > 0);
    if (!filtered.length) return { minCost: 0, hasAnyCost: false };

    return { minCost: Math.min(...filtered), hasAnyCost: true };
  };

  const { minCost, hasAnyCost } = calcMinCost();

  const handleCardClick = () => {
    if (onEdit && safeRecipe.id) onEdit(safeRecipe.id);
  };

  return (
    <Card className="recipe-card" hover onClick={handleCardClick}>
      <div className="recipe-header">
        <div className="recipe-icon">{safeRecipe.icon || "🍽️"}</div>
        <div className="recipe-info">
          <h3 className="recipe-name">{safeRecipe.name || "Không có tên"}</h3>
          {safeRecipe.category && (
            <span className="recipe-category">{safeRecipe.category}</span>
          )}
        </div>
      </div>

      <div className="recipe-content">
        <p className="recipe-description">
          {safeRecipe.description || "Chưa có mô tả cho công thức này."}
        </p>

        <div className="recipe-stats">
          <div className="stat-item">
            <div className="stat-value">{totalIngredients}</div>
            <div className="stat-label">Nguyên liệu</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{totalVariants}</div>
            <div className="stat-label">Phương pháp</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {hasAnyCost ? formatPrice(minCost) : "—"}
            </div>
            <div className="stat-label">Chi phí thấp nhất</div>
          </div>
        </div>

        <div className="recipe-actions">
          {onEdit && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (safeRecipe.id) onEdit(safeRecipe.id);
              }}
            >
              ✏️ Sửa
            </Button>
          )}

          {onViewDetails && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (safeRecipe.id) onViewDetails(safeRecipe.id);
              }}
            >
              👁️ Xem chi tiết
            </Button>
          )}

          {onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (safeRecipe.id) onDelete(safeRecipe.id);
              }}
            >
              🗑️ Xóa
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default RecipeCard;
