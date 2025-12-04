import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql, useQuery, useMutation } from "@apollo/client";
import { useNotification } from "../../../hooks/useNotification";

import {
  ArrowLeft,
  Save,
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Trash2,
} from "lucide-react";

import "./FloorPlanDesigner.scss";

/* --- GRAPHQL --- */
const GET_FLOOR_PLAN_DATA = gql`
  query GetFloorPlanData($restaurantId: ID!) {
    floors(restaurantId: $restaurantId) {
      id
      name
      level
      layout
    }
    tables(restaurantId: $restaurantId, limit: 500) {
      id
      code
      floorId
      position {
        x
        y
        rotation
      }
      type
      capacity
    }
  }
`;

const UPDATE_FLOOR_LAYOUT = gql`
  mutation UpdateFloorLayout($id: ID!, $layout: JSON) {
    updateFloor(input: { id: $id, layout: $layout }) {
      id
    }
  }
`;

const UPDATE_TABLE_POSITION = gql`
  mutation UpdateTablePosition($id: ID!, $position: PositionInput!) {
    updateTable(input: { id: $id, position: $position }) {
      id
    }
  }
`;

/* --- PALETTE CONFIG --- */
const PALETTE_ITEMS = [
  {
    category: "Cấu trúc",
    items: [
      { type: "wall", label: "Tường", defaultSize: { w: 140, h: 10 } },
      { type: "half-wall", label: "Vách thấp", defaultSize: { w: 140, h: 8 } },
      { type: "door", label: "Cửa 1 cánh", defaultSize: { w: 70, h: 12 } },
      {
        type: "door-double",
        label: "Cửa 2 cánh",
        defaultSize: { w: 110, h: 12 },
      },
      { type: "window", label: "Cửa sổ", defaultSize: { w: 12, h: 80 } },
      { type: "corridor", label: "Hành lang", defaultSize: { w: 220, h: 14 } },
      { type: "pillar", label: "Cột", defaultSize: { w: 40, h: 40 } },
      { type: "stairs", label: "Cầu thang", defaultSize: { w: 100, h: 60 } },
    ],
  },
  {
    category: "Khu chức năng",
    items: [
      { type: "bar", label: "Quầy bar", defaultSize: { w: 180, h: 60 } },
      { type: "cashier", label: "Thu ngân", defaultSize: { w: 120, h: 50 } },
      { type: "kitchen", label: "Bếp", defaultSize: { w: 140, h: 90 } },
      { type: "buffet", label: "Buffet", defaultSize: { w: 160, h: 70 } },
      { type: "wc", label: "WC", defaultSize: { w: 80, h: 80 } },
      {
        type: "staff-corridor",
        label: "Lối staff",
        defaultSize: { w: 180, h: 14 },
      },
    ],
  },
  {
    category: "Bàn ghế & decor",
    items: [
      { type: "table", label: "Bàn tròn", defaultSize: { w: 60, h: 60 } },
      {
        type: "table-rect-2",
        label: "Bàn 2 người",
        defaultSize: { w: 70, h: 50 },
      },
      {
        type: "table-rect-4",
        label: "Bàn 4 người",
        defaultSize: { w: 90, h: 60 },
      },
      { type: "sofa", label: "Sofa", defaultSize: { w: 120, h: 60 } },
      { type: "plant", label: "Cây", defaultSize: { w: 40, h: 40 } },
      { type: "rug", label: "Thảm", defaultSize: { w: 200, h: 140 } },
    ],
  },
];

const FloorPlanDesigner = () => {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  // Apollo
  const { data, loading, refetch } = useQuery(GET_FLOOR_PLAN_DATA, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });
  const [updateFloor] = useMutation(UPDATE_FLOOR_LAYOUT);
  const [updateTable] = useMutation(UPDATE_TABLE_POSITION);

  // State
  const [floors, setFloors] = useState([]);
  const [activeFloorId, setActiveFloorId] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Viewport & tools
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [toolMode, setToolMode] = useState("select");
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const dragTarget = useRef(null);
  const startMouse = useRef({ x: 0, y: 0 });
  const startView = useRef({ x: 0, y: 0 });
  const startItem = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Init floors
  useEffect(() => {
    if (data?.floors) {
      setFloors(data.floors);
      if (!activeFloorId && data.floors.length > 0) {
        setActiveFloorId(data.floors[0].id);
      }
    }
  }, [data, activeFloorId]);

  // Load items when floor changes
  useEffect(() => {
    if (!activeFloorId || !data) return;

    const currentFloor = data.floors.find((f) => f.id === activeFloorId);
    const currentTables = data.tables.filter(
      (t) => t.floorId === activeFloorId
    );

    const decorItems = (currentFloor?.layout || []).map((item) => ({
      ...item,
      isRealTable: false,
    }));

    const tableItems = currentTables.map((t) => ({
      id: t.id,
      type: "table",
      x: t.position?.x || 0,
      y: t.position?.y || 0,
      w: 60,
      h: 60,
      rotation: t.position?.rotation || 0,
      label: t.code,
      isRealTable: true,
    }));

    setItems([...decorItems, ...tableItems]);
    setSelectedId(null);
  }, [activeFloorId, data]);

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && !e.repeat) setIsSpacePressed(true);
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        deleteLocalItem();
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") setIsSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedId, items]);

  // Helpers
  const addItem = (tpl) => {
    const container = containerRef.current;
    const centerX = (container?.clientWidth || 800) / 2;
    const centerY = (container?.clientHeight || 600) / 2;

    const newItem = {
      id: `d_${Date.now()}`,
      type: tpl.type,
      x: -view.x + centerX / view.scale,
      y: -view.y + centerY / view.scale,
      w: tpl.defaultSize.w,
      h: tpl.defaultSize.h,
      rotation: 0,
      label: tpl.label,
      isRealTable: false,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedId(newItem.id);
    setToolMode("select");
  };

  const updateLocalItem = (id, changes) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...changes } : i))
    );
  };

  const deleteLocalItem = () => {
    if (!selectedId) return;
    const found = items.find((i) => i.id === selectedId);
    if (found?.isRealTable) {
      return showNotification("Không thể xóa bàn hệ thống!", "warning");
    }
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedId(null);
  };

  // Nudge: dùng cho trường hợp khó kéo bằng chuột
  const handleNudge = (dx, dy, step = 10) => {
    if (!selectedId) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === selectedId
          ? {
              ...i,
              x: Math.round(i.x + dx * step),
              y: Math.round(i.y + dy * step),
            }
          : i
      )
    );
  };

  const handleSave = async () => {
    if (!activeFloorId) return;
    try {
      const tablesToSave = items
        .filter((i) => i.isRealTable)
        .map((i) => ({
          id: i.id,
          position: {
            x: Math.round(i.x),
            y: Math.round(i.y),
            rotation: i.rotation,
          },
        }));

      const decorToSave = items.filter((i) => !i.isRealTable);

      await updateFloor({
        variables: { id: activeFloorId, layout: decorToSave },
      });

      await Promise.all(tablesToSave.map((t) => updateTable({ variables: t })));

      await refetch();
      showNotification("✅ Đã lưu thiết kế!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Lỗi khi lưu", "error");
    }
  };

  // Mouse handlers
  const handleMouseDown = (e, id = "CANVAS") => {
    if (e.button !== 0) return;

    // tránh bôi đen khi kéo
    e.preventDefault();

    const isPanMode = isSpacePressed || toolMode === "hand" || id === "CANVAS";

    if (isPanMode) {
      setIsDragging(true);
      dragTarget.current = "CANVAS";
      startMouse.current = { x: e.clientX, y: e.clientY };
      startView.current = { x: view.x, y: view.y };
      if (id === "CANVAS") setSelectedId(null);
    } else {
      e.stopPropagation();
      setIsDragging(true);
      setSelectedId(id);
      dragTarget.current = id;
      startMouse.current = { x: e.clientX, y: e.clientY };
      const item = items.find((i) => i.id === id);
      startItem.current = { x: item.x, y: item.y };
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const dx = e.clientX - startMouse.current.x;
    const dy = e.clientY - startMouse.current.y;

    if (dragTarget.current === "CANVAS") {
      setView((v) => ({
        ...v,
        x: startView.current.x + dx,
        y: startView.current.y + dy,
      }));
    } else {
      const scaledDx = dx / view.scale;
      const scaledDy = dy / view.scale;

      let nx = startItem.current.x + scaledDx;
      let ny = startItem.current.y + scaledDy;

      nx = Math.round(nx / 10) * 10;
      ny = Math.round(ny / 10) * 10;

      updateLocalItem(dragTarget.current, { x: nx, y: ny });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragTarget.current = null;
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || isSpacePressed || toolMode === "hand") {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setView((v) => ({
        ...v,
        scale: Math.min(Math.max(0.2, v.scale + delta), 4),
      }));
    }
  };

  // Render item on canvas
  const renderItem = (item) => {
    const isSel = selectedId === item.id;
    const style = {
      left: item.x,
      top: item.y,
      width: item.w,
      height: item.h,
      transform: `rotate(${item.rotation}deg)`,
      zIndex: isSel ? 100 : item.type === "rug" ? 1 : 10,
    };
    const cls = `fp-item ${item.type} ${isSel ? "selected" : ""} ${
      item.isRealTable ? "real" : ""
    }`;

    return (
      <div
        key={item.id}
        className={cls}
        style={style}
        onMouseDown={(e) => handleMouseDown(e, item.id)}
      >
        {item.type.includes("table") && (
          <span className="label">{item.label}</span>
        )}
        {!item.type.includes("table") &&
          item.label &&
          !["wall", "half-wall", "window"].includes(item.type) && (
            <span className="decor-label">{item.label}</span>
          )}

        {isSel && (
          <>
            <div className="selection-ring" />
            <div className="corner nw" />
            <div className="corner ne" />
            <div className="corner sw" />
            <div className="corner se" />
          </>
        )}
      </div>
    );
  };

  if (loading) return <div className="fp-loading">Đang tải...</div>;
  const selectedItem = items.find((i) => i.id === selectedId);
  const isPanCursor = isSpacePressed || toolMode === "hand";

  return (
    <div
      className="fp-layout"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* HEADER */}
      <header className="fp-header">
        <div className="left-sect">
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div className="file-info">
            <div className="title">Floor Plan Designer</div>
            <div className="floor-select-wrap">
              <select
                value={activeFloorId || ""}
                onChange={(e) => setActiveFloorId(e.target.value)}
              >
                {floors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="center-tools">
          <button
            className={`tool-toggle ${toolMode === "select" ? "active" : ""}`}
            onClick={() => setToolMode("select")}
            title="Select (V)"
          >
            <MousePointer2 size={18} />
          </button>
          <button
            className={`tool-toggle ${toolMode === "hand" ? "active" : ""}`}
            onClick={() => setToolMode("hand")}
            title="Pan (Space)"
          >
            <Hand size={18} />
          </button>
        </div>

        <div className="right-sect">
          <div className="zoom-pill">
            <button
              onClick={() =>
                setView((v) => ({
                  ...v,
                  scale: Math.max(0.2, v.scale - 0.1),
                }))
              }
            >
              <ZoomOut size={16} />
            </button>
            <span>{Math.round(view.scale * 100)}%</span>
            <button
              onClick={() =>
                setView((v) => ({ ...v, scale: Math.min(4, v.scale + 0.1) }))
              }
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <button className="btn-primary" onClick={handleSave}>
            <Save size={16} /> Lưu
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="fp-body" ref={containerRef}>
        {/* PALETTE */}
        <div className="fp-palette" onMouseDown={(e) => e.stopPropagation()}>
          {PALETTE_ITEMS.map((grp, i) => (
            <div key={i} className="tool-group">
              <div className="group-label">{grp.category}</div>
              <div className="group-grid">
                {grp.items.map((t, index) => (
                  <button
                    key={index}
                    className="tool-btn"
                    title={t.label}
                    onMouseDown={(e) => {
                      // tránh bôi đen khi giữ chuột trong sidebar
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={() => addItem(t)}
                  >
                    <div
                      className={`palette-swatch palette-${t.type}`
                        .replace("half-wall", "halfwall")
                        .replace("door-double", "door2")}
                    />
                    <span className="palette-label">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* PROPERTIES PANEL */}
        {selectedItem && (
          <div
            className="fp-properties"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="inspector-head">
              <span
                className={`badge ${
                  selectedItem.isRealTable ? "real" : "decor"
                }`}
              >
                {selectedItem.isRealTable ? "BÀN HỆ THỐNG" : "TRANG TRÍ"}
              </span>
              <button className="close" onClick={() => setSelectedId(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="inspector-content">
              <div className="row-2">
                <div className="input-group">
                  <label>X</label>
                  <input
                    type="number"
                    value={Math.round(selectedItem.x)}
                    onChange={(e) =>
                      updateLocalItem(selectedItem.id, {
                        x: +e.target.value,
                      })
                    }
                  />
                </div>
                <div className="input-group">
                  <label>Y</label>
                  <input
                    type="number"
                    value={Math.round(selectedItem.y)}
                    onChange={(e) =>
                      updateLocalItem(selectedItem.id, {
                        y: +e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="row-2">
                <div className="input-group">
                  <label>W</label>
                  <input
                    type="number"
                    value={selectedItem.w}
                    onChange={(e) =>
                      updateLocalItem(selectedItem.id, {
                        w: +e.target.value,
                      })
                    }
                  />
                </div>
                <div className="input-group">
                  <label>H</label>
                  <input
                    type="number"
                    value={selectedItem.h}
                    onChange={(e) =>
                      updateLocalItem(selectedItem.id, {
                        h: +e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Xoay ({selectedItem.rotation}°)</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={selectedItem.rotation}
                  onChange={(e) =>
                    updateLocalItem(selectedItem.id, {
                      rotation: +e.target.value,
                    })
                  }
                />
              </div>

              <div className="input-group">
                <label>Nhãn</label>
                <input
                  value={selectedItem.label || ""}
                  onChange={(e) =>
                    updateLocalItem(selectedItem.id, {
                      label: e.target.value,
                    })
                  }
                  disabled={selectedItem.isRealTable}
                />
              </div>

              {/* NUDGE CONTROLS */}
              <div className="nudge-group">
                <label>Di chuyển (giữ Shift: 1px)</label>
                <div className="nudge-grid">
                  <button
                    onClick={(e) => handleNudge(0, -1, e.shiftKey ? 1 : 10)}
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => handleNudge(-1, 0, e.shiftKey ? 1 : 10)}
                  >
                    ←
                  </button>
                  <button
                    onClick={(e) => handleNudge(1, 0, e.shiftKey ? 1 : 10)}
                  >
                    →
                  </button>
                  <button
                    onClick={(e) => handleNudge(0, 1, e.shiftKey ? 1 : 10)}
                  >
                    ↓
                  </button>
                </div>
              </div>

              <div className="divider" />
              <button
                className="btn-danger"
                onClick={deleteLocalItem}
                disabled={selectedItem.isRealTable}
              >
                <Trash2 size={16} />{" "}
                {selectedItem.isRealTable ? "Không thể xóa" : "Xóa"}
              </button>
            </div>
          </div>
        )}

        {/* CANVAS */}
        <div
          className={`fp-canvas-viewport ${
            isPanCursor || isDragging ? (isDragging ? "grabbing" : "grab") : ""
          }`}
          onMouseDown={(e) => handleMouseDown(e, "CANVAS")}
          onWheel={handleWheel}
        >
          <div
            className="fp-canvas-world"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          >
            <div className="dot-grid" />
            {items.map((item) => renderItem(item))}
          </div>
        </div>

        {/* RESET VIEW BUTTON */}
        <div className="fp-controls" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => setView({ x: 0, y: 0, scale: 1 })}
            title="Reset View"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloorPlanDesigner;
