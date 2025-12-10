/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useApolloClient } from "@apollo/client";

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
  const [currentOrder, setCurrentOrder] = useState([]); // Local Cart

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
    deliveryMethod: "ship_now", // ship_now | schedule | pickup_at_store ...
    deliveryTime: "",
    scheduleDate: "",
    scheduleTime: "",
  });

  const [deliveryCustomer, setDeliveryCustomer] = useState(null);

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

  // --- MENU ---
  const {
    menus,
    timeSlotOptions,
    selectedTimeSlot,
    setSelectedTimeSlot,
    itemsWithPrice,
  } = useMenuManagement({
    restaurantId,
    defaultTimeSlot: "lunch",
    pageSize: 100,
  });

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

  // --- [NEW] START DELIVERY ORDER ---
  const startDeliveryOrder = useCallback(() => {
    const shipCode = generateVirtualCode("SHIP");
    setCurrentTable({
      id: null,
      code: shipCode,
      name: "Delivery Order",
      status: "occupied",
      type: "delivery",
      restaurantId,
      isVirtual: true, // phân biệt với bàn thật
    });
    setCurrentOrderType("delivery");
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
    const takeawayCode = generateVirtualCode("TAKE");
    setCurrentTable({
      id: null,
      code: takeawayCode,
      name: "Takeaway Order",
      status: "occupied",
      type: "takeaway",
      restaurantId,
      isVirtual: true,
    });
    setCurrentOrderType("takeaway");
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

  // --- SELECT TABLE LOGIC (DINE-IN) ---
  const selectTableForOrder = useCallback(
    async (code, capacity) => {
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

      let groupsForTable = [];
      try {
        groupsForTable =
          (await loadGroupsForTable({ restaurantId, tableCode: code })) || [];
      } catch (e) {
        console.warn(e);
      }

      const hasOrders =
        Array.isArray(groupsForTable) && groupsForTable.length > 0;

      if (!hasOrders && statusTable === "available") {
        showNotification(`Đã chọn bàn ${code}.`, "success");
        setCurrentTable({
          id: table?.id,
          code,
          capacity,
          status: statusTable,
          restaurantId,
          orderCode: null,
          isVirtual: false,
        });
        setCurrentOrderType("dine_in");
        setCurrentOrder((prev) => (prev && prev.length > 0 ? [] : prev));
        return;
      }

      if (hasOrders) {
        showNotification(`Đã chọn bàn ${code} có khách.`, "info");
        setCurrentTable({
          id: table?.id,
          code,
          capacity,
          status: "occupied",
          restaurantId,
          orderCode: groupsForTable[0]?.orderCode || null,
          isVirtual: false,
        });
        setCurrentOrderType("dine_in");
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

      showNotification(`Bàn ${code} đang được đặt.`, "info");
      setCurrentOrder([]);
      setCurrentTable({
        id: table?.id,
        code,
        capacity,
        status: "reserved",
        restaurantId,
        orderCode: null,
        isVirtual: false,
      });
      setCurrentOrderType("dine_in");
    },
    [
      allTables,
      restaurantId,
      loadGroupsForTable,
      setCurrentOrder,
      setCurrentTable,
      setCurrentOrderType,
      setTableStatus,
      showNotification,
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

  const saveOrder = useCallback(
    async (opts = {}) => {
      const res = await rawSaveOrder({ ...opts, restaurantId });
      // ⚠️ Với delivery/takeaway không có bàn thật nên không cần setTableStatus
      if (
        res?.success &&
        currentTable?.id &&
        !currentTable?.isVirtual // chỉ bàn thật
      ) {
        const savedOrder = res.data || null;
        try {
          await setTableStatus({ id: currentTable.id, status: "occupied" });
        } catch (e) {
          console.warn(e);
        }
        setCurrentOrder([]);
        setCurrentTable((prev) =>
          prev
            ? {
                ...prev,
                status: "occupied",
                orderCode: savedOrder?.orderCode || prev.orderCode || null,
              }
            : prev
        );
      }
      return res;
    },
    [rawSaveOrder, restaurantId, currentTable, setTableStatus]
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
      tableSearch,
      setTableSearch,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,
      setTableStatus,
      currentFloor,
      setCurrentFloor,
      currentTable,
      setCurrentTable,
      currentOrderType,
      setCurrentOrderType,
      currentOrder,
      setCurrentOrder,
      tableOrders,
      setTableOrders,
      selectTableForOrder,
      startDeliveryOrder,
      startTakeawayOrder,

      // 🔹 Shipping & customer cho off-premise
      shippingInfo,
      setShippingInfo,
      deliveryCustomer,
      setDeliveryCustomer,

      addToOrder,
      updateItemQty,
      removeItem,
      saveOrder,
      clearOrder: clearAll || (() => setCurrentOrder([])),
      orderNote,
      setOrderNote,
      updateOrderCustomerByCode,
      fetchOrderByTable,
      fetchOrderById,
      orderById,
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
      finalTotals: totals,
      timeSlotOptions,
      selectedTimeSlot,
      setSelectedTimeSlot,

      // Payment helpers (dine-in)
      preparePayment,
      checkoutOrder,
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
      tables,
      refetchTables,
      tableSearch,
      statusFilter,
      typeFilter,
      setTableStatus,
      currentFloor,
      currentTable,
      currentOrderType,
      currentOrder,
      tableOrders,
      selectTableForOrder,
      startDeliveryOrder,
      startTakeawayOrder,
      shippingInfo,
      deliveryCustomer,
      addToOrder,
      updateItemQty,
      removeItem,
      saveOrder,
      clearAll,
      orderNote,
      setOrderNote,
      updateOrderCustomerByCode,
      fetchOrderByTable,
      fetchOrderById,
      orderById,
      menuItems,
      currentCategory,
      searchTerm,
      filteredMenu,
      paymentMethod,
      printers,
      totals,
      timeSlotOptions,
      selectedTimeSlot,
      preparePayment,
      checkoutOrder,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
