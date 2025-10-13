import React from "react";
import Modal from "../../../../common/Modal";
import Card from "../../../../common/Card";
import { useIngredients } from "../../../../../hooks/useIngredients";
import { formatPrice } from "../../../../../utils/formatters";

const RecipeDetailModal = ({ isOpen, onClose, recipe }) => {
  const { ingredients } = useIngredients();

  if (!recipe) return null;

  const getIngredientName = (ingredientId) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId);
    return ingredient ? ingredient.name : "Nguyên liệu không tồn tại";
  };

  const getIngredientPrice = (ingredientId) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId);
    return ingredient ? ingredient.costPrice : 0;
  };

  const calculateIngredientCost = (ingredientId, amount) => {
    return getIngredientPrice(ingredientId) * amount;
  };

  const calculateMethodCost = (method) => {
    return method.ingredients.reduce((total, ing) => {
      return total + calculateIngredientCost(ing.ingredientId, ing.amount);
    }, 0);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${recipe.icon} ${recipe.name}`}
      size="lg"
    >
      <div className="recipe-detail">
        {/* Basic Info */}
        <Card className="recipe-info-card">
          <h3>📝 Thông tin món ăn</h3>
          <p>
            <strong>Danh mục:</strong> {recipe.category}
          </p>
          <p>
            <strong>Mô tả:</strong> {recipe.description}
          </p>
        </Card>

        {/* Base Ingredients */}
        <Card className="ingredients-card">
          <h3>🥬 Nguyên liệu cơ bản</h3>
          <div className="ingredients-list">
            {recipe.baseIngredients.map((ingredient, index) => (
              <div key={index} className="ingredient-item">
                <div className="ingredient-info">
                  <span className="ingredient-name">
                    {getIngredientName(ingredient.ingredientId)}
                  </span>
                  <span className="ingredient-amount">
                    {ingredient.amount} {ingredient.unit}
                  </span>
                </div>
                <div className="ingredient-cost">
                  {formatPrice(
                    calculateIngredientCost(
                      ingredient.ingredientId,
                      ingredient.amount
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Cooking Methods */}
        <div className="methods-section">
          <h3>👨‍🍳 Phương pháp chế biến</h3>
          {recipe.methods.map((method, index) => (
            <Card key={method.id} className="method-card">
              <div className="method-header">
                <h4>{method.name}</h4>
                <div className="method-cost">
                  Chi phí: {formatPrice(calculateMethodCost(method))}
                </div>
              </div>

              <div className="method-description">
                <p>{method.description}</p>
              </div>

              <div className="method-ingredients">
                <h5>Nguyên liệu cần thiết:</h5>
                <div className="ingredients-list">
                  {method.ingredients.map((ingredient, ingredientIndex) => (
                    <div key={ingredientIndex} className="ingredient-item">
                      <div className="ingredient-info">
                        <span className="ingredient-name">
                          {getIngredientName(ingredient.ingredientId)}
                        </span>
                        <span className="ingredient-amount">
                          {ingredient.amount} {ingredient.unit}
                        </span>
                      </div>
                      <div className="ingredient-cost">
                        {formatPrice(
                          calculateIngredientCost(
                            ingredient.ingredientId,
                            ingredient.amount
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Total Cost Summary */}
        <Card className="cost-summary">
          <h3>💰 Tổng kết chi phí</h3>
          <div className="cost-breakdown">
            {recipe.methods.map((method, index) => (
              <div key={method.id} className="cost-item">
                <span>{method.name}:</span>
                <span>{formatPrice(calculateMethodCost(method))}</span>
              </div>
            ))}
          </div>
          <div className="total-cost">
            <strong>
              Chi phí thấp nhất:{" "}
              {formatPrice(
                Math.min(...recipe.methods.map(calculateMethodCost))
              )}
            </strong>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default RecipeDetailModal;
