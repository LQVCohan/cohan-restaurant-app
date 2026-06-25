import React, { useState, useContext, useRef } from "react";
import { AuthContext } from "../../../../../context/AuthContext";
import NotifyModal from "../../../NotifyModal/NotifyModal";
import { useNotification } from "../../../../../hooks/useNotification";
import { Plus, Minus, RotateCcw, Info, X } from "lucide-react"; // Import Icons
import "./FloorMap.scss";

const FloorMap = ({
  tables,
  onSelectTable,
  selectedTable,
  layout = [],
  meta = null,
  theme = "premium", // Prop mới để kích hoạt style premium
}) => {
  const [isLegendOpen, setIsLegendOpen] = useState(false); // Mặc định đóng cho gọn
  const { user } = useContext(AuthContext) || {};
  const [notifyTable, setNotifyTable] = useState(null);
  const [visualTable, setVisualTable] = useState(null);
  const { showNotification } = useNotification();
  const hasLayout = layout && layout.length > 0;

  // --- PAN & ZOOM ---
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [cursorState, setCursorState] = useState("grab");
  const isPanning = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const hasVisualPreview = (table) =>
    Boolean(
      table?.vrUrl ||
        (Array.isArray(table?.photos) && table.photos.length > 0) ||
        table?.visualConfig?.modelUrl ||
        table?.visualConfig?.modelKey,
    );

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

  // Render các element kiến trúc (Tường, Cửa, Decor)
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
      {/* Hiển thị label cho các khu vực lớn */}
      {item.label && !item.type.includes("table") && item.w > 40 && (
        <span className="layout-label">{item.label}</span>
      )}

      {/* Decor cụ thể */}
      {item.type === "plant" && <div className="plant-leaf-effect"></div>}
      {item.type === "window" && <div className="window-glare"></div>}
    </div>
  );

  return (
    <div className={`floor-map-viz ${theme}`}>
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
          <div
            className="map-container-realistic"
            style={meta?.width && meta?.height ? { width: meta.width, height: meta.height } : undefined}
          >
            {/* 1. LAYOUT LAYER */}
            {hasLayout ? (
              <div className="layout-layer">
                {layout.map((item) => renderLayoutItem(item))}
              </div>
            ) : (
              <div className="empty-map-state">
                <div className="empty-content">
                  <span className="icon">📐</span>
                  <div>
                    <h3>Sơ đồ kiến trúc</h3>
                    <p>Dữ liệu đang được cập nhật</p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. TABLES LAYER */}
            <div className="tables-layer">
              {tables.map((table) => {
                const isSelected = selectedTable?.id === table.id;
                let statusClass = table.status;
                if (isSelected) statusClass = "selected";

                return (
                  <div
                    key={table.id}
                    className={`table-node ${statusClass}`}
                    style={{ top: table.position.y, left: table.position.x }}
                    onClick={(e) => handleTableClick(e, table)}
                  >
                    {/* Ghế ngồi xung quanh */}
                    <div className="chairs-wrapper">
                      {[...Array(table.capacity > 4 ? 4 : table.capacity)].map(
                        (_, i) => (
                          <div key={i} className={`chair chair-${i}`}></div>
                        ),
                      )}
                    </div>

                    {/* Mặt bàn chính */}
                    <div className="table-surface">
                      <span className="table-label">{table.label}</span>

                      {/* Icons trạng thái */}
                      {table.status === "payment_pending" && (
                        <span className="status-badge dollar">$</span>
                      )}
                      {table.status === "cleaning" && (
                        <span className="status-badge clean">🧹</span>
                      )}
                      {(table.status === "occupied" ||
                        table.status === "reserved") && (
                        <span className="status-badge bell">🔔</span>
                      )}
                      {hasVisualPreview(table) && (
                        <button
                          type="button"
                          className="visual-preview-trigger"
                          title="Xem ảnh/360/3D của bàn"
                          onClick={(event) => {
                            event.stopPropagation();
                            setVisualTable(table);
                          }}
                        >
                          👁
                        </button>
                      )}
                    </div>

                    {/* Capacity pill */}
                    <div className="capacity-pill">
                      {table.capacity} <span style={{ fontSize: 8 }}>👤</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS (Floating) */}
      <div className="map-controls-premium">
        <button onClick={() => handleZoom(0.2)} title="Phóng to">
          <Plus size={20} />
        </button>
        <button onClick={() => handleZoom(-0.2)} title="Thu nhỏ">
          <Minus size={20} />
        </button>
        <div className="divider"></div>
        <button onClick={handleResetView} title="Đặt lại">
          <RotateCcw size={18} />
        </button>
      </div>

      {/* MINI LEGEND (Collapsible) */}
      <div className={`mini-legend ${isLegendOpen ? "expanded" : "collapsed"}`}>
        <button
          className="legend-toggle"
          onClick={() => setIsLegendOpen(!isLegendOpen)}
        >
          {isLegendOpen ? <X size={18} /> : <Info size={18} />}
        </button>

        {isLegendOpen && (
          <div className="legend-content">
            <h4>Chú thích</h4>
            <div className="l-row">
              <span className="dot avl"></span> Trống
            </div>
            <div className="l-row">
              <span className="dot sel"></span> Đang chọn
            </div>
            <div className="l-row">
              <span className="dot occ"></span> Có khách
            </div>
            <div className="l-row">
              <span className="dot res"></span> Đặt trước
            </div>
            <div className="l-row">
              <span className="dot cln"></span> Dọn dẹp
            </div>
          </div>
        )}
      </div>

      {visualTable && (
        <div className="table-visual-preview" role="dialog" aria-modal="true">
          <div className="table-visual-preview__card">
            <button
              type="button"
              className="table-visual-preview__close"
              onClick={() => setVisualTable(null)}
            >
              ×
            </button>
            <h3>Bàn {visualTable.label}</h3>
            <p>Sức chứa: {visualTable.capacity} khách</p>
            {Array.isArray(visualTable.photos) && visualTable.photos.length > 0 && (
              <div className="table-visual-preview__photos">
                {visualTable.photos.slice(0, 4).map((src, index) => (
                  <img key={`${src}_${index}`} src={src} alt={`Bàn ${visualTable.label} ${index + 1}`} />
                ))}
              </div>
            )}
            {visualTable.vrUrl && (
              <a href={visualTable.vrUrl} target="_blank" rel="noreferrer">
                Mở không gian 360
              </a>
            )}
            {visualTable.visualConfig?.modelUrl && (
              <a href={visualTable.visualConfig.modelUrl} target="_blank" rel="noreferrer">
                Mở mô hình 3D
              </a>
            )}
            {!visualTable.vrUrl && !visualTable.visualConfig?.modelUrl && visualTable.visualConfig?.modelKey && (
              <p>Mô hình 3D: {visualTable.visualConfig.modelLabel || visualTable.visualConfig.modelKey}</p>
            )}
          </div>
        </div>
      )}

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
