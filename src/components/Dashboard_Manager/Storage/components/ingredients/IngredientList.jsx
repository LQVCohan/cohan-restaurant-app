// src/components/.../ingredients/IngredientList.jsx
import React, { useMemo, useState } from "react";
import IngredientCard from "./IngredientCard";
import IngredientModal from "./IngredientModal";
import Button from "../../../../common/Button";
import { useIngredients } from "../../../../../hooks/useIngredients";
import "./IngredientList.scss";

const IngredientList = ({ restaurantId, selectedWarehouseId = null }) => {
  const {
    loading,
    error,
    filteredIngredients,
    filters,
    setFilters,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    addStock,
    getStockStatus,
    warehouses,
    defaultWarehouseId,
  } = useIngredients(restaurantId, selectedWarehouseId);

  const defaultWarehouseName = useMemo(() => {
    const wh = warehouses.find((w) => w.id === defaultWarehouseId);
    return wh?.name || null;
  }, [warehouses, defaultWarehouseId]);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const isEditing = Boolean(editingItem?.id);

  const [saving, setSaving] = useState(false);

  const handleSearch = (e) =>
    setFilters({ ...filters, search: e.target.value });
  const handleCategoryFilter = (e) =>
    setFilters({ ...filters, category: e.target.value });
  const handleStatusFilter = (e) =>
    setFilters({ ...filters, status: e.target.value });

  const handleAddStock = async (id) => {
    const ingredient = filteredIngredients.find((i) => i.id === id);
    if (!ingredient) return;

    const amount = prompt(`Nhập số lượng (${ingredient.baseUnit}) muốn thêm:`);
    const qty = Number(amount);
    if (Number.isFinite(qty) && qty > 0) {
      await addStock(id, qty);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa nguyên liệu này?")) {
      await deleteIngredient(id);
    }
  };

  const openCreate = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const openEdit = (ingredient) => {
    setEditingItem(ingredient);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSubmit = async ({ payload, initialStockQty, isEditing, id }) => {
    try {
      setSaving(true);
      if (isEditing && id) {
        await updateIngredient(id, { payload });
      } else {
        await addIngredient({ payload, initialStockQty });
      }
      setShowModal(false);
      setEditingItem(null);
    } catch (e) {
      alert(e?.message || "Có lỗi khi lưu nguyên liệu");
    } finally {
      setSaving(false);
    }
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

          {defaultWarehouseName ? (
            <></>
          ) : (
            <div className="hint hint--warn">
              Chưa có kho. Bạn vẫn tạo được nguyên liệu, nhưng không nhập tồn
              ban đầu / nhập kho được.
            </div>
          )}
        </div>

        <div className="toolbar-right">
          <Button onClick={openCreate} disabled={!restaurantId || saving}>
            ➕ Thêm nguyên liệu
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ color: "#b91c1c", padding: "8px 0" }}>
          Lỗi: {error.message}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "12px 0" }}>Đang tải…</div>
      ) : (
        <div className="ingredients-grid">
          {filteredIngredients.map((ingredient) => (
            <IngredientCard
              key={ingredient.id}
              ingredient={ingredient}
              onEdit={() => openEdit(ingredient)}
              onDelete={handleDelete}
              onAddStock={handleAddStock}
              onShowUsage={() => {}}
              getStockStatus={getStockStatus}
            />
          ))}
        </div>
      )}

      <IngredientModal
        isOpen={showModal}
        onClose={closeModal}
        initial={editingItem}
        isEditing={isEditing}
        onSubmit={handleSubmit}
        canInitStock={!isEditing && Boolean(defaultWarehouseId)}
        defaultWarehouseName={defaultWarehouseName}
        saving={saving}
      />
    </div>
  );
};

export default IngredientList;
