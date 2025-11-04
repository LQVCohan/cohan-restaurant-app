/* eslint-disable react-refresh/only-export-components */
// src/context/PosContext.jsx
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
  const apollo = useApolloClient();
  const { showNotification } = useNotification();

  // base POS state
  const [currentFloor, setCurrentFloor] = useState(1);
  const [currentTable, setCurrentTable] = useState(null);
  const [currentOrderType, setCurrentOrderType] = useState("dine_in");
  const [tableOrders, setTableOrders] = useState({});
  const [currentOrder, setCurrentOrder] = useState([]);

  const [menuItems, setMenuItems] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [printers, setPrinters] = useState({});
  const [selectedPrintType, setSelectedPrintType] = useState("kitchen");
  const [printQueue, setPrintQueue] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);

  // floors
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

  // menu
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

  // active floor id <-> level
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

  // tables
  const {
    tables: allTables,
    tablesLoading,
    tablesError,
    refetchTables,
    createTable,
    updateTable,
    deleteTable,
    setTableStatus,
    moveTable,
    swapTableCodes,
    bulkUpsertTables,
    mergeTables,
    splitTables,
    fetchTableByCode,
  } = useTableManagement({ restaurantId });

  // table filters
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // filtered tables
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

  // order management hook (truyền state POS vào)
  const {
    addToOrder,
    updateItemQty,
    removeItem,
    clearAll,
    saveOrder: rawSaveOrder,
    fetchOrderByTable,
    fetchOrderById,
    orders,
    ordersLoading,
    ordersError,
    orderById,
    totals,
    orderNote,
    setOrderNote,
    attachCustomerToOrder,
  } = useOrderManagement({
    currentOrder,
    setCurrentOrder,
    tableOrders,
    currentTable,
    setTableOrders,
    restaurantId,
  });

  // chọn bàn => load order của bàn
  // chọn bàn => load order của bàn
  const selectTableForOrder = useCallback(
    async (code, capacity) => {
      const table =
        (allTables || []).find(
          (t) => (t.code || "").toLowerCase() === code.toLowerCase()
        ) || null;
      const statusTable = table?.status || "available";
      if (!table) {
        console.warn("Table not found for code:", code);
        return;
      } else if (statusTable === "offline") {
        showNotification(
          `Bàn ${code} hiện đang ngoại tuyến và không thể chọn.`,
          "error"
        );
        return;
      } else if (statusTable === "cleaning") {
        showNotification(
          `Bàn ${code} đang được dọn dẹp. Vui lòng chọn bàn khác.`,
          "warning"
        );
        return;
      } else if (statusTable === "reserved") {
        showNotification(
          `Bàn ${code} đã được đặt trước. Vui lòng chọn bàn khác.`,
          "warning"
        );
        return;
      } else {
        console.log("Selecting table:", table);
        if (statusTable === "available") {
          showNotification(`Đã chọn bàn ${code}.`, "success");
          setCurrentTable({
            id: table?.id,
            code,
            capacity,
            status: statusTable,
            restaurantId,
            orderCode: null,
          });
          setCurrentOrderType("dine_in");

          // Use functional update to avoid stale closure on `currentOrder`.
          // Clear the current order only if there are items; handle null/undefined safely.
          setCurrentOrder((prev) => (prev && prev.length > 0 ? [] : prev));
        } else {
          showNotification(`Đã chọn bàn ${code} có khách.`, "info");
          const res = await fetchOrderByTable(restaurantId, code, 20);

          if (res?.success) {
            const orderDoc = res.data?.[0] || null;

            if (orderDoc) {
              const restored = (orderDoc.items || []).map((i) => ({
                ...i,
                orderCode: orderDoc.orderCode,
                isExisting: true,
                isNew: false,
                _lineId: `${i.dishId || i.id}-${Date.now()}-${Math.random()}`,
              }));
              console.log("Restored order items:", restored);
              setCurrentOrder(restored);
              setCurrentTable({
                id: table?.id,
                code,
                capacity,
                status: table?.status || "available",
                restaurantId,
                orderCode: res?.data?.[0]?.orderCode || null,
              });
              setCurrentOrderType("dine_in");
            } else {
              console.log(
                "No existing order found for table. Starting new order."
              );
            }
          } else {
            setCurrentOrder([]);
          }
        }
      }
      // gọi hook để lấy order
    },
    [
      allTables,
      fetchOrderByTable,
      restaurantId,
      setCurrentOrder,
      setCurrentTable,
      setCurrentOrderType,
    ]
  );

  // đếm theo trạng thái
  const getStatusCounts = useMemo(() => {
    const counters = {
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      offline: 0,
    };
    (allTables || []).forEach((t) => {
      if (counters[t.status] != null) counters[t.status] += 1;
    });
    return () => ({ ...counters, all: allTables?.length ?? 0 });
  }, [allTables]);

  // đồng hồ
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // filter menu
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

  // fallback totals
  const localTotals = useMemo(() => {
    const subtotal = (currentOrder || []).reduce(
      (s, i) => s + (i.lineSubtotal || i.total || 0),
      0
    );
    const discount = 0;
    const base = Math.max(0, subtotal - discount);
    const tax = Math.round(base * 0.1);
    const service = Math.round(base * 0.05);
    const total = base + tax + service;
    return { subtotal, discount, tax, service, total };
  }, [currentOrder]);

  const finalTotals = totals ?? localTotals;

  // clearOrder now provided by order management hook (tracks deletions)
  // fallback to local clear if hook doesn't provide it
  const clearOrder =
    (typeof clearAll !== "undefined" && clearAll) ||
    (() => setCurrentOrder([]));

  const getStatusText = useCallback(
    (s) =>
      ({
        available: "Trống",
        occupied: "Có khách",
        reserved: "Đã đặt",
        cleaning: "Đang dọn",
        offline: "Ngưng",
      }[s] || s),
    []
  );

  // saveOrder bao ngoài để đổi màu bàn luôn
  const saveOrder = useCallback(
    async (opts = {}) => {
      const res = await rawSaveOrder({
        ...opts,
        restaurantId: restaurantId,
      });

      if (res?.success && currentTable?.id) {
        // đổi trạng thái bàn trên server
        try {
          await setTableStatus({ id: currentTable.id, status: "occupied" });
        } catch (e) {
          console.warn("setTableStatus failed:", e);
        }

        // đổi luôn trên cache apollo để UI đổi màu tức thì
        try {
          apollo.cache.modify({
            id: apollo.cache.identify({
              __typename: "Table",
              id: currentTable.id,
            }),
            fields: {
              status() {
                return "occupied";
              },
            },
          });
        } catch (e) {
          // ignore
        }

        //    showNotification(`Đã lưu đơn cho bàn ${currentTable.code}`, "success");

        // clear sau khi lưu
        setCurrentOrder([]);
        setCurrentTable(null);
      } else if (!res?.success) {
        //        showNotification(res?.message || "Lưu đơn thất bại.", "error");
      }

      return res;
    },
    [
      rawSaveOrder,
      restaurantId,
      currentTable,
      apollo,
      setTableStatus,
      setCurrentOrder,
      setCurrentTable,
      showNotification,
    ]
  );

  // context value
  const value = useMemo(
    () => ({
      restaurantId,

      // menu
      menus,
      timeSlotOptions,
      selectedTimeSlot,
      setSelectedTimeSlot,

      // floors
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

      // tables
      tables,
      tablesLoading,
      tablesError,
      refetchTables,
      tableSearch,
      setTableSearch,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,

      // table actions
      createTable,
      updateTable,
      deleteTable,
      setTableStatus,
      moveTable,
      swapTableCodes,
      bulkUpsertTables,
      mergeTables,
      splitTables,

      // selection
      currentFloor,
      setCurrentFloor,
      currentTable,
      setCurrentTable,
      currentOrderType,
      setCurrentOrderType,

      // orders
      currentOrder,
      setCurrentOrder,
      tableOrders,
      setTableOrders,
      selectTableForOrder,
      addToOrder,
      updateItemQty,
      removeItem,
      saveOrder,
      clearOrder,
      orderNote,
      setOrderNote,
      fetchOrderByTable,
      fetchOrderById,
      orders,
      ordersLoading,
      ordersError,
      orderById,
      attachCustomerToOrder,

      // menu filter
      menuItems,
      setMenuItems,
      currentCategory,
      setCurrentCategory,
      searchTerm,
      setSearchTerm,
      filteredMenu,

      // payment / print
      paymentMethod,
      setPaymentMethod,
      printers,
      setPrinters,
      selectedPrinter,
      setSelectedPrinter,
      selectedPrintType,
      setSelectedPrintType,
      printQueue,
      setPrintQueue,

      // misc
      finalTotals,
      now,
      getStatusText,
      fetchTableByCode,
      getStatusCounts,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      // ids
      restaurantId,
      // menu
      menus,
      timeSlotOptions,
      selectedTimeSlot,
      // floors
      floors,
      floorsLoading,
      floorsError,
      refetchFloors,
      activeLevel,
      getIdFromLevel,
      getLevelFromId,
      activeFloorId,
      // tables
      tables,
      tablesLoading,
      tablesError,
      refetchTables,
      tableSearch,
      statusFilter,
      typeFilter,
      // table actions
      createTable,
      updateTable,
      deleteTable,
      setTableStatus,
      moveTable,
      swapTableCodes,
      bulkUpsertTables,
      mergeTables,
      splitTables,
      // selection
      currentFloor,
      currentTable,
      currentOrderType,
      currentOrder,
      tableOrders,
      // orders
      orders,
      ordersLoading,
      ordersError,
      orderById,
      // menu filter
      menuItems,
      currentCategory,
      searchTerm,
      filteredMenu,
      // print
      paymentMethod,
      printers,
      selectedPrinter,
      selectedPrintType,
      printQueue,
      // misc
      finalTotals,
      now,
      getStatusText,
      fetchTableByCode,
      getStatusCounts,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
