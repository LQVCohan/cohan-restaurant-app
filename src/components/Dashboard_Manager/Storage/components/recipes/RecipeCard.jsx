import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";

const RecipeCard = ({ recipe, onEdit, onDelete, onViewDetails }) => {
  const totalIngredients = recipe.baseIngredients.length;

  return (
    <Card className="recipe-card" hoverable onClick={() => onEdit(recipe.id)}>
      <div className="recipe-header">
        <div className="recipe-icon">{recipe.icon}</div>
        <div className="recipe-info">
          <h3 className="recipe-name">{recipe.name}</h3>
          <span className="recipe-category">{recipe.category}</span>
        </div>
      </div>

      <div className="recipe-content">
        <p className="recipe-description">{recipe.description}</p>

        <div className="recipe-stats">
          <div className="stat-item">
            <div className="stat-value">{totalIngredients}</div>
            <div className="stat-label">Nguyên liệu cơ bản</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{recipe.methods.length}</div>
            <div className="stat-label">Cách chế biến</div>
          </div>
        </div>

        <div className="recipe-actions">
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
        </div>
      </div>
    </Card>
  );
};

export default RecipeCard;
