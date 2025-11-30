import React, { useState, useContext } from "react";
import { AuthContext } from "../../../../context/AuthContext";
import NotifyModal from "../../NotifyModal/NotifyModal";
import { useNotification } from "../../../../hooks/useNotification";
import "./FloorMap.scss";

// --- DỮ LIỆU GIẢ LẬP CÁC THÀNH PHẦN TRANG TRÍ ---
// Trong thực tế, dữ liệu này nên được lấy từ API (model Floor)
const mockDecorItems = [
  // Cửa sổ (Windows)
  { type: "window", style: { top: "10%", right: "0", height: "80px" } },
  { type: "window", style: { top: "40%", right: "0", height: "80px" } },
  { type: "window", style: { top: "70%", right: "0", height: "80px" } },

  // Cây cảnh (Plants)
  { type: "plant", style: { top: "5%", left: "5%" } },
  { type: "plant", style: { top: "90%", left: "5%" } },
  { type: "plant", style: { top: "5%", right: "5%" } },

  // Cột nhà (Pillar)
  { type: "pillar", style: { top: "50%", left: "50%" } },

  // Quầy Bar / Thu ngân (Service Area)
  {
    type: "bar",
    label: "BAR & CASHIER",
    style: { top: "0", right: "0", width: "150px", height: "60px" },
  },

  // Khu vực Bếp (Kitchen)
  {
    type: "kitchen",
    label: "KITCHEN",
    style: { bottom: "0", left: "20%", width: "120px", height: "10px" }, // Cửa bếp
  },

  // Khu vực WC
  {
    type: "wc",
    label: "WC",
    style: { bottom: "0", right: "0", width: "60px", height: "60px" },
  },

  // Thảm trải sàn (Rug) - Khu vực trung tâm
  {
    type: "rug",
    style: {
      top: "50%",
      left: "50%",
      width: "60%",
      height: "50%",
      transform: "translate(-50%, -50%)",
    },
  },
];

const FloorMap = ({ tables, onSelectTable, selectedTable }) => {
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const { user } = useContext(AuthContext) || {};
  const [notifyTable, setNotifyTable] = useState(null);
  const { showNotification } = useNotification();

  const handleRegisterNotify = (contact, table) => {
    showNotification(`Đã đăng ký nhắc nhở cho bàn ${table.label}!`, "success");
    setNotifyTable(null);
  };

  // Helper render vật thể
  const renderDecorItem = (item, index) => {
    return (
      <div
        key={index}
        className={`decor-item decor-${item.type}`}
        style={item.style}
      >
        {item.label && <span className="decor-label">{item.label}</span>}
        {/* Các element con trang trí thêm */}
        {item.type === "plant" && <div className="plant-leaves"></div>}
        {item.type === "bar" && <div className="bar-stools"></div>}
      </div>
    );
  };

  return (
    <div className="floor-map-viz">
      <div className="map-container-realistic">
        {/* --- 1. LỚP KIẾN TRÚC CỐ ĐỊNH (Tường bao) --- */}
        <div className="architectural-walls">
          <div className="wall wall--top"></div>
          <div className="wall wall--bottom"></div>
          <div className="wall wall--left"></div>
          <div className="wall wall--right"></div>

          {/* Cửa Chính */}
          <div className="door main-entry" style={{ top: "0", left: "50%" }}>
            <span className="door-label">Lối vào</span>
            <div className="door-swing"></div>
          </div>
        </div>

        {/* --- 2. LỚP TRANG TRÍ (DECOR LAYER) --- */}
        <div className="decor-layer">
          {mockDecorItems.map((item, idx) => renderDecorItem(item, idx))}
        </div>

        {/* --- 3. LỚP BÀN GHẾ (TABLES LAYER) --- */}
        <div className="tables-layer">
          {tables.map((table) => {
            let statusClass = table.status;
            if (selectedTable?.id === table.id) statusClass = "selected";

            const handleClick = () => {
              if (table.status === "available") onSelectTable(table);
              else setNotifyTable(table);
            };

            return (
              <div
                key={table.id}
                className={`table-node ${statusClass}`}
                style={{ top: table.position.y, left: table.position.x }}
                onClick={handleClick}
                title={
                  table.status === "available"
                    ? `Bàn ${table.label}: Trống`
                    : `Bàn ${table.label}: ${table.status}`
                }
              >
                <div className="table-shape">
                  <span className="table-label">{table.label}</span>
                  {table.status !== "available" && (
                    <span className="notify-bell">🔔</span>
                  )}
                </div>
                <div className="chairs-decoration">
                  <span className="chair chair-n"></span>
                  <span className="chair chair-e"></span>
                  <span className="chair chair-s"></span>
                  <span className="chair chair-w"></span>
                </div>
                <div className="capacity-badge">{table.capacity}</div>
              </div>
            );
          })}
        </div>

        {/* --- 4. BẢNG CHÚ THÍCH (LEGEND) --- */}
        <div className={`map-legend-smart ${isLegendOpen ? "open" : "closed"}`}>
          <div
            className="legend-header"
            onClick={() => setIsLegendOpen(!isLegendOpen)}
          >
            <span className="icon">ℹ️</span>
            {isLegendOpen && <span className="title">Chú thích</span>}
            <span className="toggle-arrow">{isLegendOpen ? "▼" : ""}</span>
          </div>

          {isLegendOpen && (
            <div className="legend-content">
              <div className="legend-grid">
                {/* Giữ lại các trạng thái bàn vì nó dùng màu sắc */}
                <div className="legend-item">
                  <span className="symbol table-available"></span>
                  <span className="text">Trống</span>
                </div>
                <div className="legend-item">
                  <span className="symbol table-selected"></span>
                  <span className="text">Đang chọn</span>
                </div>
                <div className="legend-item">
                  <span className="symbol table-occupied-legend">🔔</span>
                  <span className="text">Đã đặt</span>
                </div>

                <div className="legend-divider"></div>

                {/* Giữ lại Sức chứa vì nó chỉ là số nhỏ, cần giải thích */}
                <div className="legend-item">
                  <span className="symbol capacity-badge-demo">4</span>
                  <span className="text">Sức chứa</span>
                </div>

                {/* ❌ ĐÃ XÓA: Bar, WC, Lối vào (Vì trên map đã có chữ hiển thị rồi) */}
              </div>
            </div>
          )}
        </div>

        <NotifyModal
          isOpen={!!notifyTable}
          table={notifyTable}
          user={user}
          onClose={() => setNotifyTable(null)}
          onRegister={handleRegisterNotify}
        />
      </div>
    </div>
  );
};

export default FloorMap;
