// src/components/.../ingredients/IngredientList.jsx
import React, { useState } from "react";
import IngredientCard from "./IngredientCard";
import IngredientModal from "./IngredientModal";
import Button from "../../../../common/Button";
import { useIngredients } from "../../../../../hooks/useIngredients";
import "./IngredientList.scss";

const IngredientList = ({ restaurantId, selectedWarehouseId = null }) => {
  const {
    filteredIngredients,
    filters,
    setFilters,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addStock,
    getStockStatus,
  } = useIngredients(restaurantId, selectedWarehouseId);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState();
  const handleSearch = (e) =>
    setFilters({ ...filters, search: e.target.value });
  const handleCategoryFilter = (e) =>
    setFilters({ ...filters, category: e.target.value });
  const handleStatusFilter = (e) =>
    setFilters({ ...filters, status: e.target.value });

  const handleAddStock = (id) => {
    const ingredient = filteredIngredients.find((i) => i.id === id);
    const amount = prompt(`Nhập số lượng ${ingredient.unit} muốn thêm:`);
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
      addStock(id, parseFloat(amount));
    }
  };

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa nguyên liệu này?")) {
      deleteIngredient(id);
    }
  };
  const handleShowModal = (ingredient) => {
    setShowModal(true);
    setEditingItem(ingredient);
    setIsEditing(true);
  };
  return (
    <div className="ingredient-list">
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-filter">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Tìm kiếm nguyên liệu..."
              value={filters.search}
              onChange={handleSearch}
            />
            <select
              className="filter-select"
              value={filters.category}
              onChange={handleCategoryFilter}
            >
              <option value="">Tất cả danh mục</option>
              <option value="meat">Thịt cá</option>
              <option value="vegetable">Rau củ</option>
              <option value="spice">Gia vị</option>
              <option value="dairy">Sữa & trứng</option>
              <option value="grain">Ngũ cốc</option>
            </select>
            <select
              className="filter-select"
              value={filters.status}
              onChange={handleStatusFilter}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="in-stock">Còn hàng</option>
              <option value="low-stock">Sắp hết</option>
              <option value="out-of-stock">Hết hàng</option>
            </select>
          </div>
        </div>
        <div className="toolbar-right">
          <Button onClick={() => setShowModal(true)}>
            ➕ Thêm nguyên liệu
          </Button>
        </div>
      </div>

      <div className="ingredients-grid">
        {filteredIngredients.map((ingredient) => (
          <IngredientCard
            key={ingredient.id}
            ingredient={ingredient}
            onEdit={() => handleShowModal(ingredient)} // tuỳ bạn mở modal edit
            onDelete={handleDelete}
            onAddStock={handleAddStock}
            onShowUsage={() => {
              /* show recipe usage nếu muốn */
            }}
            getStockStatus={getStockStatus}
          />
        ))}
      </div>

      <IngredientModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={(data) => {
          if (data.id) updateIngredient(data.id, data);
          else addIngredient(data);
        }}
        onDelete={(id) => deleteIngredient(id)}
        isEditing={isEditing}
        initial={editingItem}
      />
    </div>
  );
};

export default IngredientList;
