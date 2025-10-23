import React, { useState } from "react";
import RecipeCard from "./RecipeCard";
import RecipeModal from "./RecipeModal";
import RecipeDetailModal from "./RecipeDetailModal";
import Button from "../../../../common/Button";
import { useRecipes } from "../../../../../hooks/useRecipes";
import { RECIPE_CATEGORIES } from "../../../../../utils/constants";
import "./recipes.scss";

/**
 * Nhận restaurantId từ parent (StorageManagement) để lọc dữ liệu theo nhà hàng.
 * Thêm select "Buổi" để lọc menuItems theo timeSlot.
 */
const RecipeList = ({ restaurantId }) => {
  const [timeSlot, setTimeSlot] = useState(null); // 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'LATE_NIGHT' | null
  const {
    filteredRecipes,
    filters,
    setFilters,
    addRecipe,
    updateRecipe,
    deleteRecipe,
  } = useRecipes(restaurantId, timeSlot);

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
      // Khi tạo mới từ UI này, bạn có thể cần chọn món (menuItem) trước.
      // Ở layout hiện tại, ta giả định recipeData.id đã là menuItemId (như bạn đang map).
      addRecipe(recipeData);
    }
    setShowModal(false);
    setEditingRecipe(null);
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

            {/* NEW: chọn buổi (timeSlot) */}
            <select
              className="filter-select"
              value={timeSlot || ""}
              onChange={(e) => setTimeSlot(e.target.value || null)}
              title="Chọn buổi để lọc menu"
            >
              <option value="">— Tất cả buổi —</option>
              <option value="breakfast">Sáng</option>
              <option value="lunch">Trưa</option>
              <option value="dinner">Tối</option>
              <option value="late-night">Đêm</option>
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
