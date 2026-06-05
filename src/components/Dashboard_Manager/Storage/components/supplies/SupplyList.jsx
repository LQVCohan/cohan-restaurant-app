// src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  PackageOpen,
  Layers,
} from "lucide-react";
import Button from "../../../../common/Button";
import SupplyCard from "./SupplyCard";
import SupplyModal from "./SupplyModal";
import useSupply from "../../../../../hooks/useSupply";
import { useNotification } from "@/hooks/useNotification";
import { getSupplyActionErrorMessage } from "@/utils/inventorySupplySupplierPrintErrorMessages";
import StockOutModal from "../modals/StockOutModal";
import StockTransferModal from "../modals/StockTransferModal";
import QuickStockModal from "../ingredients/QuickStockModal";
import { debounce } from "../../../../../utils/debounce";
import "./SupplyList.scss";

const SupplyList = ({
  restaurantId,
  warehouseId = null,
  warehouses = [],
  warehousesLoading = false,
}) => {
  const { showNotification } = useNotification();
  const {
    supplies,
    supplyCategories,
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [current, setCurrent] = useState(null);
  const [mode, setMode] = useState(null); // 'in' | 'out' | 'transfer'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingStockOut, setIsSubmittingStockOut] = useState(false);
  const [editing, setEditing] = useState(null);
  const [quickEntries, setQuickEntries] = useState([]);

  // Reset filter khi đổi nhà hàng/kho
  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setCategory("");
    setUnit("");
  }, [restaurantId, warehouseId]);

  const applyDebouncedSearch = useMemo(
    () => debounce((nextValue) => setSearch(nextValue), 250),
    []
  );

  useEffect(() => {
    applyDebouncedSearch(searchInput);
  }, [searchInput, applyDebouncedSearch]);

  const filtered = useMemo(() => {
    let list = supplies || [];
    if (search.trim()) {
      const q = normalizeSearchText(search);
      list = list.filter(
        (s) =>
          normalizeSearchText(s?.name).includes(q) ||
          normalizeSearchText(getSupplyCode(s)).includes(q)
      );
    }
    if (category) {
      const expectedCategory = normalizeFilterKey(category);
      list = list.filter(
        (s) => normalizeFilterKey(s?.category) === expectedCategory
      );
    }
    if (unit) {
      const expectedUnit = normalizeFilterKey(unit);
      list = list.filter((s) => normalizeFilterKey(s?.unit) === expectedUnit);
    }
    return list;
  }, [supplies, search, category, unit]);

  const formatNum = (n) =>
    (Number.isFinite(Number(n)) ? Number(n) : 0).toLocaleString("vi-VN");

  // ----- Handlers -----
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
    try {
      if (editing) {
        await handleUpdate(editing.id, { ...values, restaurantId });
      } else {
        await handleCreate({ ...values, restaurantId });
      }
      closeModal();
    } catch (err) {
      showNotification(
        getSupplyActionErrorMessage(
          err,
          err?.message || "Không thể lưu vật tư.",
        ),
        "error",
      );
      throw err;
    }
  };

  const requireWarehouse = () => {
    if (!warehouseId) {
      showNotification(
        "Vui lòng chọn kho cụ thể để thực hiện nhập/xuất.",
        "warning"
      );
      return false;
    }
    return true;
  };

  const openIn = (s) => {
    if (!requireWarehouse()) return;
    setCurrent(s);
    setMode("in");
    setQuickEntries([
      {
        id: s.id,
        type: "supply",
        name: s.name,
        unit: s.unit,
      },
    ]);
  };
  const openOut = (s) => {
    if (requireWarehouse()) {
      setCurrent(s);
      setMode("out");
    }
  };
  const openTransfer = (s) => {
    setCurrent(s);
    setMode("transfer");
  };

  const closeStockModal = () => {
    setCurrent(null);
    setMode(null);
    setIsSubmittingStockOut(false);
  };

  const submitInbound = async (values) => {
    if (!current) return;
    try {
      await handleInbound({
        restaurantId,
        warehouseId,
        supplyId: current.id,
        ...values,
      });
      showNotification("Nhập kho vật tư thành công.", "success");
      closeStockModal();
    } catch (err) {
      showNotification(
        getSupplyActionErrorMessage(
          err,
          err?.message || "Không thể nhập kho vật tư.",
        ),
        "error",
      );
      throw err;
    }
  };

  const submitOutbound = async (values) => {
    if (!current) return;
    const stockItem = getStockItem(current.id);
    const nQty = Number(values.qty || 0);

    if ((stockItem?.id && Number(stockItem?.onHand || 0) < nQty) || !stockItem?.id) {
      showNotification(
        !stockItem?.id
          ? "Vật tư này chưa có tồn kho tại kho đang chọn."
          : `Không đủ tồn kho để xuất. Tồn hiện tại: ${formatNum(stockItem?.onHand)}.`,
        "error"
      );
      return;
    }

    setIsSubmittingStockOut(true);
    try {
      await handleOutbound({
        restaurantId,
        warehouseId,
        supplyId: current.id,
        qty: values.qty,
        reason: values.reason,
      });
      showNotification("Xuất kho vật tư thành công.", "success");
      closeStockModal();
    } catch (err) {
      showNotification(
        getSupplyActionErrorMessage(err, toFriendlyOutboundError(err)),
        "error",
      );
    } finally {
      setIsSubmittingStockOut(false);
    }
  };

  const submitTransfer = async (values) => {
    if (!current) return;
    try {
      await handleTransfer({
        restaurantId,
        supplyId: current.id,
        ...values,
      });
      showNotification("Chuyển kho vật tư thành công.", "success");
      closeStockModal();
    } catch (err) {
      showNotification(
        getSupplyActionErrorMessage(
          err,
          err?.message || "Không thể chuyển kho vật tư.",
        ),
        "error",
      );
      throw err;
    }
  };

  // --- Render Skeleton ---
  const renderSkeletons = () => (
    <div className="sl-grid">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="sl-skeleton-card"></div>
      ))}
    </div>
  );

  return (
    <div className="supply-list-container">
      {/* Toolbar */}
      <div className="sl-toolbar">
        <div className="sl-toolbar__left">
          {/* Search Box */}
          <div className="sl-input-group sl-search-box">
            <Search size={18} className="sl-icon" />
            <input
              aria-label="Tìm kiếm vật tư"
              type="text"
              placeholder="Tìm kiếm vật tư..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {/* Filter Category */}
          <div className="sl-input-group sl-filter-box">
            <Filter size={16} className="sl-icon" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              <option value="drink">Nước uống</option>
              <option value="tissue">Khăn giấy</option>
              <option value="clean">Vệ sinh</option>
              <option value="sauce">Gia vị</option>
              <option value="other">Khác</option>
            </select>
          </div>

          {/* Filter Unit */}
          <div className="sl-input-group sl-filter-box">
            <Layers size={16} className="sl-icon" />
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">Đơn vị</option>
              <option value="unit">Cái</option>
              <option value="piece">Mảnh</option>
              <option value="pack">Gói</option>
              <option value="bottle">Chai</option>
              <option value="can">Lon</option>
            </select>
          </div>
        </div>

        <div className="sl-toolbar__right">
          {/* Badge Tổng - Đã sửa lại cho gọn */}
          <div className="sl-stats">
            Tổng: <b>{formatNum(filtered.length)}</b>
          </div>

          {/* Nút Refresh - Dùng thẻ <button> thuần để tránh style lạ của Button component */}
          <button
            className="sl-btn-icon"
            onClick={refresh}
            disabled={loading}
            title="Tải lại"
            type="button"
          >
            {/* Ép màu cho icon bằng class text-gray-500 hoặc style trực tiếp nếu cần */}
            <RefreshCw
              size={18}
              className={loading ? "spin" : ""}
            />
          </button>

          {/* Nút Thêm mới - Đã ép style mạnh */}
          <Button variant="primary" onClick={openCreate} className="sl-btn-add">
            <Plus size={18} />
            <span>Thêm mới</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="sl-content">
        {error ? (
          <div className="sl-state-box error">
            <p>Đã xảy ra lỗi: {error.message}</p>
            <Button size="sm" onClick={refresh}>
              Thử lại
            </Button>
          </div>
        ) : loading ? (
          renderSkeletons()
        ) : filtered.length === 0 ? (
          <div className="sl-state-box empty">
            <div className="icon-circle">
              <PackageOpen size={40} />
            </div>
            <h3>Không tìm thấy vật tư nào</h3>
            <p>Thử thay đổi bộ lọc hoặc thêm vật tư mới</p>
            <Button variant="primary" onClick={openCreate}>
              Thêm vật tư ngay
            </Button>
          </div>
        ) : (
          <div className="sl-grid">
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
      </div>

      {/* Modals */}
      {isModalOpen && (
        <SupplyModal
          isOpen
          onClose={closeModal}
          initial={editing}
          restaurantId={restaurantId}
          categoryOptions={supplyCategories}
          onSubmit={submitSupply}
        />
      )}
      {mode === "in" && current && (
        <QuickStockModal
          isOpen
          onClose={closeStockModal}
          entries={quickEntries}
          onSubmit={async (rows) => {
            try {
              await Promise.all(
                rows.map((row) =>
                  submitInbound({
                    qty: row.qty,
                    supplier: row.supplier,
                    reason: buildReason(row),
                  })
                )
              );
              showNotification("Nhập kho vật tư thành công.", "success");
              closeStockModal();
            } catch (err) {
              showNotification(toFriendlyInboundError(err), "error");
            }
          }}
        />
      )}
      {mode === "out" && current && (
        <StockOutModal
          isOpen
          onClose={closeStockModal}
          onConfirm={submitOutbound}
          supply={current}
          isSubmitting={isSubmittingStockOut}
        />
      )}
      {mode === "transfer" && current && (
        <StockTransferModal
          isOpen
          onClose={closeStockModal}
          onConfirm={submitTransfer}
          supply={current}
          warehouses={warehouses || []}
        />
      )}
    </div>
  );
};

export default SupplyList;

function buildReason(row) {
  const parts = [];
  if (row.supplier) parts.push(`Nguồn: ${row.supplier}`);
  if (row.datetime) parts.push(`Thời gian: ${row.datetime}`);
  if (row.note) parts.push(`Ghi chú: ${row.note}`);
  return parts.join(" | ") || "Nhập kho nhanh";
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function getSupplyCode(supply) {
  return supply?.sku || "";
}

function normalizeFilterKey(value) {
  return String(value || "").trim().toLowerCase();
}

function toFriendlyInboundError(error) {
  const graphQLErrors =
    error?.graphQLErrors || error?.networkError?.result?.errors || [];
  const message = graphQLErrors[0]?.message || error?.message || "";
  const code = graphQLErrors[0]?.extensions?.code || "";

  if (code === "BAD_USER_INPUT") {
    return "Dữ liệu nhập kho chưa hợp lệ. Vui lòng kiểm tra lại.";
  }

  if (/Invalid IDs/i.test(message)) {
    return "Thông tin kho hoặc vật tư không hợp lệ.";
  }

  if (/qty must be > 0/i.test(message)) {
    return "Số lượng nhập phải lớn hơn 0.";
  }

  return message.replace(/^GraphQL error:\s*/i, "").trim() || "Nhập kho vật tư thất bại.";
}

function toFriendlyOutboundError(error) {
  const graphQLErrors =
    error?.graphQLErrors || error?.networkError?.result?.errors || [];
  const message = graphQLErrors[0]?.message || error?.message || "";
  const code = graphQLErrors[0]?.extensions?.code || "";
  const currentOnHand = graphQLErrors[0]?.extensions?.currentOnHand;

  if (code === "STOCK_ITEM_NOT_FOUND" || /Stock item not found/i.test(message)) {
    return "Vật tư này chưa có tồn kho tại kho đang chọn.";
  }

  if (code === "INSUFFICIENT_STOCK" || /Insufficient stock/i.test(message)) {
    if (Number.isFinite(Number(currentOnHand))) {
      return `Không đủ tồn kho để xuất. Tồn hiện tại: ${Number(currentOnHand).toLocaleString("vi-VN")}.`;
    }
    return "Không đủ tồn kho để xuất.";
  }

  if (code === "BAD_USER_INPUT") {
    return "Dữ liệu xuất kho chưa hợp lệ. Vui lòng kiểm tra lại.";
  }

  return message.replace(/^GraphQL error:\s*/i, "").trim() || "Xuất kho vật tư thất bại.";
}
