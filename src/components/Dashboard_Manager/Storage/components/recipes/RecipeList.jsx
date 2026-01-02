// src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx
import React, { useMemo, useState } from "react";
import RecipeCard from "./RecipeCard";
import RecipeModal from "./RecipeModal";
import RecipeDetailModal from "./RecipeDetailModal";
import Button from "../../../../common/Button";
import { RECIPE_CATEGORIES } from "../../../../../utils/constants";
import "./recipes.scss";

/**
 * Props:
 * - restaurantId
 * - recipes: array (flatten từ useRecipes) có dạng:
 *   {
 *     id: menuItemId,
 *     name, description, category, icon, ...
 *     servingVariants: [{ key, name, mode, sellQty, sellUnit, price, isDefault, ingredients: [...] }]
 *   }
 * - loading, error, pageInfo, total
 * - onTimeSlotChange(val|null)
 * - onSearchChange(val|null)
 * - onCategoryChange(val|null)
 * - loadMore()
 * - onAddRecipe(form)
 * - onUpdateRecipe(menuItemId, form)
 * - onDeleteRecipe(menuItemId)
 * - ingredients: list ingredient (cho modal)
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

  // ===== Helpers =====
  const getVariantLines = (v) => {
    if (!v) return [];
    if (Array.isArray(v.ingredients)) return v.ingredients;
    if (Array.isArray(v.Ingredients)) return v.Ingredients; // legacy
    return [];
  };

  const normalizeLineQty = (line) => {
    // BE mới: qty
    // legacy: quantify / quantity
    const q = Number(line?.qty ?? line?.quantify ?? line?.quantity ?? 0);
    return Number.isFinite(q) ? q : 0;
  };

  const normalizeUnitCost = (line) => {
    const c = Number(line?.costPerBaseUnit ?? line?.unitCost ?? 0);
    return Number.isFinite(c) ? c : 0;
  };

  const calcVariantCost = (variant) => {
    const lines = getVariantLines(variant);
    return lines.reduce((sum, line) => {
      const qty = normalizeLineQty(line);
      const unitCost = normalizeUnitCost(line);
      if (qty <= 0 || unitCost <= 0) return sum;
      return sum + qty * unitCost;
    }, 0);
  };

  const calcMinCost = (recipe) => {
    const variants = Array.isArray(recipe?.servingVariants)
      ? recipe.servingVariants
      : [];
    if (!variants.length) return { minCost: 0, hasAnyCost: false };

    const costs = variants.map(calcVariantCost).filter((n) => n > 0);
    if (!costs.length) return { minCost: 0, hasAnyCost: false };

    return { minCost: Math.min(...costs), hasAnyCost: true };
  };

  // (Optional) map quick meta để RecipeCard có thể dùng nếu bạn muốn
  const recipesWithMeta = useMemo(() => {
    return (recipes || []).map((r) => {
      const variants = Array.isArray(r?.servingVariants)
        ? r.servingVariants
        : [];
      // count unique ingredientId across variants
      const ids = new Set();
      variants.forEach((v) => {
        getVariantLines(v).forEach((c) => {
          const id = c?.ingredientId;
          if (id) ids.add(String(id));
        });
      });

      const { minCost, hasAnyCost } = calcMinCost(r);

      return {
        ...r,
        _meta: {
          totalVariants: variants.length,
          totalIngredients: ids.size,
          minCost,
          hasAnyCost,
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes]);

  // ===== Filters =====
  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    onSearchChange?.(val?.trim() ? val : null);
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

  const handleEdit = (menuItemId) => {
    const r = (recipesWithMeta || []).find((x) => x.id === menuItemId);
    setEditingRecipe(r || null);
    setShowModal(true);
  };

  const handleViewDetails = (menuItemId) => {
    const r = (recipesWithMeta || []).find((x) => x.id === menuItemId);
    setViewingRecipe(r || null);
    setShowDetailModal(true);
  };

  const handleDelete = async (menuItemId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) return;
    await onDeleteRecipe?.(menuItemId);
  };

  const handleSave = async (formData) => {
    // formData sẽ là shape mà RecipeModal trả về (servingVariants new model)
    if (editingRecipe) {
      await onUpdateRecipe?.(editingRecipe.id, formData);
    } else {
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

          {typeof total === "number" ? (
            <div className="hint">
              Tổng: <b>{total}</b> món
            </div>
          ) : null}
        </div>

        <div className="toolbar-right">
          <Button onClick={handleAdd} disabled={!restaurantId}>
            ➕ Thêm công thức
          </Button>
        </div>
      </div>

      {/* Grid list */}
      {loading && !recipesWithMeta.length ? (
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
            {recipesWithMeta.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onEdit={handleEdit}
                onViewDetails={handleViewDetails}
                onDelete={handleDelete}
              />
            ))}

            {!recipesWithMeta.length && (
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
        menuItemRecipeRows={recipes}
        recipe={editingRecipe}
        menuItemName={editingRecipe?.name}
        restaurantId={restaurantId}
        ingredients={ingredients}
      />

      {/* Modal: Detail view */}
      <RecipeDetailModal
        isOpen={showDetailModal}
        onClose={handleDetailModalClose}
        recipe={viewingRecipe}
      />
    </div>
  );
};

export default RecipeList;
