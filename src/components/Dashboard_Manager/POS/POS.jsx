import React, { useMemo, useState } from "react";
import "./POS.scss";

// Left panel
import TableGrid from "./Tables/TablesGrid";

// Center panel
import MenuGrid from "./Menu/MenuGrid";

// Right panel
import OrderPanel from "./Order/OrderPanel";

// Modals (normalize to lowercase folder)
import MenuItemModal from "./modals/MenuItemModal";
import PaymentModal from "./modals/PaymentModal";
import PrintModal from "./modals/PrintModal";
import TableInfoModal from "./modals/TableInfoModal";

// Common
import Button from "../../common/Button";

const sampleCategories = [
  { id: "food", name: "Món ăn" },
  { id: "drink", name: "Đồ uống" },
  { id: "other", name: "Khác" },
];

const sampleItems = [
  {
    id: "pho",
    categoryId: "food",
    name: "Phở bò tái",
    price: 45000,
    emoji: "🍜",
    optionGroups: [{ name: "Cỡ", options: ["Nhỏ", "Vừa", "Lớn"] }],
  },
  { id: "com", categoryId: "food", name: "Cơm gà", price: 55000, emoji: "🍗" },
  {
    id: "cafe",
    categoryId: "drink",
    name: "Cà phê sữa",
    price: 30000,
    emoji: "☕",
  },
  {
    id: "tra",
    categoryId: "drink",
    name: "Trà chanh",
    price: 25000,
    emoji: "🫖",
  },
];

const sampleTables = Array.from({ length: 24 }).map((_, i) => ({
  id: `T${i + 1}`,
  code: `${i + 1}`,
  capacity: (i % 6) + 2,
  status: i % 7 === 0 ? "reserved" : i % 4 === 0 ? "occupied" : "available",
  floor: i < 12 ? "Tầng 1" : "Tầng 2",
  customerName: i % 4 === 0 ? "Nguyễn A" : "",
  phone: i % 4 === 0 ? "09xx xxx xxx" : "",
}));

export default function POS() {
  const [tables] = useState(sampleTables);
  const [categories] = useState(sampleCategories);
  const [items] = useState(sampleItems);

  const [selectedTable, setSelectedTable] = useState(null);

  const [existingLines, setExistingLines] = useState([]);
  const [newLines, setNewLines] = useState([]);

  const [menuModal, setMenuModal] = useState({ open: false, item: null });
  const [paymentModal, setPaymentModal] = useState(false);
  const [printModal, setPrintModal] = useState(false);
  const [infoModal, setInfoModal] = useState({ open: false, table: null });

  const allLines = useMemo(
    () => [...existingLines, ...newLines],
    [existingLines, newLines]
  );

  const addLine = ({ item, quantity, options }) => {
    const price = item.price || 0;
    const line = {
      id: `${item.id}-${Date.now()}`,
      itemId: item.id,
      name: item.name,
      quantity,
      lineTotal: price * quantity,
      options,
    };
    setNewLines((s) => [...s, line]);
  };

  const onInc = (l) => {
    const updater = (arr) =>
      arr.map((x) =>
        x.id === l.id
          ? {
              ...x,
              quantity: x.quantity + 1,
              lineTotal: (x.lineTotal / x.quantity) * (x.quantity + 1),
            }
          : x
      );
    setExistingLines(updater);
    setNewLines(updater);
  };

  const onDec = (l) => {
    const updater = (arr) =>
      arr.map((x) =>
        x.id === l.id && x.quantity > 1
          ? {
              ...x,
              quantity: x.quantity - 1,
              lineTotal: (x.lineTotal / x.quantity) * (x.quantity - 1),
            }
          : x
      );
    setExistingLines(updater);
    setNewLines(updater);
  };

  const onRemove = (l) => {
    setExistingLines((s) => s.filter((x) => x.id !== l.id));
    setNewLines((s) => s.filter((x) => x.id !== l.id));
  };

  return (
    <div className="pos-container">
      {/* Left: Tables */}
      <section className="left-panel">
        <TableGrid
          tables={tables}
          onSelectTable={setSelectedTable}
          onOpenTableInfo={(t) => setInfoModal({ open: true, table: t })}
          onMoveTable={(t) => console.log("move", t)}
          onMergeTable={(t) => console.log("merge", t)}
          onReserveTable={(t) => console.log("reserve", t)}
          onFreeTable={(t) => console.log("free", t)}
          onDeleteTableRequest={(t) => console.log("delete request", t)}
        />
      </section>

      {/* Center: Menu */}
      <section className="center-panel">
        <MenuGrid
          categories={categories}
          items={items}
          onAddItem={(item) => setMenuModal({ open: true, item })}
        />
      </section>

      {/* Right: Order */}
      <section className="right-panel">
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0" }}>
          <Button
            variant="secondary"
            onClick={() => setPrintModal(true)}
            style={{ marginRight: 8 }}
          >
            In tạm tính
          </Button>
          <Button variant="primary" onClick={() => setPaymentModal(true)}>
            Thanh toán
          </Button>
        </div>

        <OrderPanel
          table={selectedTable}
          existingLines={existingLines}
          newLines={newLines}
          onInc={onInc}
          onDec={onDec}
          onRemove={onRemove}
          onCheckout={() => setPaymentModal(true)}
          onPrint={() => setPrintModal(true)}
        />
      </section>

      {/* Modals */}
      <MenuItemModal
        open={menuModal.open}
        item={menuModal.item}
        onClose={() => setMenuModal({ open: false, item: null })}
        onConfirm={(payload) => {
          addLine(payload);
          setMenuModal({ open: false, item: null });
        }}
      />

      <PaymentModal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        lines={allLines}
        onConfirm={(info) => {
          console.log("Thanh toán:", info);
          // Demo: chuyển tất cả newLines sang existingLines sau khi thanh toán
          setExistingLines([]);
          setNewLines([]);
          setPaymentModal(false);
        }}
      />

      <PrintModal
        open={printModal}
        onClose={() => setPrintModal(false)}
        printers={[
          {
            id: "p1",
            name: "Kitchen-01",
            model: "Epson X",
            ip: "192.168.1.21",
            status: "online",
          },
          {
            id: "p2",
            name: "Bar-01",
            model: "Epson K",
            ip: "192.168.1.22",
            status: "busy",
          },
          {
            id: "p3",
            name: "Cashier-01",
            model: "HP G",
            ip: "192.168.1.23",
            status: "offline",
          },
        ]}
        queue={[
          {
            id: "q1",
            code: "K-1023",
            printerName: "Kitchen-01",
            items: 1,
            status: "completed",
            createdAt: Date.now() - 600000,
          },
          {
            id: "q2",
            code: "B-1041",
            printerName: "Bar-01",
            items: 2,
            status: "printing",
            createdAt: Date.now() - 120000,
          },
        ]}
        onPrint={(job) => {
          console.log("Print job:", job);
          setPrintModal(false);
        }}
      />

      <TableInfoModal
        open={infoModal.open}
        table={infoModal.table}
        onClose={() => setInfoModal({ open: false, table: null })}
        onCall={(phone) => window.alert(`Gọi ${phone}`)}
      />
    </div>
  );
}
