import React, { useState } from "react";
import SupplyCard from "./SupplyCard";
import SupplyModal from "./SupplyModal";
import Button from "../../../../common/Button";
import { useSupplies } from "../../../../../hooks/useSupplies";
import { SUPPLY_CATEGORIES } from "../../../../../utils/constants";
import "./supplies.scss";

const SupplyList = () => {
  const {
    filteredSupplies,
    filters,
    setFilters,
    addSupply,
    updateSupply,
    deleteSupply,
    addStock,
    getStockStatus,
  } = useSupplies();

  const [showModal, setShowModal] = useState(false);
  const [editingSupply, setEditingSupply] = useState(null);

  const handleSearch = (e) => {
    setFilters({ ...filters, search: e.target.value });
  };

  const handleCategoryFilter = (e) => {
    setFilters({ ...filters, category: e.target.value });
  };

  const handleAddStock = (id) => {
    const supply = filteredSupplies.find((s) => s.id === id);
    const amount = prompt(`Nhập số lượng ${supply.unit} muốn thêm:`);
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
      addStock(id, parseFloat(amount));
    }
  };

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa vật phẩm này?")) {
      deleteSupply(id);
    }
  };

  const handleEdit = (id) => {
    const supply = filteredSupplies.find((s) => s.id === id);
    setEditingSupply(supply);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingSupply(null);
    setShowModal(true);
  };

  const handleSave = (supplyData) => {
    if (editingSupply) {
      updateSupply(editingSupply.id, supplyData);
    } else {
      addSupply(supplyData);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingSupply(null);
  };

  return (
    <div className="supply-list">
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-filter">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Tìm kiếm vật phẩm..."
              value={filters.search}
              onChange={handleSearch}
            />
            <select
              className="filter-select"
              value={filters.category}
              onChange={handleCategoryFilter}
            >
              <option value="">Tất cả danh mục</option>
              {SUPPLY_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="toolbar-right">
          <Button onClick={handleAdd}>➕ Thêm vật phẩm</Button>
        </div>
      </div>

      <div className="supplies-grid">
        {filteredSupplies.map((supply) => (
          <SupplyCard
            key={supply.id}
            supply={supply}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddStock={handleAddStock}
            getStockStatus={getStockStatus}
          />
        ))}
      </div>

      <SupplyModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSave={handleSave}
        onDelete={deleteSupply}
        supply={editingSupply}
      />
    </div>
  );
};

export default SupplyList;
