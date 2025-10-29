/* eslint-disable react-refresh/only-export-components */
// PosContext.jsx — Full floor features: floors (id,name,level), activeLevel filter,
// map level <-> id, provide activeFloorId & setActiveFloorId, and full table actions.

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

const PosContext = createContext(undefined);

/** Hook tiện dụng để lấy context */
export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used within a <PosProvider>.");
  return ctx;
}

/**
 * PosProvider
 * Props:
 * - restaurantId (bắt buộc)
 * - initialFloorId? (ID tầng khởi tạo)
 * - initialFloorLevel? (level tầng khởi tạo, nếu truyền level sẽ ưu tiên level)
 */
export default function PosProvider({
  children,
  restaurantId,
  initialFloorId = null,
  initialFloorLevel = null,
}) {
  // ================== POS state khác (giữ nguyên của bạn) ==================
  const [currentFloor, setCurrentFloor] = useState(1); // level dùng cho UI cũ (nếu còn)
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

  // ================== FLOORS (level-first) ==================
  const {
    floors, // [{id,name,level}, ...]
    floorsLoading,
    floorsError,
    refetchFloors,
    activeLevel, // filter chính bằng level
    setActiveLevel,
    getIdFromLevel, // level -> id
    getLevelFromId, // id -> level
  } = useFloorManagement({ restaurantId, initialFloorId, initialFloorLevel });
  const {
    menus,
    timeSlotOptions,
    selectedTimeSlot,
    setSelectedTimeSlot,
    itemsWithPrice, // <-- dùng để vẽ menu
    itemsLoading,
    itemsError,
  } = useMenuManagement({
    restaurantId,
    defaultTimeSlot: "lunch",
    pageSize: 100,
  });

  // Cung cấp thêm API theo id để tiện kết nối những chỗ cũ dùng floorId
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

  // ================== TABLES (đủ chức năng) ==================
  const {
    tables: allTables, // danh sách bàn thô từ server (có floorLevel)
    tablesLoading,
    tablesError,
    refetchTables,
    // mutations:
    createTable,
    updateTable,
    deleteTable,
    setTableStatus,
    moveTable,
    swapTableCodes,
    bulkUpsertTables,
    mergeTables,
    splitTables,
    // helpers:
    fetchTableByCode,
  } = useTableManagement({ restaurantId });

  // ================== Filter của POS cho bảng ==================
  const [tableSearch, setTableSearch] = useState(""); // tìm code/status/type/tags
  const [statusFilter, setStatusFilter] = useState("all"); // available|occupied|reserved|cleaning|offline|all
  const [typeFilter, setTypeFilter] = useState("all"); // standard|vip|outdoor|...|all

  // ================== Derived: tables đã lọc theo level + status/type/search ==================
  // ================== Derived: tables đã lọc theo level + status + search nâng cao ==================
  const tables = useMemo(() => {
    let list = allTables || [];

    // 1) Lọc theo tầng (level)
    if (activeLevel != null) {
      list = list.filter((t) => Number(t.floorLevel) === Number(activeLevel));
    }

    // 2) Lọc theo trạng thái (nếu có)
    if (statusFilter && statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }

    // 3) Tìm kiếm: quy tắc đặc biệt cho mã bàn (code)
    // - Nếu text có dấu cách ở CUỐI (trailing space) => exact match theo code
    // - Nếu không có trailing space => prefix match theo code (A1 khớp A1, A10…)
    // - Vẫn hỗ trợ tìm rộng theo status/tags/type khi không exact
    const rawQ = tableSearch ?? ""; // KHÔNG trim toàn bộ, để giữ trailing space
    const hasTrailingSpace = /\s$/.test(rawQ); // true nếu có dấu cách ở cuối
    const q = rawQ.toLowerCase(); // giữ nguyên khoảng trắng
    const qNoTrail = rawQ.replace(/\s+$/, "").toLowerCase(); // bỏ chỉ khoảng trắng CUỐI

    if (q.length > 0) {
      list = list.filter((t) => {
        const code = (t.code || "").toLowerCase();
        const status = (t.status || "").toLowerCase();
        const type = (t.type || "").toLowerCase();
        const tags = Array.isArray(t.tags)
          ? t.tags.join(" ").toLowerCase()
          : "";

        // Ưu tiên tìm theo code
        if (hasTrailingSpace) {
          // EXACT: chỉ khớp đúng mã
          return code === qNoTrail;
        }
        // PREFIX: A1 khớp A1, A10...
        if (qNoTrail && code.startsWith(qNoTrail)) return true;

        // Fallback: tìm rộng theo các trường khác (khi không exact)
        return (
          status.includes(qNoTrail) ||
          type.includes(qNoTrail) ||
          tags.includes(qNoTrail)
        );
      });
    }

    return list;
  }, [allTables, activeLevel, statusFilter, tableSearch]);
  // MenuItem được thêm vào danh sách order hiện tại
  const addItemToOrder = useCallback(
    ({ menuItem, quantity, cookingOption, unit, note, price }) => {
      const existingItemIndex = currentOrder.findIndex(
        (item) =>
          item.id === menuItem.id &&
          item.cookingOption === cookingOption &&
          item.unit === unit
      );

      if (existingItemIndex !== -1) {
        // Update quantity if item already exists
        const updatedOrder = [...currentOrder];
        updatedOrder[existingItemIndex].quantity += quantity;
        updatedOrder[existingItemIndex].total =
          updatedOrder[existingItemIndex].quantity *
          updatedOrder[existingItemIndex].price;
        setCurrentOrder(updatedOrder);
      } else {
        // Add new item to the order
        const newItem = {
          ...menuItem,
          quantity,
          cookingOption,
          unit,
          note,
          price,
          total: quantity * price,
        };
        setCurrentOrder((prevOrder) => [...prevOrder, newItem]);
      }
    },
    [currentOrder]
  );
  const updateItemQty = useCallback(
    (itemId, newQuantity) => {
      const updatedOrder = currentOrder.map((item) =>
        item.id === itemId
          ? { ...item, quantity: newQuantity, total: item.price * newQuantity }
          : item
      );
      setCurrentOrder(updatedOrder);
    },
    [currentOrder]
  );
  // ================== Helper đếm số lượng theo status (trên allTables, không theo filter) ==================
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

  // ================== POS: chọn bàn để order ==================
  const selectTableForOrder = useCallback(
    (code, capacity) => {
      setCurrentTable({ code, capacity });
      if (!tableOrders[code]) {
        return;
      }

      setCurrentOrderType("dine_in");
      const exist = tableOrders[code] || [];
      const restored = exist.map((i) => ({
        ...i,
        isNew: false,
        isExisting: true,
      }));
      setCurrentOrder(restored);
    },
    [tableOrders]
  );
  const [toastItems, setToastItems] = useState([]);
  const clearOrder = useCallback(() => setCurrentOrder([]), []);

  const saveOrder = useCallback(() => {
    if (currentOrder.length === 0 || !currentTable) {
      setToastItems([
        ...toastItems,
        {
          id: new Date().getTime(),
          type: "error",
          text: "Chưa có món ăn nào trong đơn hoặc chưa có bàn nào được chọn. Vui lòng thêm món trước khi lưu.",
        },
      ]);
      return;
    }
    setTableOrders((prev) => ({ ...prev, [currentTable?.code]: currentOrder }));
    const table = fetchTableByCode(currentTable.code, restaurantId);
    console.log("Saving order for table:", table);
    setTableStatus({ id: table.id, status: "occupied" });
    setCurrentOrder([]);
    setCurrentTable(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTable, currentOrder]);

  // ================== Đồng hồ (giữ nguyên) ==================
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ================== Derived khác của POS (menu, totals, status text) ==================
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

  // Tổng tiền order hiện tại
  const totals = useMemo(() => {
    const subtotal = currentOrder.reduce((s, i) => s + i.total, 0);
    const discount = 0;
    const base = Math.max(0, subtotal - discount);
    const tax = Math.round(base * 0.1);
    const service = Math.round(base * 0.05);
    const total = base + tax + service;
    return { subtotal, discount, tax, service, total };
  }, [currentOrder]);

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

  // ================== Context Value ==================
  const value = useMemo(
    () => ({
      // ---- id gốc ----
      restaurantId,
      menus,
      timeSlotOptions,
      selectedTimeSlot,
      setSelectedTimeSlot,
      // ---- Floors (đủ chức năng) ----
      floors,
      floorsLoading,
      floorsError,
      refetchFloors,
      // filter theo level
      activeLevel,
      setActiveLevel,
      // ánh xạ id <-> level
      getIdFromLevel,
      getLevelFromId,
      // tiện ích theo id (để tương thích nơi cũ)
      activeFloorId,
      setActiveFloorId,

      // ---- Tables + filters ----
      tables, // đã lọc theo activeLevel/status/type/search
      tablesLoading,
      tablesError,
      refetchTables,
      tableSearch,
      setTableSearch,
      statusFilter,
      setStatusFilter,
      typeFilter,
      setTypeFilter,

      // ---- Mutations/Actions bàn ----
      createTable,
      updateTable,
      deleteTable,
      setTableStatus,
      moveTable,
      swapTableCodes,
      bulkUpsertTables,
      mergeTables,
      splitTables,

      // ---- POS selection & Orders ----
      currentFloor,
      setCurrentFloor,
      currentTable,
      setCurrentTable,
      currentOrderType,
      setCurrentOrderType,
      tableOrders,
      setTableOrders,

      selectTableForOrder,
      // Clear + Save order
      clearOrder,
      saveOrder,
      // Thêm món vào order
      addItemToOrder,
      updateItemQty,
      // order hiện tại
      currentOrder,
      setCurrentOrder,
      // ---- POS khác ----
      menuItems,
      setMenuItems,
      currentCategory,
      setCurrentCategory,
      searchTerm,
      setSearchTerm,
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
      now,

      // ---- Helpers ----
      filteredMenu,
      totals,
      getStatusText,
      fetchTableByCode,
      getStatusCounts,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      menus,
      timeSlotOptions,
      selectedTimeSlot,
      filteredMenu,
      restaurantId,
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
      // pos selection
      currentFloor,
      currentTable,
      currentOrderType,
      tableOrders,
      currentOrder,
      // pos misc
      menuItems,
      currentCategory,
      searchTerm,
      paymentMethod,
      printers,
      selectedPrinter,
      selectedPrintType,
      printQueue,
      now,
      // helpers
      filteredMenu,
      totals,
      getStatusText,
      fetchTableByCode,
      getStatusCounts,
    ]
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
