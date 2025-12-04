// src/components/Customer/TableBooking/FloorMap/FloorMap.jsx
import React, { useState, useContext, useRef } from "react";
import { AuthContext } from "../../../../context/AuthContext";
import NotifyModal from "../../NotifyModal/NotifyModal";
import { useNotification } from "../../../../hooks/useNotification";
import "./FloorMap.scss";

// Mock decor cũ – dùng khi chưa có layout thật

const FloorMap = ({
  tables,
  onSelectTable,
  selectedTable,
  layout = [],
  meta = null,
}) => {
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const { user } = useContext(AuthContext) || {};
  const [notifyTable, setNotifyTable] = useState(null);
  const { showNotification } = useNotification();
  const hasLayout = layout && layout.length > 0;
  const hasTables = tables && tables.length > 0;

  // --- PAN & ZOOM ---
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [cursorState, setCursorState] = useState("grab");

  const isPanning = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    hasMoved.current = false;
    setCursorState("grabbing");
    startPos.current = {
      x: e.clientX - transform.x,
      y: e.clientY - transform.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isPanning.current) return;
    e.preventDefault();
    const newX = e.clientX - startPos.current.x;
    const newY = e.clientY - startPos.current.y;

    if (Math.abs(newX - transform.x) > 5 || Math.abs(newY - transform.y) > 5) {
      hasMoved.current = true;
    }

    setTransform((prev) => ({ ...prev, x: newX, y: newY }));
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    setCursorState("grab");
    setTimeout(() => {
      hasMoved.current = false;
    }, 50);
  };

  const handleTableClick = (e, table) => {
    e.stopPropagation();
    if (hasMoved.current) return;

    if (table.status === "available") {
      onSelectTable(table);
    } else {
      setNotifyTable(table);
    }
  };

  const handleZoom = (delta) => {
    setTransform((prev) => {
      const newScale = Math.min(Math.max(0.5, prev.scale + delta), 3);
      return { ...prev, scale: newScale };
    });
  };

  const handleResetView = () => setTransform({ x: 0, y: 0, scale: 1 });

  const handleRegisterNotify = (contact, table) => {
    showNotification(`Đã đăng ký nhắc nhở cho bàn ${table.label}!`, "success");
    setNotifyTable(null);
  };

  // render decor mock (fallback)
  const renderMockDecorItem = (item, index) => (
    <div
      key={index}
      className={`decor-item decor-${item.type}`}
      style={item.style}
    >
      {item.label && <span className="decor-label">{item.label}</span>}
      {item.type === "plant" && <div className="plant-leaves"></div>}
      {item.type === "bar" && <div className="bar-stools"></div>}
    </div>
  );

  // render layout item từ DB
  const renderLayoutItem = (item) => (
    <div
      key={item.id}
      className={`layout-node ${item.type}`}
      style={{
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        transform: `rotate(${item.rotation || 0}deg)`,
      }}
    >
      {item.label &&
        !item.type.includes("table") &&
        !["wall", "half-wall", "window"].includes(item.type) && (
          <span className="layout-label">{item.label}</span>
        )}
    </div>
  );

  return (
    <div className="floor-map-viz">
      <div
        className={`viewport ${cursorState}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="map-transform-layer"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <div className="map-container-realistic">
            {/* Nếu có layout từ Designer -> dùng layout đó */}

            {/* Layout thật từ Designer */}
            {hasLayout && (
              <div className="layout-layer">
                {layout.map((item) => renderLayoutItem(item))}
              </div>
            )}

            {/* Empty-state: chỉ hiện khi CHƯA có layout, nhưng vẫn cho phép chọn bàn */}
            {!hasLayout && (
              <div className="empty-map-state">
                <div className="empty-icon">🏗️</div>
                <div className="empty-text">
                  <h3>Chưa có sơ đồ cho tầng này</h3>
                  <p>
                    Sơ đồ chi tiết đang được cập nhật. Bạn vẫn có thể chọn bàn
                    có sẵn trên sơ đồ bên trên.
                  </p>
                </div>
              </div>
            )}
            {/* Bàn ghế */}
            <div className="tables-layer">
              {tables.map((table) => {
                let statusClass = table.status;
                if (selectedTable?.id === table.id) statusClass = "selected";

                let titleText = "";
                switch (table.status) {
                  case "available":
                    titleText = "Bàn trống - Chọn ngay";
                    break;
                  case "payment_pending":
                    titleText = "Đang chờ thanh toán";
                    break;
                  case "cleaning":
                    titleText = "Đang dọn dẹp";
                    break;
                  case "reserved":
                    titleText = "Đã đặt trước";
                    break;
                  case "occupied":
                    titleText = "Đang có khách";
                    break;
                  default:
                    titleText = table.status;
                }

                return (
                  <div
                    key={table.id}
                    className={`table-node ${statusClass}`}
                    style={{ top: table.position.y, left: table.position.x }}
                    onClick={(e) => handleTableClick(e, table)}
                    title={titleText}
                  >
                    <div className="table-shape">
                      <span className="table-label">{table.label}</span>

                      {table.status === "payment_pending" && (
                        <span className="status-icon">💸</span>
                      )}
                      {table.status === "cleaning" && (
                        <span className="status-icon">🧹</span>
                      )}
                      {(table.status === "occupied" ||
                        table.status === "reserved") && (
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
          </div>
        </div>
      </div>

      <div className="map-controls">
        <button onClick={() => handleZoom(0.2)} title="Phóng to">
          +
        </button>
        <button onClick={() => handleZoom(-0.2)} title="Thu nhỏ">
          -
        </button>
        <button onClick={handleResetView} title="Đặt lại">
          ⟲
        </button>
      </div>

      {/* LEGEND */}
      <div className={`map-legend-smart ${isLegendOpen ? "open" : "closed"}`}>
        <div
          className="legend-header"
          onClick={() => setIsLegendOpen(!isLegendOpen)}
        >
          <span className="icon">ℹ️</span>
          {isLegendOpen && <span className="title">Trạng thái bàn</span>}
          <span className="toggle-arrow">{isLegendOpen ? "▼" : ""}</span>
        </div>
        {isLegendOpen && (
          <div className="legend-content">
            <div className="legend-grid">
              <div className="legend-item">
                <span className="symbol table-available"></span>
                <span className="text">Trống</span>
              </div>
              <div className="legend-item">
                <span className="symbol table-selected"></span>
                <span className="text">Đang chọn</span>
              </div>

              <div className="legend-divider"></div>

              <div className="legend-item">
                <span className="symbol table-payment-pending"></span>
                <span className="text">Chờ t.toán</span>
              </div>
              <div className="legend-item">
                <span className="symbol table-cleaning"></span>
                <span className="text">Đang dọn</span>
              </div>
              <div className="legend-item">
                <span className="symbol table-reserved"></span>
                <span className="text">Đã đặt</span>
              </div>
              <div className="legend-item">
                <span className="symbol table-occupied"></span>
                <span className="text">Có khách</span>
              </div>
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
  );
};

export default FloorMap;
