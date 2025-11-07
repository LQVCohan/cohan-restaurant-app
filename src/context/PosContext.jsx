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
    updateTable, // vẫn dùng cho các patch hợp lệ
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
    updateOrderCustomerByCode, // NEW: expose để dùng nơi khác nếu cần
  } = useOrderManagement({
    currentOrder,
    setCurrentOrder,
    tableOrders,
    currentTable,
    setTableOrders,
    restaurantId,
  });

  // chọn bàn => load order của bàn
  const selectTableForOrder = useCallback(
    async (code, capacity) => {
      const table =
        (allTables || []).find(
          (t) => (t.code || "").toLowerCase() === code.toLowerCase()
        ) || null;

      if (!table) {
        console.warn("Table not found for code:", code);
        return;
      }

      const statusTable = table?.status || "available";

      // Dò order hoạt động từ DB
      let activeOrderDoc = null;
      try {
        const res = await fetchOrderByTable(restaurantId, code, 1, 0);
        activeOrderDoc = res?.data?.[0] || null;
      } catch (e) {
        console.warn("fetchOrderByTable failed:", e);
      }

      if (statusTable === "offline") {
        showNotification(
          `Bàn ${code} hiện đang ngoại tuyến và không thể chọn.`,
          "error"
        );
        return;
      }
      if (statusTable === "cleaning") {
        showNotification(
          `Bàn ${code} đang được dọn dẹp. Vui lòng chọn bàn khác.`,
          "warning"
        );
        return;
      }

      // Cho phép chọn cả reserved
      if (!activeOrderDoc && statusTable === "available") {
        // Bàn trống
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
        setCurrentOrder((prev) => (prev && prev.length > 0 ? [] : prev));
        return;
      }

      // Có order đang hoạt động hoặc bàn reserved/occupied
      if (activeOrderDoc) {
        showNotification(`Đã chọn bàn ${code} có khách.`, "info");
        const restored = (activeOrderDoc.items || []).map((i) => ({
          ...i,
          orderCode: activeOrderDoc.orderCode,
          isExisting: true,
          isNew: false,
          _lineId: `${i.dishId || i.id}-${Date.now()}-${Math.random()}`,
        }));
        setCurrentOrder(restored);
        setCurrentTable({
          id: table?.id,
          code,
          capacity,
          status: "occupied", // UI: coi như có khách
          restaurantId,
          orderCode: activeOrderDoc.orderCode || null,
        });
        setCurrentOrderType("dine_in");

        // Nếu trên server/cached đang "available" → cập nhật "occupied"
        if (
          (statusTable === "available" || statusTable === "reserved") &&
          table?.id &&
          typeof setTableStatus === "function"
        ) {
          try {
            await setTableStatus({ id: table.id, status: "occupied" });
          } catch (e) {
            console.warn("setTableStatus (occupied) failed:", e);
          }
        }
      } else {
        // reserved nhưng chưa có order
        showNotification(`Bàn ${code} đang được đặt.`, "info");
        setCurrentOrder([]);
        setCurrentTable({
          id: table?.id,
          code,
          capacity,
          status: "reserved",
          restaurantId,
          orderCode: null,
        });
        setCurrentOrderType("dine_in");
      }
    },
    [
      allTables,
      fetchOrderByTable,
      restaurantId,
      setCurrentOrder,
      setCurrentTable,
      setCurrentOrderType,
      setTableStatus,
      showNotification,
    ]
  );

  // ✅ Lưu thông tin khách LOCAL-ONLY (không gọi network)
  const saveTableCustomer = useCallback(
    async (tableCode, rawCustomer = {}) => {
      const code = (tableCode || "").trim();
      if (!code) return { success: false, message: "Thiếu mã bàn" };

      const fullName = (rawCustomer.fullName ?? rawCustomer.name ?? "")
        .toString()
        .trim();
      const phone = (rawCustomer.phone ?? "").toString().trim();
      const email = (rawCustomer.email ?? "").toString().trim().toLowerCase();
      const note = (rawCustomer.note ?? "").toString();
      const guestCount = Number.isFinite(Number(rawCustomer.guests))
        ? Number(rawCustomer.guests)
        : Number.isFinite(Number(rawCustomer.guestCount))
        ? Number(rawCustomer.guestCount)
        : null;
      const checkin = rawCustomer.checkin || rawCustomer.checkinTime || "";

      // 1) Lưu vào state local để lần saveOrder gửi kèm (nếu cần)
      setTableOrders((prev) => ({
        ...prev,
        [code]: {
          ...(prev?.[code] || {}),
          customer: { fullName, phone, email },
        },
      }));

      // 2) Đồng bộ currentTable local (chỉ để hiển thị)
      if (
        currentTable?.code &&
        currentTable.code.toLowerCase() === code.toLowerCase()
      ) {
        setCurrentTable((prev) =>
          prev
            ? {
                ...prev,
                customerName: fullName || prev.customerName,
                phone: phone || prev.phone,
                guestCount: guestCount ?? prev.guestCount ?? undefined,
                checkinTime: checkin || prev.checkinTime,
                note: note || prev.note,
              }
            : prev
        );
      }

      showNotification?.(`Đã lưu thông tin khách cho bàn ${code}.`, "success");
      return {
        success: true,
        customer: { fullName, phone, email, note, guestCount, checkin },
      };
    },
    [currentTable, setCurrentTable, setTableOrders, showNotification]
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

  // saveOrder bao ngoài để đổi màu bàn + **không pass customer nếu bàn reserved**
  const saveOrder = useCallback(
    async (opts = {}) => {
      const tableCode = currentTable?.code || opts.tableCode;

      // lấy customer local nếu có
      let customerFromState = undefined;
      if (tableCode && tableOrders?.[tableCode]?.customer) {
        const c = tableOrders[tableCode].customer || {};
        customerFromState = {
          fullName: (c.fullName || c.name || "").trim(),
          phone: (c.phone || "").trim(),
          email: (c.email || "").trim().toLowerCase(),
        };
      }

      // Nếu bàn đang reserved: không gửi customer để BE tự attach từ reservation
      const isReserved = currentTable?.status === "reserved";

      const res = await rawSaveOrder({
        ...opts,
        restaurantId,
        customer: isReserved ? undefined : opts.customer ?? customerFromState,
      });

      if (res?.success && currentTable?.id) {
        try {
          await setTableStatus({ id: currentTable.id, status: "occupied" });
        } catch (e) {
          console.warn("setTableStatus failed:", e);
        }

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
        } catch {}

        setCurrentOrder([]);
        setCurrentTable(null);
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
      tableOrders,
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
      updateOrderCustomerByCode,

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
      saveTableCustomer,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      restaurantId,
      menus,
      timeSlotOptions,
      selectedTimeSlot,
      floors,
      floorsLoading,
      floorsError,
      refetchFloors,
      activeLevel,
      getIdFromLevel,
      getLevelFromId,
      activeFloorId,
      tables,
      tablesLoading,
      tablesError,
      refetchTables,
      tableSearch,
      statusFilter,
      typeFilter,
      saveTableCustomer,
      createTable,
      updateTable,
      deleteTable,
      setTableStatus,
      moveTable,
      swapTableCodes,
      bulkUpsertTables,
      mergeTables,
      splitTables,
      currentFloor,
      currentTable,
      currentOrderType,
      currentOrder,
      tableOrders,
      orders,
      ordersLoading,
      ordersError,
      orderById,
      menuItems,
      currentCategory,
      searchTerm,
      filteredMenu,
      paymentMethod,
      printers,
      selectedPrinter,
      selectedPrintType,
      printQueue,
      finalTotals,
      now,
      getStatusText,
      fetchTableByCode,
      getStatusCounts,
      fetchOrderByTable,
      fetchOrderById,
      addToOrder,
      updateItemQty,
      removeItem,
      saveOrder,
      clearOrder,
      orderNote,
      setOrderNote,
      attachCustomerToOrder,
      updateOrderCustomerByCode,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
