import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Eye, Minus, Plus, RotateCcw, X } from "lucide-react";
import { AuthContext } from "../../../../../context/AuthContext";
import NotifyModal from "../../../NotifyModal/NotifyModal";
import { useNotification } from "../../../../../hooks/useNotification";
import "./FloorMap.scss";

const TABLE_STATUS_LABELS = {
  available: "trống",
  occupied: "đang có khách",
  reserved: "đã được đặt",
  cleaning: "đang chuẩn bị",
  payment_pending: "đang chờ thanh toán",
  offline: "không hoạt động",
};

const MIN_MAP_SCALE = 0.1;
const MAX_MAP_SCALE = 3;
const MAX_AUTO_FIT_SCALE = 1.4;
const MAP_FIT_PADDING = 40;
const CONTENT_PADDING = 24;

const getMapContentBounds = (tables, layout) => {
  const rects = [
    ...layout.map((item) => ({
      x: Number(item?.x),
      y: Number(item?.y),
      w: Number(item?.w),
      h: Number(item?.h),
    })),
    ...tables.map((table) => {
      const position = table?.position || {};
      return {
        x: Number(position.x ?? 0),
        y: Number(position.y ?? 0),
        w: Math.max(56, Number(position.w || 68)),
        h: Math.max(56, Number(position.h || 68)),
      };
    }),
  ].filter(({ x, y, w, h }) =>
    [x, y, w, h].every(Number.isFinite) && w > 0 && h > 0,
  );

  if (!rects.length) return null;

  return rects.reduce(
    (bounds, rect) => ({
      minX: Math.min(bounds.minX, rect.x),
      minY: Math.min(bounds.minY, rect.y),
      maxX: Math.max(bounds.maxX, rect.x + rect.w),
      maxY: Math.max(bounds.maxY, rect.y + rect.h),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
};

const FloorMap = ({
  tables = [],
  onSelectTable = () => {},
  selectedTable,
  layout = [],
  meta = null,
  floorName = "khu vực hiện tại",
  theme = "premium",
}) => {
  const { user } = useContext(AuthContext) || {};
  const [notifyTable, setNotifyTable] = useState(null);
  const [visualTable, setVisualTable] = useState(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [cursorState, setCursorState] = useState("grab");
  const { showNotification } = useNotification();
  const hasLayout = Array.isArray(layout) && layout.length > 0;

  const viewportRef = useRef(null);
  const fittedTransformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const activePointerId = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const visualTriggerRef = useRef(null);
  const previewCloseRef = useRef(null);

  const fitMapToContent = useCallback(() => {
    const viewport = viewportRef.current;
    const bounds = getMapContentBounds(tables, layout);
    const viewportWidth = viewport?.clientWidth || 0;
    const viewportHeight = viewport?.clientHeight || 0;

    if (!viewportWidth || !viewportHeight || !bounds) {
      fittedTransformRef.current = { x: 0, y: 0, scale: 1 };
      setTransform(fittedTransformRef.current);
      return;
    }

    const minX = bounds.minX - CONTENT_PADDING;
    const minY = bounds.minY - CONTENT_PADDING;
    const maxX = bounds.maxX + CONTENT_PADDING;
    const maxY = bounds.maxY + CONTENT_PADDING;
    const contentWidth = Math.max(maxX - minX, 1);
    const contentHeight = Math.max(maxY - minY, 1);
    const availableWidth = Math.max(viewportWidth - MAP_FIT_PADDING * 2, 1);
    const availableHeight = Math.max(viewportHeight - MAP_FIT_PADDING * 2, 1);
    const scale = Number(
      Math.min(
        Math.max(
          Math.min(availableWidth / contentWidth, availableHeight / contentHeight),
          MIN_MAP_SCALE,
        ),
        MAX_AUTO_FIT_SCALE,
      ).toFixed(2),
    );
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const fittedTransform = {
      x: Number((scale * (viewportWidth / 2 - contentCenterX)).toFixed(2)),
      y: Number((scale * (viewportHeight / 2 - contentCenterY)).toFixed(2)),
      scale,
    };

    fittedTransformRef.current = fittedTransform;
    setTransform(fittedTransform);
  }, [layout, tables]);

  useLayoutEffect(() => {
    fitMapToContent();
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    if (typeof ResizeObserver !== "undefined") {
      const resizeObserver = new ResizeObserver(fitMapToContent);
      resizeObserver.observe(viewport);
      return () => resizeObserver.disconnect();
    }

    window.addEventListener("resize", fitMapToContent);
    return () => window.removeEventListener("resize", fitMapToContent);
  }, [fitMapToContent]);

  const hasVisualPreview = (table) =>
    Boolean(
      table?.vrUrl ||
        (Array.isArray(table?.photos) && table.photos.length > 0) ||
        table?.visualConfig?.modelUrl ||
        table?.visualConfig?.modelKey,
    );

  const handlePointerDown = (event) => {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest("button, a")) return;

    activePointerId.current = event.pointerId;
    isPanning.current = true;
    hasMoved.current = false;
    setCursorState("grabbing");
    startPos.current = {
      x: event.clientX - transform.x,
      y: event.clientY - transform.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!isPanning.current || activePointerId.current !== event.pointerId) return;
    event.preventDefault();
    const newX = event.clientX - startPos.current.x;
    const newY = event.clientY - startPos.current.y;
    if (Math.abs(newX - transform.x) > 5 || Math.abs(newY - transform.y) > 5) {
      hasMoved.current = true;
    }
    setTransform((previous) => ({ ...previous, x: newX, y: newY }));
  };

  const handlePointerEnd = (event) => {
    if (activePointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerId.current = null;
    isPanning.current = false;
    setCursorState("grab");
    window.setTimeout(() => {
      hasMoved.current = false;
    }, 60);
  };

  const handleTableAction = (event, table) => {
    event.stopPropagation();
    if (hasMoved.current) return;
    if (table.status === "available") {
      onSelectTable(table);
      return;
    }
    setNotifyTable(table);
  };

  const handleTableKeyDown = (event, table) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleTableAction(event, table);
  };

  const handleZoom = (delta) => {
    setTransform((previous) => ({
      ...previous,
      scale: Math.min(
        Math.max(MIN_MAP_SCALE, Number((previous.scale + delta).toFixed(2))),
        MAX_MAP_SCALE,
      ),
    }));
  };

  const handleResetView = () => setTransform(fittedTransformRef.current);

  const handleRegisterNotify = (_contact, table) => {
    showNotification(`Đã đăng ký nhắc nhở cho bàn ${table.label}.`, "success");
    setNotifyTable(null);
  };

  const openVisualPreview = (event, table) => {
    event.stopPropagation();
    visualTriggerRef.current = event.currentTarget;
    setVisualTable(table);
  };

  const closeVisualPreview = () => {
    setVisualTable(null);
    window.requestAnimationFrame(() => visualTriggerRef.current?.focus());
  };

  useEffect(() => {
    if (!visualTable) return undefined;
    previewCloseRef.current?.focus();
    const handleEscape = (event) => {
      if (event.key === "Escape") closeVisualPreview();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [visualTable]);

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
      {item.label && !item.type.includes("table") && item.w > 40 && (
        <span className="layout-label">{item.label}</span>
      )}
      {item.type === "plant" && <div className="plant-leaf-effect" />}
      {item.type === "window" && <div className="window-glare" />}
    </div>
  );

  return (
    <div className={`floor-map-viz ${theme}`}>
      <div
        ref={viewportRef}
        className={`viewport ${cursorState}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
      >
        <div
          id="floor-map-canvas"
          className="map-transform-layer"
          style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
        >
          <div
            className="map-container-realistic"
            style={meta?.width && meta?.height ? { width: meta.width, height: meta.height } : undefined}
          >
            {hasLayout ? (
              <div className="layout-layer">{layout.map((item) => renderLayoutItem(item))}</div>
            ) : (
              <div className="empty-map-state">
                <div className="empty-content">
                  <span className="icon" aria-hidden="true">⌗</span>
                  <div>
                    <h3>Sơ đồ đang được hoàn thiện</h3>
                    <p>Bạn vẫn có thể chọn các bàn đang hiển thị.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="tables-layer" aria-label={`Danh sách bàn tại ${floorName}`}>
              {tables.map((table) => {
                const isSelected = selectedTable?.id === table.id;
                const statusClass = isSelected ? "selected" : table.status;
                const capacity = Math.max(1, Number(table.capacity || 1));
                const position = table.position || {};
                const statusLabel = isSelected
                  ? "đang được chọn"
                  : TABLE_STATUS_LABELS[table.status] || table.status || "chưa rõ trạng thái";
                const lockedLabel = table.isViewingLocked ? ", đang được một khách khác xem" : "";
                const tableLabel = table.label || table.code || table.id;
                const tableWidth = Math.max(56, Number(position.w || 68));
                const tableHeight = Math.max(56, Number(position.h || 68));

                return (
                  <div
                    key={table.id}
                    className={`table-node ${statusClass} shape-${position.shape || "round"}`}
                    style={{
                      top: position.y ?? 0,
                      left: position.x ?? 0,
                      width: tableWidth,
                      height: tableHeight,
                      "--table-rotation": `${position.rotation || 0}deg`,
                    }}
                  >
                    <div className="chairs-wrapper" aria-hidden="true">
                      {Array.from({ length: Math.min(capacity, 4) }).map((_, index) => (
                        <span key={index} className={`chair chair-${index}`} />
                      ))}
                    </div>

                    <button
                      type="button"
                      className="table-surface"
                      aria-label={`Bàn ${tableLabel}, ${capacity} chỗ, ${statusLabel}${lockedLabel}`}
                      aria-pressed={isSelected}
                      onClick={(event) => handleTableAction(event, table)}
                      onKeyDown={(event) => handleTableKeyDown(event, table)}
                    >
                      <span className="table-label">{tableLabel}</span>
                      <span className="table-status-copy">{statusLabel}</span>
                      {table.status === "payment_pending" && <span className="status-badge dollar">₫</span>}
                      {table.status === "cleaning" && <span className="status-badge clean">Dọn</span>}
                      {(table.status === "occupied" || table.status === "reserved") && (
                        <span className="status-badge reserved">Đặt</span>
                      )}
                    </button>

                    {hasVisualPreview(table) && (
                      <button
                        type="button"
                        className="visual-preview-trigger"
                        aria-label={`Xem hình ảnh hoặc không gian 3D của bàn ${tableLabel}`}
                        onClick={(event) => openVisualPreview(event, table)}
                      >
                        <Eye size={14} aria-hidden="true" />
                      </button>
                    )}

                    <span className="capacity-pill" aria-hidden="true">{capacity} chỗ</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="map-controls-premium" role="group" aria-label="Điều khiển sơ đồ">
        <button type="button" onClick={() => handleZoom(0.2)} aria-label="Phóng to sơ đồ" aria-controls="floor-map-canvas">
          <Plus size={19} aria-hidden="true" />
        </button>
        <output className="zoom-output" aria-live="polite">{Math.round(transform.scale * 100)}%</output>
        <button type="button" onClick={() => handleZoom(-0.2)} aria-label="Thu nhỏ sơ đồ" aria-controls="floor-map-canvas">
          <Minus size={19} aria-hidden="true" />
        </button>
        <span className="divider" aria-hidden="true" />
        <button type="button" onClick={handleResetView} aria-label="Căn lại sơ đồ theo dữ liệu bàn" aria-controls="floor-map-canvas">
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </div>

      {visualTable && (
        <div
          className="table-visual-preview"
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-visual-preview-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeVisualPreview();
          }}
        >
          <div className="table-visual-preview__card">
            <button
              ref={previewCloseRef}
              type="button"
              className="table-visual-preview__close"
              aria-label="Đóng phần xem trước bàn"
              onClick={closeVisualPreview}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <span className="table-visual-preview__eyebrow">Góc nhìn trước khi đặt</span>
            <h3 id="table-visual-preview-title">Bàn {visualTable.label}</h3>
            <p>Sức chứa {visualTable.capacity} khách</p>
            {Array.isArray(visualTable.photos) && visualTable.photos.length > 0 && (
              <div className="table-visual-preview__photos">
                {visualTable.photos.slice(0, 4).map((src, index) => (
                  <img key={`${src}_${index}`} src={src} alt={`Không gian bàn ${visualTable.label}, ảnh ${index + 1}`} />
                ))}
              </div>
            )}
            <div className="table-visual-preview__links">
              {visualTable.vrUrl && (
                <a href={visualTable.vrUrl} target="_blank" rel="noreferrer">Mở không gian 360</a>
              )}
              {visualTable.visualConfig?.modelUrl && (
                <a href={visualTable.visualConfig.modelUrl} target="_blank" rel="noreferrer">Mở mô hình 3D</a>
              )}
            </div>
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
