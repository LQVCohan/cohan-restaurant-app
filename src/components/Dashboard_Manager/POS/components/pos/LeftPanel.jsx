import React, { useState, useMemo, useEffect } from "react";
import cls from "./LeftPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { TableActionsModal } from "../modals/TableActionsModal";
import RegularCustomerModal from "../modals/RegularCustomerModal";
import useTableCustomers from "../../../../../hooks/useTableCustomers";

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
    restaurantId,
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
    setCurrentTable,
    setCurrentOrder,
    setCurrentOrderCode,
    fetchOrderById,
    loadOrdersNow,
    ordersNow,
    ordersLoading,
    deliveryCustomer,
    setDeliveryCustomer,
    shippingInfo,
    setShippingInfo,
  } = usePos();

  // State bộ lọc
  const [currentFloorId, setCurrentFloorId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");

  // State hiển thị accordion (bộ lọc)
  const [showFilters, setShowFilters] = useState(true);

  // State chọn nhiều
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // State Modals
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionTable, setActionTable] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [draftTableCodes, setDraftTableCodes] = useState(new Set());

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
    if (currentOrderType !== "dine_in") {
      setShowFilters(false);
    }
  }, [currentOrderType]);

  // --- HELPER FUNCTIONS ---
  const getLastName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(" ");
    return parts[parts.length - 1];
  };

  const selectedCustomer = deliveryCustomer;

  const { customers: tableCustomers } = useTableCustomers({ restaurantId });

  const tableCustomerMap = useMemo(() => {
    const map = new Map();
    (tableCustomers || []).forEach((c) => {
      if (c.tableId) map.set(String(c.tableId), c);
      if (c.tableCode) map.set(String(c.tableCode).toLowerCase(), c);
    });
    return map;
  }, [tableCustomers]);

  const filteredTables = useMemo(() => {
    let res = tables || [];
    if (currentFloorId !== "all") {
      res = res.filter((t) => String(t.floorId) === String(currentFloorId));
    }
    if (statusFilter !== "all") {
      res = res.filter((t) => t.status === statusFilter);
    }
    const rawQ = searchTerm ?? "";
    const hasTrailingSpace = /\s$/.test(rawQ);
    const q = rawQ.trim().toLowerCase();
    if (q) {
      res = res.filter((t) => {
        const code = (t.code || "").toLowerCase();
        const customer =
          tableCustomerMap.get(String(t.id)) ||
          tableCustomerMap.get(String(t.code || "").toLowerCase());
        const customerName = (customer?.customerName || "").toLowerCase();
        if (hasTrailingSpace) return code === q;
        return code.includes(q) || customerName.includes(q);
      });
    }
    return res;
  }, [tables, currentFloorId, statusFilter, searchTerm, tableCustomerMap]);

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

  useEffect(() => {
    if (!restaurantId) return;
    try {
      const prefix = "pos_draft_";
      const next = new Set();
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const payload = JSON.parse(raw);
        const items = Array.isArray(payload?.items) ? payload.items : [];
        if (!items.length) continue;
        if (payload?.currentOrderType !== "dine_in") continue;
        const tableId = payload?.tableId;
        if (tableId) next.add(String(tableId));
      }
      setDraftTableCodes(next);
    } catch {
      setDraftTableCodes(new Set());
    }
  }, [restaurantId, currentOrder, currentTable?.code]);

  const offPremiseOrders = useMemo(() => {
    const kind =
      currentOrderType === "delivery" ? "delivery" : "takeaway";
    const q = (orderSearchTerm || "").trim().toLowerCase();
    return (ordersNow || [])
      .filter((o) => o.orderType === kind)
      .filter((o) => {
        if (!q) return true;
        const code = (o.orderCode || "").toLowerCase();
        const name = (o.customerInfo?.name || "").toLowerCase();
        return code.includes(q) || name.includes(q);
      });
  }, [ordersNow, currentOrderType, orderSearchTerm]);

  useEffect(() => {
    if (currentOrderType === "dine_in" || !restaurantId) return;
    loadOrdersNow?.({ variables: { restaurantId, limit: 50 } });
  }, [currentOrderType, restaurantId, loadOrdersNow]);

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
      if (hasUnsavedNewItems && currentOrderType === "dine_in") {
        await selectTableForOrder(targetCode, table.capacity, {
          preserveDraftItems: true,
        });
        return;
      }
      await selectTableForOrder(targetCode, table.capacity);
      return;
    }

    selectTableForOrder(targetCode, table.capacity);
  };

  const handleOffPremiseOrderClick = async (order) => {
    if (!order?.id) return;
    const res = await fetchOrderById?.(order.id);
    if (!res?.success || !res?.data) return;

    const payload = res.data;
    const items = (payload.items || []).map((it, idx) => ({
      _lineId: `ord_${payload.orderCode || payload.id}_${idx}`,
      dishId: it.dishId,
      menuId: it.menuId,
      categoryId: it.categoryId,
      name: it.name,
      unit: it.unit,
      price: it.price,
      modifiersPrice: it.modifiersPrice,
      method: it.method,
      note: it.note,
      quantity: it.quantity,
      status: it.status,
      proofImages: it.proofImages || [],
      modifiers: it.modifiers || [],
      isExisting: true,
      isNew: false,
    }));

    setCurrentOrder(items);
    setCurrentOrderCode(payload.orderCode || null);
    setCurrentOrderType(payload.orderType || currentOrderType);
    setCurrentTable({
      id: null,
      code: payload.orderType === "delivery" ? "DELIVERY" : "TAKEAWAY",
      name: payload.orderType === "delivery" ? "Delivery" : "Takeaway",
      status: "occupied",
      type: payload.orderType,
      restaurantId,
      isVirtual: true,
    });
    setDeliveryCustomer({
      id: null,
      name: payload.customerInfo?.name || "",
      phone: payload.customerInfo?.phone || "",
      email: payload.customerInfo?.email || "",
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

        {currentOrderType === "dine_in" && (
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
                    placeholder="Tìm bàn hoặc tên khách..."
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
        )}

        {currentOrderType !== "dine_in" && (
          <div className={cls.filterWrapper}>
            <div className={cls.filterContent}>
              <div className={cls.searchGroup}>
                <input
                  className={cls.search}
                  placeholder="Tìm theo mã đơn hoặc tên khách..."
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {currentOrderType === "dine_in" && (
        <div className={cls.tablesGrid}>
          {filteredTables.map((table) => {
            const isSelected = isMultiSelectMode
              ? selectedIds.includes(table.id)
              : currentTable?.id === table.id;

            const isDragOver = dragOverId === table.id;
            const isDraggingThis = draggingId === table.id;
            const hasDraft = draftTableCodes.has(String(table.id));

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
                  {hasDraft && (
                    <span className={cls.draftDot} title="Có món nháp" />
                  )}
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
      )}

      {currentOrderType !== "dine_in" && (
        <div className={cls.tablesGrid}>
          {ordersLoading && (
            <div className={cls.emptyState}>Đang tải danh sách đơn...</div>
          )}
          {!ordersLoading &&
            offPremiseOrders.map((order) => (
              <div
                key={order.id}
                className={cls.tableItem}
                data-status={order.currentStatus || "pending"}
                onClick={() => handleOffPremiseOrderClick(order)}
              >
                <div className={cls.tableTop}>
                  <span className={cls.tableCode}>{order.orderCode}</span>
                </div>
                <div className={cls.tableMeta}>
                  <span className={cls.capacity}>
                    {order.customerInfo?.name || "Khách lẻ"}
                  </span>
                  <span className={cls.statusText}>
                    {order.currentStatus || "pending"}
                  </span>
                </div>
              </div>
            ))}

          {!ordersLoading && offPremiseOrders.length === 0 && (
            <div className={cls.emptyState}>Chưa có đơn nào</div>
          )}
        </div>
      )}

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

    </div>
  );
}
