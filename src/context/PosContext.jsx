/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";

import useMenuManagement from "../hooks/useMenuManagement";
import useFloorManagement from "../hooks/useFloorManagement";
import useTableManagement from "../hooks/useTableManagement";
import useOrderManagement from "../hooks/useOrderManagement";
import { useNotification } from "../hooks/useNotification";
import useSocketOrder from "@/hooks/useSocketOrder";

const PosContext = createContext(undefined);

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used within a <PosProvider>.");
  return ctx;
}

export default function PosProvider({
  children,
  restaurantId,
  initialFloorId = null,
  initialFloorLevel = null,
}) {
  const { showNotification } = useNotification();

  // --- BASE STATES ---
  const [currentFloor, setCurrentFloor] = useState(1);
  const [currentTable, setCurrentTable] = useState(null);
  const [currentOrderType, setCurrentOrderType] = useState("dine_in");
  const [tableOrders, setTableOrders] = useState({});
  const [currentOrder, setCurrentOrder] = useState([]);

  // ✅ NEW: currentOrderCode tách khỏi currentTable.code
  const [currentOrderCode, setCurrentOrderCode] = useState(null);

  const [menuItems, setMenuItems] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [printers, setPrinters] = useState({});
  const [selectedPrintType, setSelectedPrintType] = useState("kitchen");
  const [printQueue, setPrintQueue] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);

  // 🔹 Shipping + Customer cho off-premise (delivery/takeaway)
  const [shippingInfo, setShippingInfo] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    note: "",
    deliveryMethod: "ship_now",
    deliveryTime: "",
    scheduleDate: "",
    scheduleTime: "",
  });

  const [deliveryCustomer, setDeliveryCustomer] = useState(null);
  const skipDraftAutosaveRef = useRef(false);

  // --- FLOORS ---
  const {
    floors,
    floorsLoading,
    floorsError,
    refetchFloors,
    activeLevel,
    setActiveLevel,
    getIdFromLevel,
    getLevelFromId,
  } = useFloorManagement({ restaurantId, initialFloorId, initialFloorLevel });

  const activeFloorId = useMemo(
    () => (activeLevel != null ? getIdFromLevel(activeLevel) : null),
    [activeLevel, getIdFromLevel]
  );

  const setActiveFloorId = useCallback(
    (idOrNull) => {
      if (!idOrNull) return setActiveLevel(null);
      const lvl = getLevelFromId(idOrNull);
      setActiveLevel(lvl ?? null);
    },
    [getLevelFromId, setActiveLevel]
  );

  const getTimeSlotForNow = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "breakfast";
    if (hour >= 11 && hour < 16) return "lunch";
    if (hour >= 16 && hour < 22) return "dinner";
    return "late_night";
  }, []);

  const [autoTimeSlot, setAutoTimeSlot] = useState(getTimeSlotForNow);

  useEffect(() => {
    const timer = setInterval(() => {
      setAutoTimeSlot(getTimeSlotForNow());
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [getTimeSlotForNow]);

  // --- MENU ---
  const {
    menus,
    timeSlotOptions,
    selectedTimeSlot,
    setSelectedTimeSlot,
    itemsWithPrice,
  } = useMenuManagement({
    restaurantId,
    defaultTimeSlot: autoTimeSlot,
    pageSize: 100,
  });

  // --- TABLES ---
  const {
    tables: allTables,
    refetchTables,
    setTableStatus,
    mergeTables,
    splitTables,
    fetchTableByCode,
  } = useTableManagement({ restaurantId });

  // --- SOCKET ---
  useSocketOrder(restaurantId, {
    onCreated: (order) => {
      showNotification(`🆕 Đơn mới: ${order.orderCode}`, "info");
      refetchTables?.();
    },
    onUpdated: (order) => {
      showNotification(`♻️ Cập nhật đơn ${order.orderCode}`, "success");
    },
    onStatusChanged: (order) => {
      showNotification(
        `🔁 ${order.orderCode} → ${order.currentStatus}`,
        "info"
      );
    },
    onCancelled: (order) => {
      showNotification(`❌ Đơn ${order.orderCode} đã bị hủy`, "warning");
      refetchTables?.();
    },
  });

  // --- TABLE FILTERS ---
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const tables = useMemo(() => {
    let list = allTables || [];
    if (activeLevel != null) {
      list = list.filter((t) => Number(t.floorLevel) === Number(activeLevel));
    }
    if (statusFilter && statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (typeFilter && typeFilter !== "all") {
      list = list.filter(
        (t) => (t.type || "").toLowerCase() === typeFilter.toLowerCase()
      );
    }

    const rawQ = tableSearch ?? "";
    const hasTrailingSpace = /\s$/.test(rawQ);
    const qNoTrail = rawQ.replace(/\s+$/, "").toLowerCase();

    if (rawQ.length > 0) {
      list = list.filter((t) => {
        const code = (t.code || "").toLowerCase();
        const status = (t.status || "").toLowerCase();
        const type = (t.type || "").toLowerCase();
        const tags = Array.isArray(t.tags)
          ? t.tags.join(" ").toLowerCase()
          : "";

        if (hasTrailingSpace) return code === qNoTrail;
        if (qNoTrail && code.startsWith(qNoTrail)) return true;
        return (
          status.includes(qNoTrail) ||
          type.includes(qNoTrail) ||
          tags.includes(qNoTrail)
        );
      });
    }
    return list;
  }, [allTables, activeLevel, statusFilter, typeFilter, tableSearch]);

  // --- ORDER MANAGEMENT HOOK ---
  const {
    addToOrder,
    updateItemQty,
    removeItem,
    clearAll,
    saveOrder: rawSaveOrder,
    fetchOrderByTable,
    fetchOrderById,
    orderById,
    totals,
    orderNote,
    setOrderNote,
    updateOrderCustomerByCode,
    loadGroupsForTable,
    loadOrdersNow,
    ordersNow,
    ordersLoading,
    preparePayment,
    checkoutOrder,
  } = useOrderManagement({
    currentOrder,
    setCurrentOrder,
    tableOrders,
    currentTable,
    setTableOrders,
    restaurantId,
    currentOrderType,
    deliveryCustomer,
    shippingInfo,
    currentOrderCode,
    setCurrentOrderCode,
  });

  // --- [UTILITY] GENERATE VIRTUAL CODE ---
  const generateVirtualCode = useCallback((prefix) => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const randomPart = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
    return `${prefix}-${yyyy}${mm}${dd}-${randomPart}`;
  }, []);

  const getDraftKeyForTable = useCallback(
    (tableId) => {
      if (!tableId) return null;
      return `pos_draft_table_${restaurantId}_${tableId}`;
    },
    [restaurantId]
  );

  // ===== Draft key (autosave FE) =====
  const getDraftKey = useCallback(() => {
    if (currentOrderCode) return `pos_draft_${currentOrderCode}`;
    if (currentOrderType === "delivery")
      return `pos_draft_ship_${restaurantId}`;
    if (currentOrderType === "takeaway")
      return `pos_draft_take_${restaurantId}`;
    return null;
  }, [currentOrderCode, currentOrderType, restaurantId]);

  // ===== Auto-save only isNew (FE) =====
  useEffect(() => {
    const isDineIn = currentOrderType === "dine_in";
    const tableId = currentTable?.id || null;
    const key = isDineIn ? getDraftKeyForTable(tableId) : getDraftKey();
    if (!key) return;
    if (skipDraftAutosaveRef.current) {
      skipDraftAutosaveRef.current = false;
      return;
    }
    try {
      const draftItems = (currentOrder || []).filter((i) => i?.isNew);
      if (draftItems.length === 0) {
        localStorage.removeItem(key);
        return;
      }
      const payload = {
        version: 1,
        savedAt: Date.now(),
        currentOrderType,
        currentOrderCode,
        tableId,
        tableCode: currentTable?.code || null,
        items: draftItems,
        shippingInfo:
          currentOrderType === "delivery" ? shippingInfo : undefined,
        deliveryCustomer:
          currentOrderType === "delivery" || currentOrderType === "takeaway"
            ? deliveryCustomer
            : undefined,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }, [
    currentOrder,
    currentOrderType,
    currentOrderCode,
    currentTable?.id,
    currentTable?.code,
    shippingInfo,
    deliveryCustomer,
    getDraftKey,
    getDraftKeyForTable,
  ]);

  // ===== Restore draft when context changes =====
  useEffect(() => {
    const isDineIn = currentOrderType === "dine_in";
    const tableId = currentTable?.id || null;
    const key = isDineIn ? getDraftKeyForTable(tableId) : getDraftKey();
    if (!key) return;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const payload = JSON.parse(raw);
      const collected = Array.isArray(payload?.items) ? payload.items : [];
      if (collected.length) {
        setCurrentOrder((prev) => {
          const prevExisting = (prev || []).filter((i) => i?.isExisting);
          return [...prevExisting, ...collected];
        });
      }
      if (
        (currentOrderType === "delivery" || currentOrderType === "takeaway") &&
        payload?.deliveryCustomer
      ) {
        setDeliveryCustomer(payload.deliveryCustomer);
      }

      if (currentOrderType === "delivery" && payload?.shippingInfo) {
        setShippingInfo((s) => ({ ...s, ...payload.shippingInfo }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentOrderCode,
    currentOrderType,
    currentTable?.id,
    currentTable?.code,
    getDraftKey,
    getDraftKeyForTable,
  ]);

  const clearDraftStorage = useCallback(() => {
    const isDineIn = currentOrderType === "dine_in";
    const tableId = currentTable?.id || null;
    const key = isDineIn ? getDraftKeyForTable(tableId) : getDraftKey();
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {}
  }, [currentOrderType, currentTable?.id, getDraftKey, getDraftKeyForTable]);

  // --- [NEW] START DELIVERY ORDER ---
  const startDeliveryOrder = useCallback(() => {
    const shipCode = generateVirtualCode("SHIP");
    setCurrentOrderType("delivery");
    setCurrentOrderCode(shipCode);

    // currentTable.code là "table code" theo bạn: off-premise vẫn có 1 mã cố định
    setCurrentTable({
      id: null,
      code: "DELIVERY",
      name: "Delivery",
      status: "occupied",
      type: "delivery",
      restaurantId,
      isVirtual: true,
    });

    setCurrentOrder([]);
    setShippingInfo({
      fullName: "",
      phone: "",
      email: "",
      address: "",
      note: "",
      deliveryMethod: "ship_now",
      deliveryTime: "",
      scheduleDate: "",
      scheduleTime: "",
    });
    setDeliveryCustomer(null);
  }, [restaurantId, generateVirtualCode]);

  // --- [NEW] START TAKEAWAY ORDER ---
  const startTakeawayOrder = useCallback(() => {
    const takeCode = generateVirtualCode("TAKE");
    setCurrentOrderType("takeaway");
    setCurrentOrderCode(takeCode);

    setCurrentTable({
      id: null,
      code: "TAKEAWAY",
      name: "Takeaway",
      status: "occupied",
      type: "takeaway",
      restaurantId,
      isVirtual: true,
    });

    setCurrentOrder([]);
    setShippingInfo({
      fullName: "",
      phone: "",
      email: "",
      address: "",
      note: "",
      deliveryMethod: "pickup_at_store",
      deliveryTime: "",
      scheduleDate: "",
      scheduleTime: "",
    });
    setDeliveryCustomer(null);
  }, [restaurantId, generateVirtualCode]);

  // ===== helper: detect isNew items =====
  const hasNewDraftItems = useCallback(() => {
    return (currentOrder || []).some((i) => i?.isNew);
  }, [currentOrder]);

  // --- SELECT TABLE LOGIC (DINE-IN) ---
  const selectTableForOrder = useCallback(
    async (code, capacity, options = {}) => {
      const table =
        (allTables || []).find(
          (t) => (t.code || "").toLowerCase() === code.toLowerCase()
        ) || null;
      if (!table) return;

      const statusTable = table?.status || "available";

      if (statusTable === "offline") {
        showNotification(`Bàn ${code} đang ngoại tuyến.`, "error");
        return;
      }
      if (statusTable === "cleaning") {
        showNotification(`Bàn ${code} đang dọn dẹp.`, "warning");
        return;
      }

      const switchingToDifferentTable =
        currentOrderType === "dine_in" &&
        currentTable?.code &&
        currentTable.code !== code;

      if (switchingToDifferentTable || !currentTable?.code) {
        skipDraftAutosaveRef.current = true;
      }

      // giữ món mới để append lại sau khi load BE group
      const draftNew = (currentOrder || []).filter((i) => i?.isNew);
      const preserveDraftItems =
        options?.preserveDraftItems !== false &&
        switchingToDifferentTable &&
        currentTable?.code &&
        draftNew.length > 0;

      if (preserveDraftItems) {
        const tableId = currentTable?.id || null;
        const oldKey = getDraftKeyForTable(tableId);
        if (oldKey) {
          try {
            localStorage.setItem(
              oldKey,
              JSON.stringify({
                version: 1,
                savedAt: Date.now(),
                currentOrderType,
                currentOrderCode,
                tableId,
                tableCode: currentTable.code,
                items: draftNew,
              })
            );
          } catch {}
        }
        skipDraftAutosaveRef.current = true;
        setCurrentOrder((prev) => (prev || []).filter((i) => i?.isExisting));
      }

      let groupsForTable = [];
      try {
        groupsForTable =
          (await loadGroupsForTable({ restaurantId, tableCode: code })) || [];
      } catch (e) {
        console.warn(e);
      }

      const hasOrders =
        Array.isArray(groupsForTable) && groupsForTable.length > 0;

      // chọn bàn + orderCode từ BE nếu có
      const serverOrderCode = hasOrders ? groupsForTable[0]?.orderCode : null;

      setCurrentTable({
        id: table?.id,
        code,
        capacity,
        status: hasOrders ? "occupied" : statusTable,
        restaurantId,
        isVirtual: false,
      });

      setCurrentOrderType("dine_in");
      setCurrentOrderCode(serverOrderCode || null);

      // sau khi loadGroupsForTable hook đã setCurrentOrder thành items existing,
      // ta append món isNew lại (nếu có)
      if (draftNew.length && !preserveDraftItems) {
        setCurrentOrder((prev) => {
          const prevArr = Array.isArray(prev) ? prev : [];
          const existingPart = prevArr.filter((i) => i?.isExisting);
          return [...existingPart, ...draftNew];
        });
      }

      if (hasOrders) {
        if (
          (statusTable === "available" || statusTable === "reserved") &&
          table?.id
        ) {
          try {
            await setTableStatus({ id: table.id, status: "occupied" });
          } catch {}
        }
        return;
      }

      if (!hasOrders && statusTable === "available") {
        showNotification(`Đã chọn bàn ${code}.`, "success");
        return;
      }

      showNotification(`Bàn ${code} đang được đặt.`, "info");
    },
    [
      allTables,
      restaurantId,
      loadGroupsForTable,
      setCurrentOrder,
      setCurrentTable,
      setCurrentOrderType,
      setCurrentOrderCode,
      setTableStatus,
      showNotification,
      currentOrder,
      currentOrderType,
      currentTable?.code,
      currentOrderCode,
      getDraftKey,
    ]
  );

  const filteredMenu = useMemo(() => {
    const q = (searchTerm || "").toLowerCase().trim();
    const byCat = (i) =>
      currentCategory === "all" || (i.category || "main") === currentCategory;
    const bySearch = (i) =>
      !q ||
      i.name?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q);
    return (itemsWithPrice || []).filter((i) => byCat(i) && bySearch(i));
  }, [itemsWithPrice, currentCategory, searchTerm]);

  // ===== save wrapper: validate FE rules =====
  const saveOrderSafe = useCallback(
    async (opts = {}) => {
      // không lưu order rỗng
      if (!Array.isArray(currentOrder) || currentOrder.length === 0) {
        return { success: false, message: "Chưa có món ăn nào trong đơn." };
      }

      // dine-in bắt buộc chọn bàn
      if (currentOrderType === "dine_in" && !currentTable?.code) {
        return { success: false, message: "Vui lòng chọn bàn trước khi lưu." };
      }

      // delivery: bắt buộc có địa chỉ (giữ nguyên rule)
      if (currentOrderType === "delivery") {
        const addr = (shippingInfo?.address || "").trim();
        if (!addr) {
          return { success: false, message: "Đơn giao đi cần địa chỉ." };
        }
      }

      const res = await rawSaveOrder({
        ...opts,
        restaurantId,
      });

      // nếu server trả orderCode thì sync lại currentOrderCode (không đụng tableCode)
      const savedOrderCode =
        res?.data?.orderCode || res?.data?.order?.orderCode;
      if (res?.success && savedOrderCode) {
        setCurrentOrderCode(savedOrderCode);
      }

      if (
        res?.success &&
        currentOrderType === "dine_in" &&
        currentTable?.id &&
        !currentTable?.isVirtual
      ) {
        try {
          await setTableStatus({ id: currentTable.id, status: "occupied" });
        } catch {}
        setCurrentTable((prev) =>
          prev ? { ...prev, status: "occupied" } : prev
        );
      }

      // nếu lưu xong (thành công) và bạn muốn clear draft FE:
      // (mình KHÔNG auto clear ở đây để tránh mất draft khi BE chưa hoàn thiện)
      // clearDraftStorage();

      return res;
    },
    [
      rawSaveOrder,
      restaurantId,
      currentOrder,
      currentOrderType,
      currentTable?.code,
      currentTable?.id,
      currentTable?.isVirtual,
      shippingInfo?.address,
      setCurrentTable,
      setTableStatus,
      setCurrentOrderCode,
    ]
  );

  const value = useMemo(
    () => ({
      restaurantId,

      floors,
      floorsLoading,
      floorsError,
      refetchFloors,
      activeLevel,
      setActiveLevel,
      getIdFromLevel,
      getLevelFromId,
      activeFloorId,
      setActiveFloorId,

      tables,
      refetchTables,
      fetchTableByCode,

      tableSearch,
      setTableSearch,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,
      setTableStatus,
      mergeTables,
      splitTables,

      currentFloor,
      setCurrentFloor,

      currentTable,
      setCurrentTable,

      currentOrderType,
      setCurrentOrderType,

      // ✅ expose orderCode
      currentOrderCode,
      setCurrentOrderCode,

      currentOrder,
      setCurrentOrder,

      tableOrders,
      setTableOrders,

      selectTableForOrder,
      startDeliveryOrder,
      startTakeawayOrder,

      shippingInfo,
      setShippingInfo,
      deliveryCustomer,
      setDeliveryCustomer,

      addToOrder,
      updateItemQty,
      removeItem,

      saveOrder: saveOrderSafe,
      clearOrder: clearAll || (() => setCurrentOrder([])),

      orderNote,
      setOrderNote,
      updateOrderCustomerByCode,

      fetchOrderByTable,
      fetchOrderById,
      orderById,
      loadOrdersNow,
      ordersNow,
      ordersLoading,

      menuItems,
      setMenuItems,
      currentCategory,
      setCurrentCategory,
      searchTerm,
      setSearchTerm,
      filteredMenu,

      paymentMethod,
      setPaymentMethod,
      printers,
      setPrinters,
      selectedPrintType,
      setSelectedPrintType,
      printQueue,
      setPrintQueue,
      selectedPrinter,
      setSelectedPrinter,

      finalTotals: totals,
      timeSlotOptions,
      selectedTimeSlot,
      setSelectedTimeSlot,

      preparePayment,
      checkoutOrder,

      // FE helpers
      hasNewDraftItems,
      clearDraftStorage,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      restaurantId,
      floors,
      floorsLoading,
      floorsError,
      refetchFloors,
      activeLevel,
      getIdFromLevel,
      getLevelFromId,
      activeFloorId,
      setActiveFloorId,

      tables,
      refetchTables,
      fetchTableByCode,

      tableSearch,
      setTableSearch,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,
      setTableStatus,
      mergeTables,
      splitTables,

      currentFloor,
      setCurrentFloor,
      currentTable,
      setCurrentTable,
      currentOrderType,
      setCurrentOrderType,

      currentOrderCode,
      setCurrentOrderCode,

      currentOrder,
      setCurrentOrder,

      tableOrders,
      setTableOrders,

      selectTableForOrder,
      startDeliveryOrder,
      startTakeawayOrder,

      shippingInfo,
      setShippingInfo,
      deliveryCustomer,
      setDeliveryCustomer,

      addToOrder,
      updateItemQty,
      removeItem,

      saveOrderSafe,
      clearAll,

      orderNote,
      setOrderNote,
      updateOrderCustomerByCode,

      fetchOrderByTable,
      fetchOrderById,
      orderById,
      loadOrdersNow,
      ordersNow,
      ordersLoading,

      menuItems,
      setMenuItems,
      currentCategory,
      setCurrentCategory,
      searchTerm,
      setSearchTerm,
      filteredMenu,

      paymentMethod,
      setPaymentMethod,
      printers,
      setPrinters,
      selectedPrintType,
      setSelectedPrintType,
      printQueue,
      setPrintQueue,
      selectedPrinter,
      setSelectedPrinter,

      totals,
      timeSlotOptions,
      selectedTimeSlot,
      setSelectedTimeSlot,

      preparePayment,
      checkoutOrder,

      hasNewDraftItems,
      clearDraftStorage,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
