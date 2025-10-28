// =============================================
// FoodHub POS – React + SCSS Modules (Refactor)
// Single-file export for copy & split into project files
// =============================================
// 📂 Suggested structure
// src/
// ├─ main.jsx
// ├─ App.jsx
// ├─ context/PosContext.jsx
// ├─ utils/format.js
// ├─ components/pos/
// │   ├─ POSLayout.jsx
// │   ├─ POSLayout.module.scss
// │   ├─ LeftPanel.jsx
// │   ├─ LeftPanel.module.scss
// │   ├─ CenterPanel.jsx
// │   ├─ CenterPanel.module.scss
// │   ├─ RightPanel.jsx
// │   ├─ RightPanel.module.scss
// │   └─ TableCard.jsx
// ├─ components/modals/
// │   ├─ MenuItemModal.jsx
// │   ├─ PaymentModal.jsx
// │   ├─ ReceiptModal.jsx
// │   ├─ ReservationModal.jsx
// │   ├─ SplitTableModal.jsx
// │   ├─ TableActionsModal.jsx
// │   ├─ PrintModal.jsx
// │   ├─ PrintQueueModal.jsx
// │   └─ PrinterSettingsModal.jsx
// └─ styles/pos/
//     ├─ _variables.scss
//     └─ _mixins.scss

// ---------------------------------------------
// src/main.jsx
// ---------------------------------------------
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ---------------------------------------------
// src/App.jsx
// ---------------------------------------------
import React from "react";
import { PosProvider } from "./context/PosContext";
import POSLayout from "./components/pos/POSLayout";

export default function App() {
  return (
    <PosProvider>
      <POSLayout />
    </PosProvider>
  );
}

// ---------------------------------------------
// src/context/PosContext.jsx
// ---------------------------------------------
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const PosContext = createContext(null);
export const usePos = () => useContext(PosContext);

const initialTables = {
  1: [
    { code: "T01", capacity: 2, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" },
    { code: "T02", capacity: 4, status: "occupied", customerName: "Nguyễn Văn A", phone: "0901234567", guestCount: 3, reservationTime: "", checkinTime: "2024-01-15T18:30", note: "Khách VIP" },
    { code: "T03", capacity: 6, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" },
    { code: "T04", capacity: 2, status: "reserved", customerName: "Trần Thị B", phone: "0987654321", guestCount: 2, reservationTime: "2024-01-15T19:00", checkinTime: "", note: "Sinh nhật" },
    { code: "T05", capacity: 8, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" },
    { code: "T06", capacity: 4, status: "occupied", customerName: "Lê Văn C", phone: "0912345678", guestCount: 4, reservationTime: "", checkinTime: "2024-01-15T19:15", note: "Ăn chay" },
    { code: "T07", capacity: 2, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" },
    { code: "T08", capacity: 6, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" }
  ],
  2: [
    { code: "T09", capacity: 4, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" },
    { code: "T10", capacity: 6, status: "occupied", customerName: "Phạm Văn D", phone: "0923456789", guestCount: 5, reservationTime: "", checkinTime: "2024-01-15T18:45", note: "Tiệc gia đình" },
    { code: "T11", capacity: 8, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" },
    { code: "T12", capacity: 2, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" }
  ],
  3: [
    { code: "VIP01", capacity: 10, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" },
    { code: "VIP02", capacity: 12, status: "reserved", customerName: "Hoàng Thị E", phone: "0934567890", guestCount: 10, reservationTime: "2024-01-15T20:30", checkinTime: "", note: "Tiệc công ty" },
    { code: "VIP03", capacity: 8, status: "available", customerName: "", phone: "", guestCount: 0, reservationTime: "", checkinTime: "", note: "" }
  ]
};

const initialMenu = [
  { id: 1, name: "Gỏi cuốn tôm thịt", category: "appetizer", price: 45000, emoji: "🥗", description: "Gỏi cuốn tươi với tôm và thịt" },
  { id: 2, name: "Nem nướng Nha Trang", category: "appetizer", price: 55000, emoji: "🍢", description: "Nem nướng thơm ngon đặc sản" },
  { id: 3, name: "Bò lúc lắc", category: "main", price: 180000, emoji: "🥩", description: "Thịt bò thăn lúc lắc với khoai tây" },
  { id: 4, name: "Cơm tấm sườn nướng", category: "main", price: 65000, emoji: "🍚", description: "Cơm tấm với sườn nướng thơm lừng" },
  { id: 5, name: "Tôm hùm nướng phô mai", category: "seafood", price: 450000, emoji: "🦞", description: "Tôm hùm tươi nướng với phô mai" },
  { id: 6, name: "Cua rang me", category: "seafood", price: 280000, emoji: "🦀", description: "Cua biển rang me chua ngọt" },
  { id: 7, name: "Lẩu thái hải sản", category: "hotpot", price: 320000, emoji: "🍲", description: "Lẩu thái chua cay với hải sản tươi" },
  { id: 8, name: "Lẩu gà lá é", category: "hotpot", price: 250000, emoji: "🍲", description: "Lẩu gà với lá é thơm đặc trưng" },
  { id: 9, name: "Nước dừa tươi", category: "drink", price: 25000, emoji: "🥥", description: "Nước dừa tươi mát lạnh" },
  { id: 10, name: "Sinh tố bơ", category: "drink", price: 35000, emoji: "🥑", description: "Sinh tố bơ béo ngậy" },
  { id: 11, name: "Chè ba màu", category: "dessert", price: 30000, emoji: "🍧", description: "Chè ba màu truyền thống" },
  { id: 12, name: "Bánh flan", category: "dessert", price: 25000, emoji: "🍮", description: "Bánh flan mềm mịn" }
];

const initialPrinters = {
  "kitchen-1": { id: "kitchen-1", name: "Máy in bếp chính", ip: "192.168.1.101", type: "thermal", location: "kitchen", status: "online", lastUsed: new Date() },
  "kitchen-2": { id: "kitchen-2", name: "Máy in bếp phụ", ip: "192.168.1.102", type: "thermal-58", location: "kitchen", status: "offline", lastUsed: new Date(Date.now() - 3600000) },
  "bar-1": { id: "bar-1", name: "Máy in bar", ip: "192.168.1.103", type: "thermal", location: "bar", status: "online", lastUsed: new Date() },
  "cashier-1": { id: "cashier-1", name: "Máy in thu ngân", ip: "192.168.1.104", type: "thermal", location: "cashier", status: "busy", lastUsed: new Date() },
  "manager-1": { id: "manager-1", name: "Máy in A4 quản lý", ip: "192.168.1.105", type: "laser", location: "manager", status: "online", lastUsed: new Date(Date.now() - 1800000) }
};

export function PosProvider({ children }) {
  const [currentFloor, setCurrentFloor] = useState(1);
  const [tables, setTables] = useState(initialTables);
  const [currentTable, setCurrentTable] = useState(null); // {code, capacity}
  const [currentOrderType, setCurrentOrderType] = useState("dine_in");
  const [tableOrders, setTableOrders] = useState({}); // code -> items
  const [currentOrder, setCurrentOrder] = useState([]);
  const [menuItems, setMenuItems] = useState(initialMenu);
  const [currentCategory, setCurrentCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [printers, setPrinters] = useState(initialPrinters);
  const [selectedPrintType, setSelectedPrintType] = useState("kitchen");
  const [printQueue, setPrintQueue] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);

  // derived
  const filteredMenu = useMemo(() => {
    const byCat = (i) => currentCategory === "all" || i.category === currentCategory;
    const bySearch = (i) => !searchTerm || i.name.toLowerCase().includes(searchTerm) || i.description.toLowerCase().includes(searchTerm);
    return menuItems.filter((i) => byCat(i) && bySearch(i));
  }, [menuItems, currentCategory, searchTerm]);

  // helpers
  const getStatusText = (s) => ({ available: "Trống", occupied: "Có khách", reserved: "Đã đặt" }[s] || s);

  const selectTableForOrder = (code, capacity) => {
    setCurrentTable({ code, capacity });
    setCurrentOrderType("dine_in");
    const exist = tableOrders[code] || [];
    // mark existing
    const restored = exist.map((i) => ({ ...i, isNew: false, isExisting: true }));
    setCurrentOrder(restored);
  };

  const clearOrder = () => setCurrentOrder([]);

  const saveOrder = () => {
    if (!currentTable) return;
    setTableOrders((prev) => ({ ...prev, [currentTable.code]: currentOrder }));
  };

  const addItemToOrder = ({ menuItem, quantity = 1, cookingOption = "Bình thường", unit = "Phần", note = "" }) => {
    const item = {
      id: Date.now(),
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      cookingOption,
      unit,
      note,
      total: menuItem.price * quantity,
      isNew: true,
      isExisting: false,
      addedAt: new Date(),
    };
    setCurrentOrder((prev) => [...prev, item]);
  };

  const updateItemQty = (id, delta) => {
    setCurrentOrder((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta), total: i.price * Math.max(1, i.quantity + delta) } : i)));
  };

  const removeItem = (id) => setCurrentOrder((prev) => prev.filter((i) => i.id !== id));

  const totals = useMemo(() => {
    const subtotal = currentOrder.reduce((s, i) => s + i.total, 0);
    const discount = 0; // extend later
    const tax = Math.round((subtotal - discount) * 0.1);
    const service = Math.round((subtotal - discount) * 0.05);
    const total = subtotal - discount + tax + service;
    return { subtotal, discount, tax, service, total };
  }, [currentOrder]);

  // printing queue utilities (skeleton)
  const addToPrintQueue = (payload) => setPrintQueue((prev) => [{ id: Date.now(), status: "pending", ...payload }, ...prev]);
  const clearPrintQueue = () => setPrintQueue([]);

  // time ticker just for order-time display
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const value = {
    // state
    currentFloor, setCurrentFloor,
    tables, setTables,
    currentTable, setCurrentTable,
    currentOrderType, setCurrentOrderType,
    tableOrders, setTableOrders,
    currentOrder, setCurrentOrder,
    menuItems, setMenuItems,
    currentCategory, setCurrentCategory,
    searchTerm, setSearchTerm,
    paymentMethod, setPaymentMethod,
    printers, setPrinters,
    selectedPrinter, setSelectedPrinter,
    selectedPrintType, setSelectedPrintType,
    printQueue, setPrintQueue,
    now,

    // derived
    filteredMenu,
    totals,
    getStatusText,

    // actions
    selectTableForOrder,
    clearOrder,
    saveOrder,
    addItemToOrder,
    updateItemQty,
    removeItem,
    addToPrintQueue,
    clearPrintQueue,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

// ---------------------------------------------
// src/utils/format.js
// ---------------------------------------------
export const formatPrice = (n) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

// ---------------------------------------------
// src/components/pos/POSLayout.module.scss
// ---------------------------------------------
:root {}

.container { display: grid; grid-template-columns: 300px 1fr 400px; height: 100vh; gap: 1rem; padding: 1rem; background: #f1f5f9; color: #0c4a6e; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
.card { background: #fff; border: 2px solid #e2e8f0; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -2px rgba(0,0,0,.05); transition: all .3s ease; }
.card:hover { transform: translateY(-2px); box-shadow: 0 20px 25px -5px rgba(0,0,0,.1), 0 10px 10px -5px rgba(0,0,0,.04); }

@media (max-width: 1200px) { .container { grid-template-columns: 250px 1fr 350px; } }
@media (max-width: 768px) { .container { grid-template-columns: 1fr; grid-template-rows: auto auto 1fr; } }

// ---------------------------------------------
// src/components/pos/POSLayout.jsx
// ---------------------------------------------
import React from "react";
import styles from "./POSLayout.module.scss";
import LeftPanel from "./LeftPanel";
import CenterPanel from "./CenterPanel";
import RightPanel from "./RightPanel";

export default function POSLayout() {
  return (
    <div className={styles.container}>
      <LeftPanel className={styles.card} />
      <CenterPanel className={styles.card} />
      <RightPanel className={styles.card} />
    </div>
  );
}

// ---------------------------------------------
// src/components/pos/LeftPanel.module.scss
// ---------------------------------------------
.wrapper { display: flex; flex-direction: column; gap: 1rem; }
.navCard { padding: 1rem; background: #fff; border: 2px solid #e2e8f0; border-radius: 1rem; }
.tabs { display: flex; gap: .5rem; margin-bottom: 1rem; }
.tab { padding: .5rem 1rem; border: none; background: #f0f9ff; color: #0284c7; border-radius: .5rem; cursor: pointer; font-weight: 500; }
.tabActive { background: #0284c7; color: #fff; }
.floor { display: flex; gap: .5rem; margin-bottom: 1rem; }
.select { padding: .5rem 1rem; border: 1px solid #e2e8f0; background: #fff; border-radius: .5rem; font-size: .875rem; flex: 1; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: .5rem; flex: 1; overflow-y: auto; max-height: 500px; }
.cardBtn { width: 100%; padding: .5rem; font-size: .75rem; border-radius: .5rem; }

.tableItem { aspect-ratio: 1; border: 2px solid #e2e8f0; border-radius: .5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: .2s; font-size: .875rem; font-weight: 500; position: relative; }
.available { background: #f0fdf4; border-color: #22c55e; color: #15803d; }
.occupied { background: #fef2f2; border-color: #ef4444; color: #dc2626; }
.reserved { background: #fffbeb; border-color: #f59e0b; color: #d97706; }
.selected { background: #0284c7; color: #fff; border-color: #0284c7; }
.dot { position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
.dotOccupied { background: #ef4444; }
.dotReserved { background: #f59e0b; }
.meta { font-size: .6rem; color: #6b7280; margin-top: .125rem; }

// ---------------------------------------------
// src/components/pos/LeftPanel.jsx
// ---------------------------------------------
import React, { useMemo, useState } from "react";
import cls from "./LeftPanel.module.scss";
import { usePos } from "../../context/PosContext";

function TableCard({ t, active, onClick }) {
  return (
    <div className={`${cls.tableItem} ${cls[t.status]} ${active ? cls.selected : ""}`} onClick={onClick}>
      <div className={`${cls.dot} ${t.status === "occupied" ? cls.dotOccupied : t.status === "reserved" ? cls.dotReserved : ""}`}></div>
      <div style={{ fontWeight: 600 }}>{t.code}</div>
      <div style={{ fontSize: ".75rem" }}>{t.capacity} chỗ</div>
      {t.customerName ? <div className={cls.meta}>{t.customerName}</div> : null}
      {t.guestCount > 0 ? <div className={cls.meta}>{t.guestCount} khách</div> : null}
    </div>
  );
}

export default function LeftPanel() {
  const {
    currentFloor, setCurrentFloor,
    tables, currentTable, selectTableForOrder,
    setCurrentOrderType,
  } = usePos();

  const floorTables = tables[currentFloor] || [];
  const [tab, setTab] = useState("tables");

  const onSwitchTab = (key) => {
    setTab(key);
    if (key === "tables") {
      setCurrentOrderType("dine_in");
    }
    if (key === "delivery") {
      setCurrentOrderType("delivery");
    }
    if (key === "takeaway") {
      setCurrentOrderType("takeaway");
    }
  };

  return (
    <div className={cls.wrapper}>
      <div className={cls.navCard}>
        <div className={cls.tabs}>
          <button className={`${cls.tab} ${tab === "tables" ? cls.tabActive : ""}`} onClick={() => onSwitchTab("tables")}>Bàn ăn</button>
          <button className={`${cls.tab} ${tab === "delivery" ? cls.tabActive : ""}`} onClick={() => onSwitchTab("delivery")}>Giao hàng</button>
          <button className={`${cls.tab} ${tab === "takeaway" ? cls.tabActive : ""}`} onClick={() => onSwitchTab("takeaway")}>Mang về</button>
        </div>

        {tab === "tables" && (
          <>
            <div className={cls.floor}>
              <select className={cls.select} value={currentFloor} onChange={(e) => setCurrentFloor(Number(e.target.value))}>
                {[1,2,3,4,5].map((f) => <option key={f} value={f}>Tầng {f}</option>)}
              </select>
              <button className={cls.cardBtn} onClick={() => { /* open reservation modal */ }}>+ Đặt bàn</button>
              <button className={cls.cardBtn} onClick={() => { /* open print queue modal */ }}>📄 Hàng đợi in</button>
            </div>

            <div className={cls.grid}>
              {floorTables.map((t) => (
                <TableCard
                  key={t.code}
                  t={t}
                  active={currentTable?.code === t.code}
                  onClick={() => selectTableForOrder(t.code, t.capacity)}
                />
              ))}
            </div>
          </>
        )}

        {tab === "delivery" && (
          <div>
            <button className={cls.cardBtn} onClick={() => { /* create delivery order */ }}>+ Đơn giao hàng mới</button>
            <div>{/* delivery list */}</div>
          </div>
        )}

        {tab === "takeaway" && (
          <div>
            <button className={cls.cardBtn} onClick={() => { /* create takeaway order */ }}>+ Đơn mang về mới</button>
            <div>{/* takeaway list */}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------
// src/components/pos/CenterPanel.module.scss
// ---------------------------------------------
.wrapper { display: flex; flex-direction: column; gap: 1rem; }
.header { padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 1rem; border: 2px solid #e2e8f0; }
.search { display: flex; gap: 1rem; align-items: center; }
.input { padding: .75rem 1rem; border: 1px solid #e2e8f0; border-radius: .5rem; width: 300px; font-size: .875rem; }
.tabs { display: flex; gap: .5rem; overflow-x: auto; padding: 0 1.5rem .5rem; }
.tab { padding: .75rem 1.5rem; border: none; background: #f8fafc; color: #6b7280; border-radius: .5rem; cursor: pointer; white-space: nowrap; font-weight: 500; }
.tabActive { background: #0284c7; color: #fff; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; padding: 0 1.5rem 1.5rem; overflow-y: auto; }
.card { border: 1px solid #e2e8f0; border-radius: .75rem; overflow: hidden; background: #fff; cursor: pointer; transition: .2s; }
.card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,.1); }
.image { width: 100%; height: 120px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); display: grid; place-items: center; font-size: 2rem; }
.info { padding: 1rem; }
.name { font-weight: 600; margin-bottom: .25rem; font-size: .875rem; }
.price { color: #0284c7; font-weight: 700; font-size: 1rem; }
.desc { color: #6b7280; font-size: .75rem; margin-top: .25rem; }

// ---------------------------------------------
// src/components/pos/CenterPanel.jsx
// ---------------------------------------------
import React from "react";
import cls from "./CenterPanel.module.scss";
import { usePos } from "../../context/PosContext";
import { formatPrice } from "../../utils/format";

export default function CenterPanel() {
  const { filteredMenu, currentCategory, setCurrentCategory, setSearchTerm, addItemToOrder } = usePos();

  const onSelectCategory = (cat) => setCurrentCategory(cat);

  return (
    <div className={cls.wrapper}>
      <div className={cls.header}>
        <h2 style={{ color: "#0c4a6e", fontWeight: 700 }}>Thực đơn</h2>
        <div className={cls.search}>
          <input className={cls.input} placeholder="Tìm kiếm món ăn..." onChange={(e) => setSearchTerm(e.target.value.toLowerCase())} />
        </div>
      </div>

      <div className={cls.tabs}>
        {[
          { key: "all", label: "Tất cả" },
          { key: "appetizer", label: "Khai vị" },
          { key: "main", label: "Món chính" },
          { key: "seafood", label: "Hải sản" },
          { key: "hotpot", label: "Lẩu" },
          { key: "drink", label: "Đồ uống" },
          { key: "dessert", label: "Tráng miệng" },
        ].map((c) => (
          <button key={c.key} className={`${cls.tab} ${currentCategory === c.key ? cls.tabActive : ""}`} onClick={() => onSelectCategory(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className={cls.grid}>
        {filteredMenu.map((item) => (
          <div key={item.id} className={cls.card} onClick={() => addItemToOrder({ menuItem: item })}>
            <div className={cls.image}>{item.emoji}</div>
            <div className={cls.info}>
              <div className={cls.name}>{item.name}</div>
              <div className={cls.price}>{formatPrice(item.price)}</div>
              <div className={cls.desc}>{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------
// src/components/pos/RightPanel.module.scss
// ---------------------------------------------
.wrapper { display: flex; flex-direction: column; gap: 1rem; height: 100%; }
.header { padding: 1.5rem; border-bottom: 1px solid #e2e8f0; }
.infoRow { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.tableInfo { font-weight: 600; color: #0284c7; }
.items { flex: 1; overflow-y: auto; padding: 0 1.5rem; }
.item { display: flex; align-items: center; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid #f1f5f9; }
.itemName { font-weight: 500; font-size: .875rem; margin-bottom: .25rem; }
.meta { color: #6b7280; font-size: .75rem; }
.qty { display: flex; align-items: center; gap: .5rem; }
.btnQty { width: 24px; height: 24px; border: 1px solid #e2e8f0; background: #fff; border-radius: .25rem; cursor: pointer; display: grid; place-items: center; font-size: .75rem; }
.summary { padding: 1.5rem; border-top: 1px solid #e2e8f0; }
.row { display: flex; justify-content: space-between; margin-bottom: .5rem; font-size: .875rem; }
.total { font-weight: 700; font-size: 1rem; color: #0284c7; border-top: 1px solid #e2e8f0; padding-top: .5rem; margin-top: 1rem; }
.actions { display: flex; gap: .5rem; margin-top: 1rem; }
.btn { padding: .75rem 1.5rem; border: none; border-radius: .5rem; cursor: pointer; font-weight: 500; flex: 1; }
.primary { background: #0284c7; color: #fff; }
.secondary { background: #f8fafc; color: #6b7280; border: 1px solid #e2e8f0; }
.success { background: #22c55e; color: #fff; }

// ---------------------------------------------
// src/components/pos/RightPanel.jsx
// ---------------------------------------------
import React from "react";
import cls from "./RightPanel.module.scss";
import { usePos } from "../../context/PosContext";
import { formatPrice } from "../../utils/format";

export default function RightPanel() {
  const { currentTable, currentOrder, updateItemQty, removeItem, totals, clearOrder, saveOrder } = usePos();

  return (
    <div className={cls.wrapper}>
      <div className={cls.header}>
        <div className={cls.infoRow}>
          <div className={cls.tableInfo}>{currentTable ? `Bàn ${currentTable.code} (${currentTable.capacity} chỗ)` : "Chọn bàn"}</div>
          <div style={{ fontSize: ".75rem", color: "#6b7280" }}>{new Date().toLocaleString("vi-VN")}</div>
        </div>
      </div>

      <div className={cls.items}>
        {currentOrder.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>Chưa có món nào được chọn</div>
        ) : (
          currentOrder.map((i) => (
            <div key={i.id} className={cls.item}>
              <div style={{ flex: 1 }}>
                <div className={cls.itemName}>{i.name}</div>
                <div className={cls.meta}>{i.cookingOption} · {i.unit} · {i.note || "Không ghi chú"}</div>
              </div>
              <div className={cls.qty}>
                <button className={cls.btnQty} onClick={() => updateItemQty(i.id, -1)}>-</button>
                <div>{i.quantity}</div>
                <button className={cls.btnQty} onClick={() => updateItemQty(i.id, +1)}>+</button>
              </div>
              <div style={{ width: 100, textAlign: "right", fontWeight: 600 }}>{formatPrice(i.total)}</div>
              <button className={cls.btnQty} onClick={() => removeItem(i.id)}>×</button>
            </div>
          ))
        )}
      </div>

      <div className={cls.summary}>
        <div className={cls.row}><span>Tạm tính:</span><span>{formatPrice(totals.subtotal)}</span></div>
        <div className={cls.row}><span>Giảm giá:</span><span>{formatPrice(totals.discount)}</span></div>
        <div className={cls.row}><span>Thuế VAT (10%):</span><span>{formatPrice(totals.tax)}</span></div>
        <div className={cls.row}><span>Phí phục vụ (5%):</span><span>{formatPrice(totals.service)}</span></div>
        <div className={`${cls.row} ${cls.total}`}><span>Tổng cộng:</span><span>{formatPrice(totals.total)}</span></div>
        <div className={cls.actions}>
          <button className={`${cls.btn} ${cls.secondary}`} onClick={clearOrder}>Xóa</button>
          <button className={`${cls.btn} ${cls.primary}`} onClick={saveOrder}>Lưu</button>
          <button className={cls.btn} style={{ background: "#8b5cf6", color: "#fff", fontSize: ".875rem" }}>🖨️ In tổng</button>
          <button className={`${cls.btn} ${cls.primary}`}>In đơn</button>
          <button className={`${cls.btn} ${cls.success}`}>Thanh toán</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------
// src/components/modals/* (stubs)
// ---------------------------------------------
// NOTE: To keep this export concise, modal components are stubbed; 
// plug them in as needed based on your current modal architecture.
// Each modal can consume usePos() to read/write state as in the HTML.

export function MenuItemModal() { return null; }
export function PaymentModal() { return null; }
export function ReceiptModal() { return null; }
export function ReservationModal() { return null; }
export function SplitTableModal() { return null; }
export function TableActionsModal() { return null; }
export function PrintModal() { return null; }
export function PrintQueueModal() { return null; }
export function PrinterSettingsModal() { return null; }

// ---------------------------------------------
// styles/pos/_variables.scss (example tokens hook)
// ---------------------------------------------
// You can map these to your project's existing DS variables
$primary: #0284c7;
$primary-700: #0369a1;
$bg: #f1f5f9;
$muted: #6b7280;
$border: #e2e8f0;
$success: #22c55e;
$warning: #f59e0b;
$danger: #ef4444;

/* End of package */
