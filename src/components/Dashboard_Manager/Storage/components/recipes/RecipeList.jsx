import React, { useState } from "react";
import RecipeCard from "./RecipeCard";
import RecipeModal from "./RecipeModal";
import RecipeDetailModal from "./RecipeDetailModal";
import Button from "../../../../common/Card";
import { useRecipes } from "../../../../../hooks/useRecipes";
import { RECIPE_CATEGORIES } from "../../../../../utils/constants";
import "./recipes.scss";

const RecipeList = () => {
  const {
    filteredRecipes,
    filters,
    setFilters,
    addRecipe,
    updateRecipe,
    deleteRecipe,
  } = useRecipes();

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);

  const handleSearch = (e) => {
    setFilters({ ...filters, search: e.target.value });
  };

  const handleCategoryFilter = (e) => {
    setFilters({ ...filters, category: e.target.value });
  };

  const handleEdit = (id) => {
    const recipe = filteredRecipes.find((r) => r.id === id);
    setEditingRecipe(recipe);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingRecipe(null);
    setShowModal(true);
  };

  const handleViewDetails = (id) => {
    const recipe = filteredRecipes.find((r) => r.id === id);
    setViewingRecipe(recipe);
    setShowDetailModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) {
      deleteRecipe(id);
    }
  };

  const handleSave = (recipeData) => {
    if (editingRecipe) {
      updateRecipe(editingRecipe.id, recipeData);
    } else {
      addRecipe(recipeData);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingRecipe(null);
  };

  const handleDetailModalClose = () => {
    setShowDetailModal(false);
    setViewingRecipe(null);
  };

  return (
    <div className="recipe-list">
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-filter">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Tìm kiếm công thức..."
              value={filters.search}
              onChange={handleSearch}
            />
            <select
              className="filter-select"
              value={filters.category}
              onChange={handleCategoryFilter}
            >
              <option value="">Tất cả danh mục</option>
              {RECIPE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="toolbar-right">
          <Button onClick={handleAdd}>➕ Thêm công thức</Button>
        </div>
      </div>

      <div className="recipes-grid">
        {filteredRecipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onViewDetails={handleViewDetails}
          />
        ))}
      </div>

      <RecipeModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSave={handleSave}
        onDelete={deleteRecipe}
        recipe={editingRecipe}
      />

      <RecipeDetailModal
        isOpen={showDetailModal}
        onClose={handleDetailModalClose}
        recipe={viewingRecipe}
      />
    </div>
  );
};

export default RecipeList;
