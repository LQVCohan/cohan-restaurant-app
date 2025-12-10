import React, { useState, useMemo } from "react";
import cls from "./LeftPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { TableActionsModal } from "../modals/TableActionsModal";
import RegularCustomerModal from "../modals/RegularCustomerModal";

// --- ICONS (SVG) ---
const IconMulti = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 7H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"></path>
    <rect x="9" y="3" width="12" height="12" rx="2"></rect>
  </svg>
);
const IconDots = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="1"></circle>
    <circle cx="12" cy="5" r="1"></circle>
    <circle cx="12" cy="19" r="1"></circle>
  </svg>
);
const IconCheck = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);
const IconUser = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

export default function LeftPanel() {
  const {
    floors,
    tables,

    currentTable,
    refreshTables,
    mergeTables,
    currentOrderType,
    setCurrentOrderType,
    startDeliveryOrder,
    startTakeawayOrder,

    selectTableForOrder,

    // 🔹 Off-premise customer & shipping
    deliveryCustomer,
    setDeliveryCustomer,
    shippingInfo,
    setShippingInfo,
  } = usePos();

  // --- Local State ---
  const [currentFloorId, setCurrentFloorId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Multi-select State
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal States
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionTable, setActionTable] = useState(null);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);

  // Drag & Drop State
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  // --- Tabs Configuration ---
  const tabs = useMemo(
    () => [
      { key: "dine_in", label: "Bàn ăn" },
      { key: "delivery", label: "Giao hàng" },
      { key: "takeaway", label: "Mang về" },
    ],
    []
  );

  // --- Helpers ---
  const getLastName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ");
    return parts[parts.length - 1];
  };

  const selectedCustomer = deliveryCustomer;

  // --- Filter Logic ---
  const filteredTables = useMemo(() => {
    let res = tables || [];
    if (currentFloorId !== "all") {
      res = res.filter((t) => String(t.floorId) === String(currentFloorId));
    }
    if (statusFilter !== "all") {
      res = res.filter((t) => t.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      res = res.filter((t) => t.code.toLowerCase().includes(lower));
    }
    return res;
  }, [tables, currentFloorId, statusFilter, searchTerm]);

  // --- Handlers ---

  const handleTableClick = (table) => {
    if (isMultiSelectMode) {
      setSelectedIds((prev) =>
        prev.includes(table.id)
          ? prev.filter((id) => id !== table.id)
          : [...prev, table.id]
      );
    } else {
      selectTableForOrder(table.code, table.capacity);
    }
  };

  const openActionModal = (e, table) => {
    e.stopPropagation();
    setActionTable(table);
    setActionModalOpen(true);
  };

  const handleSelectRegularCustomer = (customer) => {
    if (!customer) return;

    const { id, name, phone, isNew, shippingInfo } = customer;

    // 1) Lưu khách hàng vào context
    setDeliveryCustomer({
      id: id || null,
      name: name,
      phone: phone,
      isNew: !!isNew,
    });

    // 2) Lưu thông tin shipping vào context
    setShippingInfo({
      ...shippingInfo,
    });

    // 3) Đóng modal
    setCustomerModalOpen(false);
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e, table) => {
    e.dataTransfer.setData("text/plain", table.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(table.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e, targetTable) => {
    e.preventDefault();
    if (draggingId && draggingId !== targetTable.id) {
      setDragOverId(targetTable.id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e, targetTable) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    setDragOverId(null);
    setDraggingId(null);

    if (!sourceId || sourceId === targetTable.id) return;

    if (
      window.confirm(
        `Bạn có chắc muốn gộp bàn đang kéo vào bàn ${targetTable.code}?`
      )
    ) {
      try {
        await mergeTables({
          tableIds: [sourceId, targetTable.id],
          anchorId: targetTable.id,
        });
        refreshTables();
      } catch (err) {
        console.error("Lỗi gộp bàn:", err);
        alert("Gộp bàn thất bại, vui lòng thử lại.");
      }
    }
  };

  // --- Counts ---
  const counts = useMemo(() => {
    const all = tables.length;
    const available = tables.filter((t) => t.status === "available").length;
    const occupied = tables.filter((t) => t.status === "occupied").length;
    return { all, available, occupied };
  }, [tables]);

  return (
    <div className={cls.wrapper}>
      {/* 1. Header Tabs */}
      <div className={cls.header}>
        <div className={cls.navTabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${cls.tab} ${
                currentOrderType === t.key ? cls.active : ""
              }`}
              onClick={() => setCurrentOrderType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Controls & Context Boxes */}
      <div className={cls.controls}>
        {/* DINE IN BOX */}
        {currentOrderType === "dine_in" && (
          <div className={cls.newOrderBox}>
            <h4>Tạo đơn mới (Bàn ăn)</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={() =>
                  document.querySelector(`.${cls.search}`)?.focus()
                }
              >
                Chọn bàn
              </button>
              <button
                className={cls.btn}
                onClick={() => alert("Tính năng đặt bàn")}
              >
                + Đặt bàn
              </button>
            </div>
          </div>
        )}

        {/* DELIVERY BOX */}
        {currentOrderType === "delivery" && (
          <div className={cls.newOrderBox}>
            <h4>Tạo đơn mới (Giao hàng)</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={startDeliveryOrder}
              >
                + Đơn giao
              </button>
              <button
                className={`${cls.btn} ${selectedCustomer ? cls.ghost : ""}`}
                onClick={() => setCustomerModalOpen(true)}
                title={
                  selectedCustomer
                    ? selectedCustomer.name
                    : "Chọn khách quen / thêm khách mới"
                }
              >
                {selectedCustomer ? (
                  <>
                    <IconUser />
                    <span style={{ marginLeft: 4 }}>
                      {getLastName(selectedCustomer.name)}
                    </span>
                  </>
                ) : (
                  "Khách quen"
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAKEAWAY BOX */}
        {currentOrderType === "takeaway" && (
          <div className={cls.newOrderBox}>
            <h4>Tạo đơn mới (Mang về)</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={startTakeawayOrder}
              >
                + Đơn mang về
              </button>
              <button
                className={`${cls.btn} ${selectedCustomer ? cls.ghost : ""}`}
                onClick={() => setCustomerModalOpen(true)}
                title={
                  selectedCustomer
                    ? selectedCustomer.name
                    : "Chọn khách / thêm khách mới"
                }
              >
                {selectedCustomer ? (
                  <>
                    <IconUser />
                    <span style={{ marginLeft: 4 }}>
                      {getLastName(selectedCustomer.name)}
                    </span>
                  </>
                ) : (
                  "Khách quen"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={cls.searchGroup}>
          <select
            className={cls.select}
            value={currentFloorId}
            onChange={(e) => setCurrentFloorId(e.target.value)}
          >
            <option value="all">Tất cả tầng</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                Tầng {f.level} - {f.name}
              </option>
            ))}
          </select>
          <input
            className={cls.search}
            placeholder="Tìm bàn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Chips */}
        <div className={cls.statusChips}>
          <button
            className={`${cls.chip} ${
              statusFilter === "all" ? cls.chipActive : ""
            }`}
            onClick={() => setStatusFilter("all")}
          >
            Tất cả ({counts.all})
          </button>
          <button
            className={`${cls.chip} ${
              statusFilter === "available" ? cls.chipActive : ""
            }`}
            onClick={() => setStatusFilter("available")}
          >
            Trống ({counts.available})
          </button>
          <button
            className={`${cls.chip} ${
              statusFilter === "occupied" ? cls.chipActive : ""
            }`}
            onClick={() => setStatusFilter("occupied")}
          >
            Có khách ({counts.occupied})
          </button>
        </div>

        {/* Toolbar */}
        <div className={cls.toolbar}>
          <button
            className={`${cls.btn} ${
              isMultiSelectMode ? cls.primary : cls.ghost
            }`}
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              setSelectedIds([]);
            }}
          >
            <IconMulti />
            {isMultiSelectMode
              ? `Đang chọn (${selectedIds.length})`
              : "Chọn nhiều"}
          </button>

          {isMultiSelectMode && selectedIds.length > 0 && (
            <button
              className={`${cls.btn} ${cls.primary}`}
              onClick={() => alert("Xử lý hàng loạt")}
            >
              Xử lý ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* 3. Tables Grid */}
      <div className={cls.tablesGrid}>
        {filteredTables.map((table) => {
          const isSelected = isMultiSelectMode
            ? selectedIds.includes(table.id)
            : currentTable?.id === table.id;

          const isDragOver = dragOverId === table.id;
          const isDraggingThis = draggingId === table.id;

          return (
            <div
              key={table.id}
              className={`
                 ${cls.tableItem} 
                 ${isSelected ? cls.selected : ""}
                 ${isDraggingThis ? cls.dragging : ""}
                 ${isDragOver ? cls.dragOver : ""}
               `}
              data-status={table.status || "available"}
              onClick={() => handleTableClick(table)}
              draggable={!isMultiSelectMode}
              onDragStart={(e) => handleDragStart(e, table)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, table)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, table)}
              title={!isMultiSelectMode ? "Kéo thả để gộp bàn" : ""}
            >
              <div className={cls.tableTop}>
                <span className={cls.tableCode}>{table.code}</span>
                <button
                  className={cls.kebab}
                  onClick={(e) => openActionModal(e, table)}
                >
                  <IconDots />
                </button>
              </div>

              <div className={cls.tableMeta}>
                <span className={cls.capacity}>{table.capacity || 4} chỗ</span>
                <span className={cls.statusText}>
                  {table.status === "occupied"
                    ? "Có khách"
                    : table.status === "reserved"
                    ? "Đã đặt"
                    : table.status === "cleaning"
                    ? "Đang dọn"
                    : "Trống"}
                </span>
              </div>

              {isSelected && isMultiSelectMode && (
                <div className={cls.checkOverlay}>
                  <IconCheck />
                </div>
              )}
            </div>
          );
        })}

        {filteredTables.length === 0 && (
          <div className={cls.emptyState}>Không tìm thấy bàn nào</div>
        )}
      </div>

      {/* Modal Actions */}
      {actionTable && (
        <TableActionsModal
          isOpen={actionModalOpen}
          table={actionTable}
          onClose={() => {
            setActionModalOpen(false);
            setActionTable(null);
          }}
          onUpdated={refreshTables}
        />
      )}

      {/* Modal Regular Customer */}
      <RegularCustomerModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelectCustomer={handleSelectRegularCustomer}
      />
    </div>
  );
}
