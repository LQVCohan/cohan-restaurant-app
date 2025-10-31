/* eslint-disable react-refresh/only-export-components */
// PosContext.jsx — quản lý POS: floors, tables, menu, order, notification

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

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
  // ------------ POS base state ------------
  const [currentFloor, setCurrentFloor] = useState(1);
  const [currentTable, setCurrentTable] = useState(null);
  const [currentOrderType, setCurrentOrderType] = useState("dine_in");
  const [tableOrders, setTableOrders] = useState({});
  const [currentOrder, setCurrentOrder] = useState([]);

  // chứa thông tin khách theo bàn
  const [tableCustomers, setTableCustomers] = useState({}); // { [code]: {name, phone, ...} }

  const [menuItems, setMenuItems] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [printers, setPrinters] = useState({});
  const [selectedPrintType, setSelectedPrintType] = useState("kitchen");
  const [printQueue, setPrintQueue] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);

  const { showNotification } = useNotification();

  // ------------ FLOORS ------------
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

  // ------------ MENU ------------
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

  // ------------ TABLES ------------
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
      list = list.filter((t) => (t.type || "").toLowerCase() === typeFilter);
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

        if (hasTrailingSpace) {
          return code === qNoTrail;
        }
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

  // ------------ ORDER HOOK ------------
  const {
    addToOrder,
    updateItemQty,
    removeItem,
    saveOrder,
    saveOrderQueued,
    totals,
    orderNote,
    setOrderNote,
    fetchOrderByTable,
    fetchOrderById,
    fetchOrders,
    orders,
    ordersLoading,
    ordersError,
  } = useOrderManagement({
    currentOrder,
    setCurrentOrder,
    tableOrders,
    currentTable,
    setTableOrders,
    tableCustomers,
  });

  // ------------ đếm trạng thái bàn ------------
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

  // ------------ chọn bàn ------------
  const selectTableForOrder = useCallback(
    async (code, capacity) => {
      const targetTable =
        (allTables || []).find(
          (t) => (t.code || "").toLowerCase() === code.toLowerCase()
        ) || null;
      const targetStatus = targetTable?.status || "available";

      // nếu đang có món nhập
      if (currentOrder.length > 0) {
        if (targetStatus === "available") {
          setCurrentTable({
            code,
            capacity,
            status: targetStatus,
            customer: tableCustomers?.[code] || null,
          });
          showNotification(
            `Đã chuyển sang bàn ${code}. Món đang nhập được giữ lại.`,
            "info"
          );
          return;
        }

        const ok = window.confirm(
          `Bàn ${code} đang có order. Bạn muốn gộp các món bạn đang nhập vào bàn ${code} không?`
        );
        if (ok) {
          const existingOrder = await fetchOrderByTable(code);
          if (existingOrder?.success) {
            const serverOrder = existingOrder.data?.[0] || null;
            const restored = (serverOrder?.items || []).map((i) => ({
              ...i,
              id: i.dishId,
              isNew: false,
              isExisting: true,
              total: i.lineSubtotal,
            }));
            const merged = [...restored, ...currentOrder];

            setTableOrders((prev) => ({ ...prev, [code]: merged }));
            setCurrentOrder(merged);
            setCurrentTable({
              code,
              capacity,
              status: targetStatus,
              customer: serverOrder?.customer || tableCustomers?.[code] || null,
              orderCode: serverOrder?.orderCode,
            });
            setCurrentOrderType("dine_in");
            showNotification("Đã gộp món vào bàn.", "success");
          } else {
            showNotification(
              `Không tải được order của bàn ${code}.`,
              "warning"
            );
            setCurrentTable({
              code,
              capacity,
              status: targetStatus,
              customer: tableCustomers?.[code] || null,
            });
          }
        } else {
          const existingOrder = await fetchOrderByTable(code);
          if (existingOrder?.success) {
            const serverOrder = existingOrder.data?.[0] || null;
            const restored = (serverOrder?.items || []).map((i) => ({
              ...i,
              id: i.dishId,
              isNew: false,
              isExisting: true,
              total: i.lineSubtotal,
            }));
            setCurrentOrder(restored);
            setCurrentTable({
              code,
              capacity,
              status: targetStatus,
              customer: serverOrder?.customer || null,
              orderCode: serverOrder?.orderCode,
            });
          } else {
            setCurrentOrder([]);
            setCurrentTable({
              code,
              capacity,
              status: targetStatus,
              customer: tableCustomers?.[code] || null,
            });
          }
          showNotification(
            `Đã chuyển sang bàn ${code} và thay bằng order của bàn.`,
            "info"
          );
        }
        return;
      }

      // nếu không có món → load order (nếu có)
      const existingOrder = await fetchOrderByTable(code);
      if (existingOrder?.success && existingOrder.data?.length) {
        const serverOrder = existingOrder.data?.[0];
        const restored = (serverOrder?.items || []).map((i) => ({
          ...i,
          id: i.dishId,
          isNew: false,
          isExisting: true,
          total: i.lineSubtotal,
        }));
        setCurrentOrder(restored);
        setCurrentTable({
          code,
          capacity,
          status: targetStatus,
          customer: serverOrder?.customer || tableCustomers?.[code] || null,
          orderCode: serverOrder?.orderCode,
        });
      } else {
        setCurrentOrder([]);
        setCurrentTable({
          code,
          capacity,
          status: targetStatus,
          customer: tableCustomers?.[code] || null,
        });
      }
      setCurrentOrderType("dine_in");
    },
    [
      allTables,
      currentOrder,
      fetchOrderByTable,
      setCurrentOrder,
      setTableOrders,
      setCurrentTable,
      setCurrentOrderType,
      showNotification,
      tableCustomers,
    ]
  );

  // ------------ đồng hồ ------------
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ------------ lọc menu ------------
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

  // fallback tính totals
  const localTotals = useMemo(() => {
    const subtotal = (currentOrder || []).reduce(
      (s, i) => s + (i.total || 0),
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

  const clearOrder = useCallback(() => setCurrentOrder([]), []);

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

  // ------------ LƯU THÔNG TIN KHÁCH TỪ MODAL BÀN ------------
  const saveTableCustomer = useCallback(
    async (tableCode, customer) => {
      if (!tableCode) return { success: false, message: "Thiếu mã bàn" };

      // 1) lưu vào state để lần sau chọn bàn có sẵn
      setTableCustomers((prev) => ({ ...prev, [tableCode]: customer }));

      // 2) nếu bàn hiện tại là bàn này → cập nhật luôn
      setCurrentTable((prev) =>
        prev && prev.code === tableCode ? { ...prev, customer } : prev
      );

      // 3) kiểm tra xem bàn này có order chưa
      const existingOrder = await fetchOrderByTable(tableCode);
      const hasOrder = existingOrder?.success && existingOrder.data?.length > 0;

      // 3.a) nếu chưa có order → chỉ đổi trạng thái bàn sang reserved
      if (!hasOrder) {
        const tgt = (allTables || []).find((t) => t.code === tableCode);
        if (tgt) {
          try {
            await setTableStatus({ id: tgt.id, status: "reserved" });
          } catch (e) {
            console.error(e);
          }
        }
        showNotification(
          `Đã lưu thông tin khách cho bàn ${tableCode}. Bàn chuyển sang trạng thái đã đặt.`,
          "success"
        );
        return {
          success: true,
          message: "Lưu thông tin khách và đánh dấu bàn đã đặt.",
        };
      }

      // 3.b) nếu có order → đẩy lên server cùng customer
      const order = existingOrder.data[0];
      const res = await saveOrder({
        persist: true,
        restaurantId,
        customer,
        tableCode,
      });

      if (res.success) {
        showNotification(
          `Đã gắn khách vào order của bàn ${tableCode}.`,
          "success"
        );
      } else {
        showNotification(
          `Không thể gắn khách vào order: ${res.message}`,
          "warning"
        );
      }

      return res;
    },
    [
      allTables,
      fetchOrderByTable,
      setTableStatus,
      showNotification,
      saveOrder,
      restaurantId,
    ]
  );

  // ------------ context value ------------
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
      tableCustomers,
      setTableCustomers,

      selectTableForOrder,
      addToOrder,
      updateItemQty,
      removeItem,
      saveOrder,
      saveOrderQueued,
      clearOrder,
      orderNote,
      setOrderNote,

      // order api
      fetchOrderByTable,
      fetchOrderById,
      fetchOrders,
      orders,
      ordersLoading,
      ordersError,

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

      // customer
      saveTableCustomer,

      // misc
      finalTotals,
      now,
      getStatusText,
      fetchTableByCode,
      getStatusCounts,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
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
      // actions
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
      tableCustomers,
      // order
      orders,
      ordersLoading,
      ordersError,
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
      // funcs
      saveTableCustomer,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
