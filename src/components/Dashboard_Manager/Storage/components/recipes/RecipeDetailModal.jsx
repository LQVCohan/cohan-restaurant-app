// src/components/Dashboard_Manager/Storage/components/recipes/RecipeDetailModal.jsx
import React from "react";
import Modal from "../../../../common/Modal";
import Card from "../../../../common/Card";
import { formatPrice } from "../../../../../utils/formatters";

const RecipeDetailModal = ({ isOpen, onClose, recipe }) => {
  if (!recipe) return null;

  const variants = recipe.servingVariants || [];

  const formatQty = (val) =>
    (Number(val) || 0).toLocaleString("vi-VN", {
      maximumFractionDigits: 2,
    });

  const calcItemCost = (comp) => {
    const qty = Number(comp?.quantify) || 0;
    const unitCost = Number(comp?.costPerBaseUnit) || 0;
    return qty * unitCost;
  };

  const calcVariantCost = (variant) =>
    (variant?.Ingredients || []).reduce((sum, c) => sum + calcItemCost(c), 0);

  const minCost = variants.length
    ? Math.min(...variants.map(calcVariantCost))
    : 0;

  const getVariantTitle = (v, idx) =>
    v.name || v.key || `Phương pháp #${idx + 1}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🍽️ ${recipe.name || ""}`}
      size="lg"
    >
      <div className="recipe-detail">
        <div className="methods-section">
          <h3>👨‍🍳 Phương pháp chế biến</h3>

          {variants.map((v, idx) => (
            <Card key={v.key || idx} className="method-card">
              <div className="method-header">
                <h4>{getVariantTitle(v, idx)}</h4>
                <div className="method-meta">
                  <span className="method-mode">
                    {v.mode === "BY_WEIGHT"
                      ? "Tính theo trọng lượng"
                      : "Theo khẩu phần"}
                  </span>
                  <span className="method-yield">
                    {formatQty(v.yieldQty)} {v.yieldUnit}
                  </span>
                </div>
                <div className="method-cost">
                  Chi phí: {formatPrice(calcVariantCost(v))}
                </div>
              </div>

              <div className="method-ingredients">
                <h5>Nguyên liệu cần thiết:</h5>
                <div className="ingredients-list">
                  {(v.Ingredients || []).map((c, i) => (
                    <div key={i} className="ingredient-item">
                      <div className="ingredient-info">
                        <span className="ingredient-name">
                          {c.name || "Nguyên liệu"}
                        </span>
                        <span className="ingredient-amount">
                          {formatQty(c.quantify)} {c.baseUnit || ""}
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

        <Card className="cost-summary">
          <h3>💰 Tổng kết chi phí</h3>
          <div className="cost-breakdown">
            {variants.map((v, idx) => (
              <div key={v.key || idx} className="cost-item">
                <span>{getVariantTitle(v, idx)}:</span>
                <span>{formatPrice(calcVariantCost(v))}</span>
              </div>
            ))}
          </div>
          <div className="total-cost">
            <strong>
              Chi phí thấp nhất: {minCost > 0 ? formatPrice(minCost) : "—"}
            </strong>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default RecipeDetailModal;
