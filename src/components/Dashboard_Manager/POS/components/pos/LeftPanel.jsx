import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@apollo/client";
import cls from "./LeftPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { TableActionsModal } from "../modals/TableActionsModal";
import RegularCustomerModal from "../modals/RegularCustomerModal";
import {
  buildTablePaymentRequestMap,
  normalizePosPaymentRequests,
  POS_PAYMENT_REQUESTS_QUERY,
} from "@/utils/posPaymentRequests";
import TableReservationRealtimeBadge from "./TableReservationRealtimeBadge";
import { RESERVATION_EVENT_TYPES, RESERVATION_SOCKET_EVENT } from "@/hooks/useSocketReservation";

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
    resetPosOrderSession,
    switchOffPremiseMode,
    ensureOffPremiseSession,
    createNewOffPremiseOrder,
    tables,
    currentTable,
    currentOrder,
    refetchTables: refreshTables,
    mergeTables,
    currentOrderType,
    setCurrentOrderType,
    startDeliveryOrder,
    startTakeawayOrder,
    selectTableForOrder,
    currentOrderId,
    currentOrderCode,
    setCurrentOrderId,
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

  const { data: paymentRequestData } = useQuery(POS_PAYMENT_REQUESTS_QUERY, {
    variables: { restaurantId, limit: 100 },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const paymentRequests = useMemo(
    () => normalizePosPaymentRequests(paymentRequestData),
    [paymentRequestData],
  );

  const tablePaymentRequestMap = useMemo(
    () => buildTablePaymentRequestMap(paymentRequests),
    [paymentRequests],
  );

  const [currentFloorId, setCurrentFloorId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");

  const [showFilters, setShowFilters] = useState(true);

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionTable, setActionTable] = useState(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [draftTableCodes, setDraftTableCodes] = useState(new Set());

  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [reservationByTableId, setReservationByTableId] = useState(() => new Map());

  useEffect(() => {
    const handler = (event) => {
      const evt = event?.detail?.event;
      const reservation = evt?.reservation || evt?.reservations?.[0] || null;
      const tableId = String(reservation?.tableId || evt?.tableId || "");
      if (!evt?.type || !tableId) return;
      if (restaurantId && reservation?.restaurantId && String(reservation.restaurantId) !== String(restaurantId)) return;

      setReservationByTableId((prev) => {
        const next = new Map(prev);
        if (
          evt.type === RESERVATION_EVENT_TYPES.CANCELLED ||
          evt.type === RESERVATION_EVENT_TYPES.PAYMENT_EXPIRED
        ) {
          next.delete(tableId);
        } else if (evt.type === RESERVATION_EVENT_TYPES.CHECKED_IN) {
          next.set(tableId, { ...reservation, type: evt.type });
          setTimeout(() => {
            setReservationByTableId((curr) => {
              const copy = new Map(curr);
              const row = copy.get(tableId);
              if (row?.type === RESERVATION_EVENT_TYPES.CHECKED_IN) copy.delete(tableId);
              return copy;
            });
          }, 5000);
        } else {
          next.set(tableId, { ...reservation, type: evt.type });
        }
        return next;
      });
    };
    window.addEventListener(RESERVATION_SOCKET_EVENT, handler);
    return () => window.removeEventListener(RESERVATION_SOCKET_EVENT, handler);
  }, [restaurantId]);

  const tabs = useMemo(
    () => [
      { key: "dine_in", label: "Bàn ăn" },
      { key: "delivery", label: "Giao hàng" },
      { key: "takeaway", label: "Mang về" },
    ],
    [],
  );

  useEffect(() => {
    if (currentOrderType !== "dine_in") {
      setShowFilters(false);
    }
  }, [currentOrderType]);

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
    const rawQ = searchTerm ?? "";
    const hasTrailingSpace = /\s$/.test(rawQ);
    const q = rawQ.trim().toLowerCase();
    if (q) {
      res = res.filter((t) => {
        const code = (t.code || "").toLowerCase();
        if (hasTrailingSpace) return code === q;
        return code.includes(q);
      });
    }
    return res;
  }, [tables, currentFloorId, statusFilter, searchTerm]);

  const hasAnyCurrentItems = useMemo(() => {
    return Array.isArray(currentOrder) && currentOrder.length > 0;
  }, [currentOrder]);

  const hasCustomerDraft = useMemo(() => {
    return Boolean(
      deliveryCustomer?.id ||
        deliveryCustomer?.name ||
        deliveryCustomer?.fullName ||
        deliveryCustomer?.phone ||
        deliveryCustomer?.email ||
        shippingInfo?.fullName ||
        shippingInfo?.phone ||
        shippingInfo?.email ||
        shippingInfo?.address ||
        shippingInfo?.note,
    );
  }, [deliveryCustomer, shippingInfo]);

  const hasUnsavedDraftItems = useMemo(() => {
    return (
      Array.isArray(currentOrder) &&
      currentOrder.some((it) => {
        if (it?.isNew) return true;
        if (!it?.isExisting && Number(it?.quantity || 0) > 0) return true;
        return false;
      })
    );
  }, [currentOrder]);

  const hasLoadedSavedOffPremiseOrder = useMemo(() => {
    return Boolean(
      currentOrderId ||
        (currentOrderCode &&
          hasAnyCurrentItems &&
          currentOrder?.some((it) => it?.isExisting && !it?.isNew)),
    );
  }, [currentOrderId, currentOrderCode, hasAnyCurrentItems, currentOrder]);

  const counts = useMemo(() => {
    const all = tables.length;
    const available = tables.filter((t) => t.status === "available").length;
    const occupied = tables.filter((t) => t.status === "occupied").length;
    return { all, available, occupied };
  }, [tables]);

  useEffect(() => {
    if (!restaurantId) return;
    try {
      const prefix = `pos_draft_table_${restaurantId}_`;
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
        const tableCode = payload?.tableCode;
        if (tableId) next.add(String(tableId));
        if (!tableId && tableCode) next.add(String(tableCode).toLowerCase());
      }
      setDraftTableCodes(next);
    } catch {
      setDraftTableCodes(new Set());
    }
  }, [restaurantId, currentOrder, currentTable?.code]);

  const offPremiseOrders = useMemo(() => {
    const kind = currentOrderType === "delivery" ? "delivery" : "takeaway";
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

  const handleTableClick = async (table) => {
    if (isMultiSelectMode) {
      setSelectedIds((prev) =>
        prev.includes(table.id)
          ? prev.filter((id) => id !== table.id)
          : [...prev, table.id],
      );
      return;
    }

    const targetCode = table.code;
    const currentCode = currentTable?.code;
    const switching =
      currentCode && targetCode && String(currentCode) !== String(targetCode);

    if (
      ((currentOrderType === "delivery" || currentOrderType === "takeaway") &&
        switching) ||
      (currentOrderType === "dine_in" && switching && hasUnsavedDraftItems)
    ) {
      if (hasUnsavedDraftItems && currentOrderType === "dine_in") {
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

    if (currentOrderId && String(currentOrderId) === String(order.id)) {
      return;
    }

    const shouldConfirmOpenOtherOrder =
      hasUnsavedDraftItems || (!currentOrderId && hasCustomerDraft);

    if (shouldConfirmOpenOtherOrder) {
      const ok = window.confirm(
        "Bạn đang có đơn/món nháp hoặc thông tin khách chưa lưu. Mở đơn khác sẽ thay thế nội dung hiện tại. Bạn có muốn tiếp tục?",
      );

      if (!ok) return;
    }
    const res = await fetchOrderById?.(order.id);
    if (!res?.success || !res?.data) return;

    const payload = res.data;
    const items = (payload.items || []).map((it, idx) => ({
      _lineId: `ord_${payload.orderCode || payload.id}_${idx}`,
      orderId: payload.id || order.id || null,
      orderCode: payload.orderCode || null,
      dishId: it.dishId,
      menuId: it.menuId,
      categoryId: it.categoryId,
      name: it.name,
      unit: it.unit,
      price: it.price,
      modifiersPrice: it.modifiersPrice,
      method: it.method,
      note: it.note,
      priority: it.priority,
      quantity: it.quantity,
      status: it.status,
      proofImages: it.proofImages || [],
      modifiers: it.modifiers || [],
      isExisting: true,
      isNew: false,
    }));

    setCurrentOrder(items);
    setCurrentOrderCode(payload.orderCode || null);
    setCurrentOrderId?.(payload.id || order.id || null);
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
      id: payload.userId || null,
      name: payload.customerInfo?.name || payload.shipping?.fullName || "",
      phone: payload.customerInfo?.phone || payload.shipping?.phone || "",
      email: payload.customerInfo?.email || payload.shipping?.email || "",
      note: payload.customerInfo?.note || payload.shipping?.note || "",
    });
    setShippingInfo((prev) => ({
      ...prev,
      fullName: payload.shipping?.fullName || payload.customerInfo?.name || "",
      phone: payload.shipping?.phone || payload.customerInfo?.phone || "",
      email: payload.shipping?.email || payload.customerInfo?.email || "",
      address: payload.shipping?.address || "",
      note: payload.shipping?.note || payload.customerInfo?.note || "",
      deliveryMethod:
        payload.shipping?.deliveryMethod || prev.deliveryMethod || "ship_now",
      deliveryTime: payload.shipping?.deliveryTime || "",
      scheduleDate: payload.shipping?.scheduleDate || "",
      scheduleTime: payload.shipping?.scheduleTime || "",
    }));
  };

  const openActionModal = (e, table) => {
    e.stopPropagation();
    setActionTable(table);
    setActionModalOpen(true);
  };

  const handleSelectRegularCustomer = (customer) => {
    if (!customer) return;
    const { id, name, phone, email, isNew, shippingInfo: ship } = customer;

    setDeliveryCustomer({
      id: id || null,
      name,
      phone,
      email: email || "",
      isNew: !!isNew,
      customerIdentityMode: customer.customerIdentityMode || null,
      source: customer.source || null,
      conflict: !!customer.conflict,
    });

    if (ship) {
      setShippingInfo((prev) => ({ ...prev, ...ship }));
    }
    setCustomerModalOpen(false);
  };

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
        `Bạn có chắc muốn gộp bàn đang kéo vào bàn ${targetTable.code}?`,
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
  const handleChangeOrderType = (nextType) => {
    if (!nextType || nextType === currentOrderType) return;

    if (nextType === "delivery" || nextType === "takeaway") {
      const isSwitchingBetweenOffPremise =
        currentOrderType === "delivery" || currentOrderType === "takeaway";

      if (isSwitchingBetweenOffPremise && hasUnsavedDraftItems) {
        const ok = window.confirm(
          "Đơn hiện tại có món nháp chưa lưu. Chuyển loại đơn sẽ lưu nháp hiện tại và mở nháp của loại đơn mới. Bạn có muốn tiếp tục?",
        );

        if (!ok) return;
      }

      switchOffPremiseMode?.(nextType);
      return;
    }

    if (hasUnsavedDraftItems) {
      const ok = window.confirm(
        "Đơn hiện tại có món nháp chưa lưu. Chuyển sang bàn ăn sẽ rời khỏi đơn hiện tại. Bạn có muốn tiếp tục?",
      );

      if (!ok) return;
    }

    resetPosOrderSession?.(nextType);
  };
  const handleCreateOffPremiseOrder = () => {
    if (currentOrderType !== "delivery" && currentOrderType !== "takeaway") {
      return;
    }

    const shouldConfirm = hasAnyCurrentItems || hasLoadedSavedOffPremiseOrder;

    if (shouldConfirm) {
      const ok = window.confirm(
        "Tạo đơn mới sẽ xóa món/order đang hiển thị khỏi màn hình hiện tại. Bạn có muốn tiếp tục?",
      );

      if (!ok) return;
    }

    createNewOffPremiseOrder?.(currentOrderType, {
      preserveCustomer: true,
    });
  };
  return (
    <div className={cls.wrapper}>
      <div className={cls.header}>
        <div className={cls.navTabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${cls.tab} ${
                currentOrderType === t.key ? cls.active : ""
              }`}
              onClick={() => {
                handleChangeOrderType(t.key);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cls.controls}>
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

        {currentOrderType === "delivery" && (
          <div className={cls.newOrderBox}>
            <h4>Đơn Giao hàng</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={handleCreateOffPremiseOrder}
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

        {currentOrderType === "takeaway" && (
          <div className={cls.newOrderBox}>
            <h4>Đơn Mang về</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={handleCreateOffPremiseOrder}
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
            const hasDraft =
              draftTableCodes.has(String(table.id)) ||
              draftTableCodes.has(String(table.code || "").toLowerCase());
            const tablePaymentRequest = tablePaymentRequestMap.get(
              String(table.code || "").trim().toUpperCase(),
            );
            const reservationActivity =
              reservationByTableId.get(String(table.id)) ||
              (table.status === "reserved"
                ? { type: RESERVATION_EVENT_TYPES.CONFIRMED, tableId: table.id }
                : null);

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
                  <span className={cls.capacity}>
                    {table.capacity || 4} chỗ
                  </span>
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

                {(tablePaymentRequest || reservationActivity) && (
                  <div className={cls.badgeStack}>
                    {tablePaymentRequest ? (
                      <span className={cls.paymentRequestBadge}>Yêu cầu thanh toán</span>
                    ) : null}
                    <TableReservationRealtimeBadge activity={reservationActivity} />
                  </div>
                )}

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
                data-status={
                  (order.shipping?.address || "").trim() ||
                  order.currentStatus ||
                  "pending"
                }
                onClick={() => handleOffPremiseOrderClick(order)}
              >
                <div className={cls.tableTop}>
                  <span className={cls.tableCode}>{order.orderCode}</span>
                </div>
                <div className={cls.tableMeta}>
                  <span className={cls.capacity}>
                    {order.customerInfo?.name ||
                      order.shipping?.fullName ||
                      order.customerInfo?.phone ||
                      order.shipping?.phone ||
                      "Khách lẻ"}
                  </span>
                  <span className={cls.statusText}>
                    {(order.shipping?.address || "").trim() ||
                      order.currentStatus ||
                      "pending"}
                  </span>
                </div>
              </div>
            ))}

          {!ordersLoading && offPremiseOrders.length === 0 && (
            <div className={cls.emptyState}>Chưa có đơn nào</div>
          )}
        </div>
      )}

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
