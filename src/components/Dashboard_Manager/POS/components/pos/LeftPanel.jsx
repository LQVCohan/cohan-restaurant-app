import React, { useState, useMemo, useEffect } from "react";
import cls from "./LeftPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { TableActionsModal } from "../modals/TableActionsModal";
import RegularCustomerModal from "../modals/RegularCustomerModal";
import SwitchTableConfirmModal from "../modals/SwitchTableConfirmModal";

/* --- ICONS --- */
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
const IconFilter = () => (
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
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);
const IconChevron = ({ expanded }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform 0.2s",
    }}
  >
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

export default function LeftPanel() {
  const {
    floors,
    tables,
    currentTable,
    currentOrder,
    refreshTables,
    mergeTables,
    currentOrderType, // Loại đơn: 'dine_in', 'delivery', 'takeaway'
    setCurrentOrderType,
    startDeliveryOrder, // Action: Bắt đầu đơn giao hàng
    startTakeawayOrder, // Action: Bắt đầu đơn mang về
    selectTableForOrder,
    deliveryCustomer,
    setDeliveryCustomer,
    shippingInfo,
    setShippingInfo,
  } = usePos();

  // State bộ lọc
  const [currentFloorId, setCurrentFloorId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // State hiển thị accordion (bộ lọc)
  const [showFilters, setShowFilters] = useState(true);

  // State chọn nhiều
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // State Modals
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionTable, setActionTable] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState(null);
  const [pendingDraftItems, setPendingDraftItems] = useState([]);

  // Drag & Drop
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  // Danh sách Tabs
  const tabs = useMemo(
    () => [
      { key: "dine_in", label: "Bàn ăn" },
      { key: "delivery", label: "Giao hàng" },
      { key: "takeaway", label: "Mang về" },
    ],
    []
  );

  // --- EFFECT: TỰ ĐỘNG ĐÓNG/MỞ BỘ LỌC KHI CHUYỂN TAB ---
  useEffect(() => {
    if (currentOrderType === "dine_in") {
      setShowFilters(true); // Bàn ăn cần nhìn sơ đồ -> Mở
    } else {
      setShowFilters(false); // Giao hàng/Mang về cần không gian -> Đóng
    }
  }, [currentOrderType]);

  // --- HELPER FUNCTIONS ---
  const getLastName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ");
    return parts[parts.length - 1];
  };

  const selectedCustomer = deliveryCustomer;

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

  const hasUnsavedNewItems = useMemo(() => {
    return (
      Array.isArray(currentOrder) &&
      currentOrder.some((it) => it?.isNew || (!it?.isExisting && it?.quantity))
    );
  }, [currentOrder]);

  const counts = useMemo(() => {
    const all = tables.length;
    const available = tables.filter((t) => t.status === "available").length;
    const occupied = tables.filter((t) => t.status === "occupied").length;
    return { all, available, occupied };
  }, [tables]);

  // --- HANDLERS ---
  const handleTableClick = async (table) => {
    if (isMultiSelectMode) {
      setSelectedIds((prev) =>
        prev.includes(table.id)
          ? prev.filter((id) => id !== table.id)
          : [...prev, table.id]
      );
      return;
    }

    const targetCode = table.code;
    const currentCode = currentTable?.code;
    const switching =
      currentCode && targetCode && String(currentCode) !== String(targetCode);

    // Xử lý chuyển bàn khi đang có món mới chưa lưu
    if (
      ((currentOrderType === "delivery" || currentOrderType === "takeaway") &&
        switching) ||
      (currentOrderType === "dine_in" && switching && hasUnsavedNewItems)
    ) {
      if (hasUnsavedNewItems) {
        setPendingDraftItems(currentOrder);
        setSwitchTarget(table);
        setSwitchConfirmOpen(true);
        return;
      }
      await selectTableForOrder(targetCode, table.capacity);
      return;
    }

    selectTableForOrder(targetCode, table.capacity);
  };

  const confirmSwitch = async () => {
    const t = switchTarget;
    const drafts = pendingDraftItems;
    setSwitchConfirmOpen(false);
    setSwitchTarget(null);
    setPendingDraftItems([]);

    if (!t) return;
    await selectTableForOrder(t.code, t.capacity, {
      preserveDraftItems: drafts,
    });
  };

  const openActionModal = (e, table) => {
    e.stopPropagation();
    setActionTable(table);
    setActionModalOpen(true);
  };

  const handleSelectRegularCustomer = (customer) => {
    if (!customer) return;
    const { id, name, phone, isNew, shippingInfo: ship } = customer;

    setDeliveryCustomer({
      id: id || null,
      name: name,
      phone: phone,
      isNew: !!isNew,
    });

    if (ship) {
      setShippingInfo((prev) => ({ ...prev, ...ship }));
    }
    setCustomerModalOpen(false);
  };

  // --- DRAG & DROP HANDLERS ---
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
    if (draggingId && draggingId !== targetTable.id)
      setDragOverId(targetTable.id);
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
        alert("Gộp bàn thất bại.");
      }
    }
  };

  return (
    <div className={cls.wrapper}>
      {/* 1. HEADER (TABS) */}
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

      <div className={cls.controls}>
        {/* 2. ACTIONS THEO TỪNG LOẠI ĐƠN */}

        {/* === Bàn ăn === */}
        {currentOrderType === "dine_in" && (
          <div className={cls.newOrderBox}>
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

        {/* === Giao hàng === */}
        {currentOrderType === "delivery" && (
          <div className={cls.newOrderBox}>
            <h4>Đơn Giao hàng</h4>
            <div className={cls.newOrderActions}>
              {/* Nút này kích hoạt tạo đơn mới */}
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={startDeliveryOrder}
              >
                + Tạo đơn mới
              </button>
              <button
                className={`${cls.btn} ${selectedCustomer ? cls.ghost : ""}`}
                onClick={() => setCustomerModalOpen(true)}
                title={selectedCustomer ? selectedCustomer.name : "Chọn khách"}
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

        {/* === Mang về === */}
        {currentOrderType === "takeaway" && (
          <div className={cls.newOrderBox}>
            <h4>Đơn Mang về</h4>
            <div className={cls.newOrderActions}>
              {/* Nút này kích hoạt tạo đơn mới */}
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={startTakeawayOrder}
              >
                + Tạo đơn mới
              </button>
              <button
                className={`${cls.btn} ${selectedCustomer ? cls.ghost : ""}`}
                onClick={() => setCustomerModalOpen(true)}
                title={selectedCustomer ? selectedCustomer.name : "Chọn khách"}
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

        {/* 3. BỘ LỌC & THAO TÁC BÀN (COLLAPSIBLE) */}
        <div className={cls.filterWrapper}>
          <button
            className={cls.filterToggleBtn}
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className={cls.filterTitle}>
              <IconFilter />
              <span>Bộ lọc & Thao tác bàn</span>
              <span className={cls.filterBadge}>
                {currentFloorId !== "all" ||
                statusFilter !== "all" ||
                searchTerm
                  ? "•"
                  : ""}
              </span>
            </div>
            <IconChevron expanded={showFilters} />
          </button>

          {showFilters && (
            <div className={cls.filterContent}>
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
                  placeholder="Tìm số bàn..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

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

              <div className={cls.toolbar}>
                <button
                  className={`${cls.btn} ${
                    isMultiSelectMode ? cls.primary : cls.ghost
                  } ${cls.btnSm}`}
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
                    className={`${cls.btn} ${cls.primary} ${cls.btnSm}`}
                    onClick={() => alert("Xử lý hàng loạt")}
                  >
                    Xử lý ({selectedIds.length})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. TABLES GRID */}
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

      {/* MODALS */}
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

      <RegularCustomerModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelectCustomer={handleSelectRegularCustomer}
      />

      <SwitchTableConfirmModal
        isOpen={switchConfirmOpen}
        fromLabel={
          currentOrderType === "delivery"
            ? "Đơn giao"
            : currentOrderType === "takeaway"
            ? "Đơn mang về"
            : currentTable?.code
        }
        toLabel={switchTarget?.code}
        itemCount={pendingDraftItems?.length || 0}
        onCancel={() => {
          setSwitchConfirmOpen(false);
          setSwitchTarget(null);
          setPendingDraftItems([]);
        }}
        onConfirm={confirmSwitch}
      />
    </div>
  );
}
