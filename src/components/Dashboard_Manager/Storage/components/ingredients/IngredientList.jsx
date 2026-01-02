// src/components/Dashboard_Manager/Storage/components/ingredients/IngredientList.jsx
import React, { useMemo, useState } from "react";
import IngredientCard from "./IngredientCard";
import IngredientModal from "./IngredientModal";
import Button from "../../../../common/Button";
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

  const handleSearch = (e) =>
    setFilters({ ...filters, search: e.target.value });
  const handleCategoryFilter = (e) =>
    setFilters({ ...filters, category: e.target.value });
  const handleStatusFilter = (e) =>
    setFilters({ ...filters, status: e.target.value });

  const handleAddStock = async (id) => {
    const ing = filteredIngredients.find((i) => i.id === id);
    if (!ing) return;

    const amount = prompt(
      `Nhập số lượng (${ing.baseUnit}) muốn thêm.\nLưu ý: hệ thống lưu integer theo baseUnit.`
    );
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
      // BE sẽ trả message rất cụ thể nếu bị chặn bởi active order
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
              <option value="others">Khác</option>
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

          {effectiveWarehouseId === null ? (
            <div className="hint hint--warn">
              Bạn đang xem <b>Tất cả kho</b>. Không thể nhập kho / nhập tồn ban
              đầu.
            </div>
          ) : effectiveWarehouseId === undefined ? (
            <div className="hint hint--warn">
              Chưa có kho. Bạn vẫn tạo được nguyên liệu, nhưng không nhập tồn
              ban đầu / nhập kho được.
            </div>
          ) : null}
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
              onUpdateCostPerBaseUnit={updateCostPerBaseUnit}
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
        canInitStock={canInitStock}
        defaultWarehouseName={defaultWarehouseName}
        saving={saving}
      />
    </div>
  );
};

export default IngredientList;
