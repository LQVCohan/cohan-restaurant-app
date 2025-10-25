// src/components/Dashboard_Manager/Storage/components/recipes/RecipeCard.jsx
import React, { useMemo } from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import { formatPrice } from "../../../../../utils/formatters";

/**
 * RecipeCard hiển thị thông tin công thức (Recipe)
 * BE fields dùng trực tiếp:
 * - id, name, description, category, icon
 * - servingVariants: [
 *     {
 *       key, mode, preparationMethodName,
 *       components: [{ ingredientId, qty, unit, ingredientName?, ingredient? }]
 *     }
 *   ]
 */
const RecipeCard = ({ recipe, onEdit, onDelete, onViewDetails }) => {
  // Tổng số nguyên liệu (unique theo ingredientId) từ tất cả servingVariants

  const totalIngredients = useMemo(() => {
    const sv = recipe?.servingVariants || [];
    const ids = new Set();
    sv.forEach((v) =>
      (v.components || []).forEach((c) => ids.add(String(c.ingredientId)))
    );
    return ids.size;
  }, [recipe]);

  // Số phương pháp = số servingVariants
  const totalVariants = recipe?.servingVariants?.length || 0;

  // Chi phí thấp nhất (nếu BE đã hydrate giá qua component.ingredient?.costPerBaseUnit)
  const minCost = useMemo(() => {
    const sv = recipe?.servingVariants || [];
    if (!sv.length) return 0;

    const costs = sv.map((v) =>
      (v.components || []).reduce((sum, c) => {
        const qty = Number(c.qty) || 0;
        const unitCost =
          (c.ingredient && Number(c.ingredient.costPerBaseUnit)) || 0;
        return sum + qty * unitCost;
      }, 0)
    );

    return costs.length ? Math.min(...costs) : 0;
  }, [recipe]);

  return (
    <Card className="recipe-card" hover onClick={() => onEdit?.(recipe.id)}>
      <div className="recipe-header">
        <div className="recipe-icon">{recipe?.icon || "🍽️"}</div>
        <div className="recipe-info">
          <h3 className="recipe-name">{recipe?.name || "Không có tên"}</h3>
          {recipe?.category ? (
            <span className="recipe-category">{recipe.category}</span>
          ) : null}
        </div>
      </div>

      <div className="recipe-content">
        <p className="recipe-description">
          {recipe?.description || "Chưa có mô tả cho công thức này."}
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
              {minCost > 0 ? formatPrice(minCost) : "—"}
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
                onEdit(recipe.id);
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
                onViewDetails(recipe.id);
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
                onDelete(recipe.id);
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
