// src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx
import React, { useMemo, useState, useEffect } from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import SupplyCard from "./SupplyCard";
import SupplyModal from "./SupplyModal";
import useSupply from "../../../../../hooks/useSupply";
import StockInModal from "../modals/StockInModal";
import StockOutModal from "../modals/StockOutModal";
import StockTransferModal from "../modals/StockTransferModal";
import "./SupplyList.scss";

const SupplyList = ({
  restaurantId,
  warehouseId = null,
  warehouses = [],
  warehousesLoading = false,
}) => {
  const {
    supplies,
    getStockItem,
    loading,
    error,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleInbound,
    handleOutbound,
    handleTransfer,
    refresh,
  } = useSupply(restaurantId, warehouseId);

  // ====== UI state ======
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [current, setCurrent] = useState(null);
  const [mode, setMode] = useState(null); // 'in' | 'out' | 'transfer'
  const [isModalOpen, setIsModalOpen] = useState(false); // SupplyModal
  const [editing, setEditing] = useState(null); // supply đang sửa

  // reset theo nhà hàng/kho
  useEffect(() => {
    setSearch("");
    setCategory("");
    setUnit("");
  }, [restaurantId, warehouseId]);

  const filtered = useMemo(() => {
    let list = supplies || [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q)
      );
    }
    if (category) list = list.filter((s) => s.category === category);
    if (unit) list = list.filter((s) => s.unit === unit);
    return list;
  }, [supplies, search, category, unit]);

  const formatNum = (n) =>
    (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString("vi-VN", {
      maximumFractionDigits: 2,
    });

  // ----- SupplyModal handlers -----
  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };
  const openEdit = (supply) => {
    setEditing(supply);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };
  const submitSupply = async (values) => {
    if (editing) {
      await handleUpdate(editing.id, { ...values, restaurantId });
    } else {
      await handleCreate({ ...values, restaurantId });
    }
    closeModal();
  };

  // ----- Stock modals -----
  const requireWarehouse = () => {
    if (!warehouseId) {
      alert("Vui lòng chọn kho trước khi thao tác tồn (nhập/xuất).");
      return false;
    }
    return true;
  };

  const openIn = (s) => {
    if (!requireWarehouse()) return;
    setCurrent(s);
    setMode("in");
  };
  const openOut = (s) => {
    if (!requireWarehouse()) return;
    setCurrent(s);
    setMode("out");
  };
  const openTransfer = (s) => {
    setCurrent(s);
    setMode("transfer");
  };
  const closeStockModal = () => {
    setCurrent(null);
    setMode(null);
  };

  const submitInbound = async (values) => {
    if (!current) return;
    await handleInbound({
      restaurantId,
      warehouseId, // nhập vào kho đang chọn
      supplyId: current.id,
      qty: values.qty,
      lot: values.lot,
      expiry: values.expiry,
      costPerBaseUnit: values.costPerBaseUnit,
      reason: values.reason,
      supplier: values.supplier,
    });
    closeStockModal();
  };

  const submitOutbound = async (values) => {
    if (!current) return;
    await handleOutbound({
      restaurantId,
      warehouseId, // xuất từ kho đang chọn
      supplyId: current.id,
      qty: values.qty,
      reason: values.reason,
    });
    closeStockModal();
  };

  const submitTransfer = async (values) => {
    if (!current) return;
    await handleTransfer({
      restaurantId,
      supplyId: current.id,
      fromWarehouseId: values.fromWarehouseId,
      toWarehouseId: values.toWarehouseId,
      qty: values.qty,
      reason: values.reason,
    });
    closeStockModal();
  };

  return (
    <div className="supply-list">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            className="search-input"
            placeholder="🔍 Tìm vật phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            <option value="drink">Nước uống</option>
            <option value="tissue">Khăn giấy</option>
            <option value="clean">Vệ sinh</option>
            <option value="sauce">Gia vị đóng gói</option>
            <option value="other">Khác</option>
          </select>
          <select
            className="filter-select"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Tất cả đơn vị</option>
            <option value="unit">unit</option>
            <option value="piece">piece</option>
            <option value="pack">pack</option>
            <option value="bottle">bottle</option>
            <option value="can">can</option>
          </select>
        </div>

        <div className="toolbar-right">
          <span className="toolbar-hint">
            Tổng: <strong>{formatNum(filtered.length)}</strong> vật phẩm
          </span>
          <Button onClick={refresh} disabled={loading}>
            {loading ? "⟳ Đang tải…" : "🔄 Tải lại"}
          </Button>
          <Button variant="primary" onClick={openCreate}>
            ➕ Thêm vật phẩm
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <Card padding="default">Đang tải vật phẩm…</Card>
      ) : error ? (
        <Card padding="default" className="error">
          Lỗi: {error.message}
        </Card>
      ) : filtered.length === 0 ? (
        <Card padding="default">Chưa có vật phẩm phù hợp</Card>
      ) : (
        <div className="supplies-grid">
          {filtered.map((supply) => {
            const stockItem = getStockItem(supply.id);
            return (
              <SupplyCard
                key={supply.id}
                supply={supply}
                stockItem={stockItem}
                onEdit={() => openEdit(supply)}
                onDelete={async () => await handleDelete(supply.id)}
                onStockClick={openIn}
                onStockOutClick={openOut}
                onTransferClick={openTransfer}
              />
            );
          })}
        </div>
      )}

      {/* SupplyModal: create/update */}
      {isModalOpen && (
        <SupplyModal
          isOpen
          onClose={closeModal}
          initial={editing}
          onSubmit={submitSupply}
        />
      )}

      {/* Stock modals */}
      {mode === "in" && current && (
        <StockInModal
          isOpen
          onClose={closeStockModal}
          onConfirm={submitInbound}
          mode="in"
          supply={current}
        />
      )}
      {mode === "out" && current && (
        <StockOutModal
          isOpen
          onClose={closeStockModal}
          onConfirm={submitOutbound}
          supply={current}
        />
      )}
      {mode === "transfer" && current && (
        <StockTransferModal
          isOpen
          onClose={closeStockModal}
          onConfirm={submitTransfer}
          supply={current}
          warehouses={warehouses || []}
          warehousesLoading={warehousesLoading}
          currentWarehouseId={warehouseId || ""}
        />
      )}
    </div>
  );
};

export default SupplyList;
