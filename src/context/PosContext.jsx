import React, { createContext, useContext, useMemo, useState } from "react";

const PosContext = createContext(null);
export const usePOS = () => useContext(PosContext);

const SAMPLE_TABLES = {
  1: [
    { code: "T01", capacity: 2, status: "available" },
    { code: "T02", capacity: 4, status: "occupied" },
    { code: "T03", capacity: 6, status: "available" },
    { code: "T04", capacity: 2, status: "reserved" },
    { code: "T05", capacity: 8, status: "available" },
    { code: "T06", capacity: 4, status: "occupied" },
    { code: "T07", capacity: 2, status: "available" },
    { code: "T08", capacity: 6, status: "available" },
  ],
  2: [
    { code: "T09", capacity: 4, status: "available" },
    { code: "T10", capacity: 6, status: "occupied" },
    { code: "T11", capacity: 8, status: "available" },
    { code: "T12", capacity: 2, status: "available" },
  ],
  3: [
    { code: "VIP01", capacity: 10, status: "available" },
    { code: "VIP02", capacity: 12, status: "reserved" },
    { code: "VIP03", capacity: 8, status: "available" },
  ],
};

const MENU = [
  {
    id: 1,
    name: "Gỏi cuốn tôm thịt",
    category: "appetizer",
    price: 45000,
    emoji: "🥗",
    description: "Gỏi cuốn tươi với tôm và thịt",
  },
  {
    id: 2,
    name: "Nem nướng Nha Trang",
    category: "appetizer",
    price: 55000,
    emoji: "🍢",
    description: "Nem nướng thơm ngon đặc sản",
  },
  {
    id: 3,
    name: "Bò lúc lắc",
    category: "main",
    price: 180000,
    emoji: "🥩",
    description: "Thịt bò thăn lúc lắc với khoai tây",
  },
  {
    id: 4,
    name: "Cơm tấm sườn nướng",
    category: "main",
    price: 65000,
    emoji: "🍚",
    description: "Cơm tấm với sườn nướng thơm lừng",
  },
  {
    id: 5,
    name: "Tôm hùm nướng phô mai",
    category: "seafood",
    price: 450000,
    emoji: "🦞",
    description: "Tôm hùm tươi nướng với phô mai",
  },
  {
    id: 6,
    name: "Cua rang me",
    category: "seafood",
    price: 280000,
    emoji: "🦀",
    description: "Cua biển rang me chua ngọt",
  },
  {
    id: 7,
    name: "Lẩu thái hải sản",
    category: "hotpot",
    price: 320000,
    emoji: "🍲",
    description: "Lẩu thái chua cay với hải sản tươi",
  },
  {
    id: 8,
    name: "Lẩu gà lá é",
    category: "hotpot",
    price: 250000,
    emoji: "🍲",
    description: "Lẩu gà với lá é thơm đặc trưng",
  },
  {
    id: 9,
    name: "Nước dừa tươi",
    category: "drink",
    price: 25000,
    emoji: "🥥",
    description: "Nước dừa tươi mát lạnh",
  },
  {
    id: 10,
    name: "Sinh tố bơ",
    category: "drink",
    price: 35000,
    emoji: "🥑",
    description: "Sinh tố bơ béo ngậy",
  },
  {
    id: 11,
    name: "Chè ba màu",
    category: "dessert",
    price: 30000,
    emoji: "🍧",
    description: "Chè ba màu truyền thống",
  },
  {
    id: 12,
    name: "Bánh flan",
    category: "dessert",
    price: 25000,
    emoji: "🍮",
    description: "Bánh flan mềm mịn",
  },
];

export function PosProvider({ children }) {
  const [tables, setTables] = useState(SAMPLE_TABLES);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [currentTable, setCurrentTable] = useState(null);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState([]);

  // Modal states
  const [menuItemDraft, setMenuItemDraft] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showPrintQueue, setShowPrintQueue] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // NEW: chuyển/ghép bàn
  const [showTransfer, setShowTransfer] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  // Helpers to find/set table by code
  function findTableByCode(code) {
    for (const floor of Object.keys(tables)) {
      const idx = tables[floor].findIndex((t) => t.code === code);
      if (idx !== -1) return [Number(floor), idx];
    }
    return [null, null];
  }
  function setTableStatus(code, status) {
    setTables((prev) => {
      const next = { ...prev };
      const [floor, idx] = findTableByCode(code);
      if (floor && idx != null) {
        next[floor] = [...next[floor]];
        next[floor][idx] = { ...next[floor][idx], status };
      }
      return next;
    });
  }
  const allTables = useMemo(() => {
    const out = [];
    for (const floor of Object.keys(tables)) {
      for (const t of tables[floor]) out.push({ floor: Number(floor), ...t });
    }
    return out;
  }, [tables]);

  // Business: Transfer current order context to another table (demo logic)
  function transferTo(targetCode) {
    if (!currentTable?.code || !targetCode || targetCode === currentTable.code)
      return;
    // Source becomes available, target becomes occupied, and set currentTable to target
    setTableStatus(currentTable.code, "available");
    setTableStatus(targetCode, "occupied");
    const [tf] = findTableByCode(targetCode);
    setCurrentFloor(tf || currentFloor);
    setCurrentTable({
      code: targetCode,
      capacity: allTables.find((t) => t.code === targetCode)?.capacity || 0,
    });
  }

  // Business: Merge multiple source tables into a target (demo: mark sources available, target occupied)
  function mergeInto(targetCode, sourceCodes = []) {
    if (!targetCode || sourceCodes.length === 0) return;
    for (const sc of sourceCodes) {
      if (sc === targetCode) continue;
      setTableStatus(sc, "available"); // released after merge
    }
    setTableStatus(targetCode, "occupied");
    // Optionally move "context" to target if current table is merged
    if (currentTable?.code && sourceCodes.includes(currentTable.code)) {
      const [tf] = findTableByCode(targetCode);
      setCurrentFloor(tf || currentFloor);
      setCurrentTable({
        code: targetCode,
        capacity: allTables.find((t) => t.code === targetCode)?.capacity || 0,
      });
    }
  }

  const filteredMenu = useMemo(
    () =>
      MENU.filter(
        (m) =>
          (category === "all" || m.category === category) &&
          (m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.description.toLowerCase().includes(search.toLowerCase()))
      ),
    [category, search]
  );

  const subtotal = useMemo(
    () => order.reduce((s, it) => s + it.price * it.quantity, 0),
    [order]
  );
  const tax = useMemo(() => subtotal * 0.1, [subtotal]);
  const service = useMemo(() => subtotal * 0.05, [subtotal]);
  const discount = useMemo(
    () => order.reduce((acc, it) => acc + (it.discountValue || 0), 0),
    [order]
  );
  const total = useMemo(
    () => subtotal + tax + service - discount,
    [subtotal, tax, service, discount]
  );

  function formatPrice(v) {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(v);
  }
  function selectFloor(floor) {
    setCurrentFloor(Number(floor));
  }
  function selectTable(code, capacity) {
    setCurrentTable({ code, capacity });
  }
  function openAddItem(item) {
    setMenuItemDraft({
      item,
      quantity: 1,
      cookingOption: "Bình thường",
      unit: "Phần",
      note: "",
    });
  }
  function confirmAddItem() {
    if (!menuItemDraft) return;
    const { item, quantity, cookingOption, unit, note } = menuItemDraft;
    setOrder((prev) => [
      ...prev,
      {
        id: Date.now(),
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity,
        cookingOption,
        unit,
        note,
      },
    ]);
    setMenuItemDraft(null);
  }
  function changeQty(id, delta) {
    setOrder((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, quantity: Math.max(1, it.quantity + delta) }
          : it
      )
    );
  }
  function removeItem(id) {
    setOrder((prev) => prev.filter((it) => it.id !== id));
  }
  function clearOrder() {
    setOrder([]);
  }
  function applyItemDiscount(id, type, value) {
    setOrder((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              discountType: type,
              discountValue:
                type === "percent"
                  ? Math.round((it.price * it.quantity * value) / 100)
                  : value,
            }
          : it
      )
    );
  }

  const value = {
    tables,
    setTables,
    currentFloor,
    selectFloor,
    currentTable,
    selectTable,
    category,
    setCategory,
    search,
    setSearch,
    menu: MENU,
    filteredMenu,
    order,
    setOrder,
    menuItemDraft,
    setMenuItemDraft,
    openAddItem,
    confirmAddItem,
    changeQty,
    removeItem,
    clearOrder,
    applyItemDiscount,
    subtotal,
    tax,
    service,
    discount,
    total,
    formatPrice,

    showPayment,
    setShowPayment,
    showReservation,
    setShowReservation,
    showSplitBill,
    setShowSplitBill,
    showDiscount,
    setShowDiscount,
    showPrintQueue,
    setShowPrintQueue,
    showCustomer,
    setShowCustomer,
    confirmClear,
    setConfirmClear,

    // new
    showTransfer,
    setShowTransfer,
    showMerge,
    setShowMerge,
    allTables,
    transferTo,
    mergeInto,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}
