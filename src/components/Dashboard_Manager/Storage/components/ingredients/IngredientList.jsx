// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientList.jsx
import React, { useMemo, useState } from "react";
import {
  Search,
  Filter,
  Plus,
  X,
  PackageOpen,
  AlertCircle,
  ListFilter,
} from "lucide-react";
import IngredientCard from "./IngredientCard";
import IngredientModal from "./IngredientModal";
import { useIngredients } from "@/hooks/useIngredients";
import "./IngredientList.scss";

const IngredientList = ({ restaurantId, selectedWarehouseId = undefined }) => {
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
    updateCostPerBaseUnit,
    getStockStatus,
    warehouses,
    effectiveWarehouseId,
  } = useIngredients(restaurantId, selectedWarehouseId, {
    withStock: true,
    withWarehouses: true,
  });

  const defaultWarehouseName = useMemo(() => {
    if (!warehouses?.length) return null;
    if (typeof effectiveWarehouseId !== "string") return null;
    const wh = warehouses.find((w) => w.id === effectiveWarehouseId);
    return wh?.name || null;
  }, [warehouses, effectiveWarehouseId]);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const isEditing = Boolean(editingItem?.id);
  const [saving, setSaving] = useState(false);

  // --- Handlers ---
  const handleSearch = (e) =>
    setFilters({ ...filters, search: e.target.value });
  const handleCategoryFilter = (e) =>
    setFilters({ ...filters, category: e.target.value });
  const handleStatusFilter = (e) =>
    setFilters({ ...filters, status: e.target.value });

  const clearFilters = () => {
    setFilters({ search: "", category: "", status: "" });
  };

  const hasActiveFilters = filters.search || filters.category || filters.status;

  const handleAddStock = async (id) => {
    const ing = filteredIngredients.find((i) => i.id === id);
    if (!ing) return;
    const amount = prompt(`Nhập số lượng (${ing.baseUnit}) muốn thêm:`);
    const qty = Number(amount);
    if (!Number.isFinite(qty) || qty <= 0) return;

    try {
      await addStock(id, qty);
    } catch (e) {
      alert(e?.message || "Có lỗi khi nhập kho");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nguyên liệu này?")) return;
    try {
      await deleteIngredient(id);
    } catch (e) {
      alert(e?.message || "Có lỗi khi xóa nguyên liệu");
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

  const canInitStock =
    !isEditing &&
    typeof effectiveWarehouseId === "string" &&
    Boolean(defaultWarehouseName);

  return (
    <div className="ing-storage-wrapper">
      {/* 1. Header Section */}
      <div className="il-header">
        <div className="il-header__left">
          <h2>Danh sách nguyên liệu</h2>
          <span className="il-badge">
            {loading ? "..." : filteredIngredients.length}
          </span>
        </div>

        {(effectiveWarehouseId === null ||
          effectiveWarehouseId === undefined) && (
          <div className="il-header__alert">
            <AlertCircle size={16} />
            <span>
              {effectiveWarehouseId === null
                ? "Đang xem toàn bộ kho"
                : "Chưa chọn kho hàng"}
            </span>
          </div>
        )}
      </div>

      {/* 2. Toolbar Actions */}
      <div className="il-toolbar">
        <div className="il-toolbar__filters">
          {/* Search Input */}
          <div className="il-input-group">
            <Search size={18} className="il-icon-left" />
            <input
              type="text"
              className="il-input-search"
              placeholder="Tìm tên, mã nguyên liệu..."
              value={filters.search}
              onChange={handleSearch}
            />
            {filters.search && (
              <button
                className="il-btn-clear"
                onClick={() => setFilters({ ...filters, search: "" })}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="il-select-group">
            <Filter size={16} className="il-icon-left" />
            <select
              className="il-select"
              value={filters.category}
              onChange={handleCategoryFilter}
            >
              <option value="">Tất cả danh mục</option>
              <option value="meat">Thịt cá</option>
              <option value="vegetable">Rau củ</option>
              <option value="spice">Gia vị</option>
              <option value="dairy">Sữa & trứng</option>
              <option value="grain">Ngũ cốc</option>
              <option value="others">Khác</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="il-select-group">
            <ListFilter size={16} className="il-icon-left" />
            <select
              className="il-select"
              value={filters.status}
              onChange={handleStatusFilter}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="in-stock">Còn hàng</option>
              <option value="low-stock">Sắp hết</option>
              <option value="out-of-stock">Hết hàng</option>
            </select>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              className="il-btn-icon"
              onClick={clearFilters}
              title="Xóa bộ lọc"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="il-toolbar__actions">
          <button
            className="il-btn-primary"
            onClick={openCreate}
            disabled={!restaurantId || saving}
          >
            <Plus size={18} /> Thêm mới
          </button>
        </div>
      </div>

      {/* 3. Content Area */}
      <div className="il-content">
        {error && (
          <div className="il-error">
            <AlertCircle size={20} />
            <span>{error.message}</span>
          </div>
        )}

        {loading ? (
          <div className="il-empty">
            <div
              className="spinner"
              style={{
                display: "inline-block",
                width: 30,
                height: 30,
                border: "3px solid #ccc",
                borderTopColor: "#333",
                borderRadius: "50%",
                animation: "spin 1s infinite",
              }}
            ></div>
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : filteredIngredients.length > 0 ? (
          <div className="il-grid">
            {filteredIngredients.map((ingredient) => (
              <IngredientCard
                key={ingredient.id}
                ingredient={ingredient}
                onEdit={() => openEdit(ingredient)}
                onDelete={handleDelete}
                onAddStock={handleAddStock}
                onShowUsage={() => {}}
                getStockStatus={getStockStatus}
                onUpdateCostPerBaseUnit={updateCostPerBaseUnit}
              />
            ))}
          </div>
        ) : (
          <div className="il-empty">
            <div className="il-empty__icon">
              <PackageOpen size={48} />
            </div>
            <h3>Không tìm thấy nguyên liệu</h3>
            <p>
              {hasActiveFilters
                ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
                : "Danh sách trống. Hãy thêm nguyên liệu đầu tiên!"}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters}>Xóa tất cả bộ lọc</button>
            )}
          </div>
        )}
      </div>

      <IngredientModal
        isOpen={showModal}
        onClose={closeModal}
        initial={editingItem}
        isEditing={isEditing}
        onSubmit={handleSubmit}
        canInitStock={canInitStock}
        defaultWarehouseName={defaultWarehouseName}
        saving={saving}
      />
    </div>
  );
};

export default IngredientList;
