import React from "react";
import Modal from "../../../../common/Modal";
import Card from "../../../../common/Card";
import { useIngredients } from "../../../../../hooks/useIngredients";
import { formatPrice } from "../../../../../utils/formatters";

/**
 * recipe: {
 *   servingVariants: [
 *     { key, preparationMethodName, components: [{ ingredientId, qty, unit, ingredientName? }] }
 *   ]
 * }
 */
const RecipeDetailModal = ({ isOpen, onClose, recipe, ingredients }) => {
  // const { ingredients } = useIngredients();
  if (!recipe) return null;

  const findIngredient = (ingredientId) =>
    ingredients.find((i) => String(i.id) === String(ingredientId));

  const getIngredientName = (comp) =>
    comp.ingredientName ||
    findIngredient(comp.ingredientId)?.name ||
    "Nguyên liệu không tồn tại";

  const getIngredientCost = (comp) =>
    Number(findIngredient(comp.ingredientId)?.costPerBaseUnit ?? 0);

  const calcItemCost = (comp) =>
    (Number(comp.qty) || 0) * getIngredientCost(comp);

  const calcVariantCost = (variant) =>
    (variant?.components || []).reduce((sum, c) => sum + calcItemCost(c), 0);

  const variants = recipe.servingVariants || [];
  const minCost = variants.length
    ? Math.min(...variants.map(calcVariantCost))
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🍽️ ${recipe.name || ""}`}
      size="lg"
    >
      <div className="recipe-detail">
        {/* Variants */}
        <div className="methods-section">
          <h3>👨‍🍳 Phương pháp chế biến</h3>

          {variants.map((v, idx) => (
            <Card key={v.key || idx} className="method-card">
              <div className="method-header">
                <h4>{v.preparationMethodName || v.key}</h4>
                <div className="method-cost">
                  Chi phí: {formatPrice(calcVariantCost(v))}
                </div>
              </div>

              <div className="method-ingredients">
                <h5>Nguyên liệu cần thiết:</h5>
                <div className="ingredients-list">
                  {(v.components || []).map((c, i) => (
                    <div key={i} className="ingredient-item">
                      <div className="ingredient-info">
                        <span className="ingredient-name">
                          {getIngredientName(c)}
                        </span>
                        <span className="ingredient-amount">
                          {(Number(c.qty) || 0).toLocaleString("vi-VN", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          {c.unit ||
                            findIngredient(c.ingredientId)?.baseUnit ||
                            ""}
                        </span>
                      </div>
                      <div className="ingredient-cost">
                        {formatPrice(calcItemCost(c))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}

          {!variants.length && (
            <Card className="method-card">Chưa cấu hình phương pháp.</Card>
          )}
        </div>

        {/* Summary */}
        <Card className="cost-summary">
          <h3>💰 Tổng kết chi phí</h3>
          <div className="cost-breakdown">
            {variants.map((v, idx) => (
              <div key={v.key || idx} className="cost-item">
                <span>{v.preparationMethodName || v.key}:</span>
                <span>{formatPrice(calcVariantCost(v))}</span>
              </div>
            ))}
          </div>
          <div className="total-cost">
            <strong>Chi phí thấp nhất: {formatPrice(minCost)}</strong>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default RecipeDetailModal;
