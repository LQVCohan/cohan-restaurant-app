import React, { useState } from "react";
import RecipeCard from "./RecipeCard";
import RecipeModal from "./RecipeModal";
import RecipeDetailModal from "./RecipeDetailModal";
import Button from "../../../../common/Button";
import { RECIPE_CATEGORIES } from "../../../../../utils/constants";
import "./recipes.scss";

/**
 * Props:
 * - restaurantId: ID nhà hàng
 * - recipes: [{ id, name, description, servingVariants, ... }]
 *   (id ở đây chính là menuItemId đã được flatten từ useRecipes)
 * - loading, error, pageInfo, total
 * - onSearchChange, onCategoryChange, onTimeSlotChange
 * - loadMore()
 * - onAddRecipe(recipeForm)
 * - onUpdateRecipe(id, recipeForm)   // id = menuItemId
 * - onDeleteRecipe(id)               // id = menuItemId
 * - ingredients: danh sách nguyên liệu (dùng cho modal)
 */
const RecipeList = ({
  restaurantId,
  recipes = [],
  loading = false,
  error = null,
  pageInfo = { hasNextPage: false },
  total,
  onTimeSlotChange,
  onSearchChange,
  onCategoryChange,
  loadMore,
  onAddRecipe,
  onUpdateRecipe,
  onDeleteRecipe,
  ingredients = [],
}) => {
  // ===== UI state =====
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [timeSlot, setTimeSlot] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);

  // ===== Filters =====
  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    onSearchChange?.(val || null);
  };

  const handleCategoryFilter = (e) => {
    const val = e.target.value;
    setCategory(val);
    onCategoryChange?.(val || null);
  };

  const handleTimeSlotFilter = (e) => {
    const val = e.target.value;
    setTimeSlot(val);
    onTimeSlotChange?.(val || null);
  };

  // ===== CRUD modal =====
  const handleAdd = () => {
    setEditingRecipe(null);
    setShowModal(true);
  };

  const handleEdit = (id) => {
    const recipe = recipes.find((r) => r.id === id);
    setEditingRecipe(recipe || null);
    setShowModal(true);
  };

  const handleViewDetails = (id) => {
    const recipe = recipes.find((r) => r.id === id);
    setViewingRecipe(recipe || null);
    setShowDetailModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) return;
    await onDeleteRecipe?.(id);
  };

  const handleSave = async (formData) => {
    if (editingRecipe) {
      // update: id ở đây chính là menuItemId (đã flatten từ useRecipes)
      await onUpdateRecipe?.(editingRecipe.id, formData);
    } else {
      // add
      await onAddRecipe?.(formData);
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
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-filter">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Tìm kiếm món ăn..."
              value={search}
              onChange={handleSearch}
            />

            <select
              className="filter-select"
              value={category}
              onChange={handleCategoryFilter}
              title="Danh mục món"
            >
              <option value="">Tất cả danh mục</option>
              {RECIPE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={timeSlot}
              onChange={handleTimeSlotFilter}
              title="Buổi ăn"
            >
              <option value="">— Tất cả buổi —</option>
              <option value="breakfast">Sáng</option>
              <option value="lunch">Trưa</option>
              <option value="dinner">Tối</option>
              <option value="late_night">Đêm</option>
            </select>
          </div>
        </div>

        <div className="toolbar-right">
          <Button onClick={handleAdd} disabled={!restaurantId}>
            ➕ Thêm công thức
          </Button>
        </div>
      </div>

      {/* Grid list */}
      {loading && !recipes.length ? (
        <div className="recipes-grid">
          <div className="card">Đang tải công thức...</div>
        </div>
      ) : error ? (
        <div className="recipes-grid">
          <div className="card error">Lỗi: {error.message}</div>
        </div>
      ) : (
        <>
          <div className="recipes-grid">
            {recipes.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onEdit={handleEdit}
                onViewDetails={handleViewDetails}
                onDelete={handleDelete}
              />
            ))}
            {!recipes.length && (
              <div className="card">Không có công thức phù hợp</div>
            )}
          </div>

          {pageInfo?.hasNextPage && (
            <div className="load-more">
              <Button onClick={loadMore} disabled={loading}>
                {loading ? "Đang tải..." : "Tải thêm"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal: Create/Update */}
      <RecipeModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSave={handleSave}
        onDelete={handleDelete}
        recipe={editingRecipe}
        // Dữ liệu đã được flatten: dùng name trực tiếp
        menuItemName={editingRecipe?.name}
        restaurantId={restaurantId}
        ingredients={ingredients}
      />

      {/* Modal: Detail view */}
      <RecipeDetailModal
        isOpen={showDetailModal}
        onClose={handleDetailModalClose}
        recipe={viewingRecipe}
        ingredients={ingredients}
      />
    </div>
  );
};

export default RecipeList;
