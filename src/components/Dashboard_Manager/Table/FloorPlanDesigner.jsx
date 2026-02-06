import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql, useQuery, useMutation } from "@apollo/client";
import { useNotification } from "../../../hooks/useNotification";
import Modal from "../../../components/common/Modal";

import {
  ArrowLeft,
  Save,
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Undo2,
  Sparkles,
  ChevronDown,
  ChevronRight,
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
      isWatching
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
      status
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

const CREATE_TABLE = gql`
  mutation CreateTable($input: CreateTableInput!) {
    createTable(input: $input) {
      id
      code
      floorId
      capacity
      type
      status
      position {
        x
        y
        rotation
      }
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
  {
    category: "Ký hiệu",
    items: [
      {
        type: "symbol",
        label: "Thêm ký hiệu",
        defaultSize: { w: 50, h: 50 },
      },
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
  const [createTable] = useMutation(CREATE_TABLE);

  // State
  const [floors, setFloors] = useState([]);
  const [activeFloorId, setActiveFloorId] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [showSymbolModal, setShowSymbolModal] = useState(false);
  const [symbolForm, setSymbolForm] = useState({ icon: "", name: "" });
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [tableForm, setTableForm] = useState({
    code: "",
    capacity: 4,
    type: "standard",
  });
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiForm, setAiForm] = useState({
    tableCount: 8,
    codePrefix: "AI",
    includeWalls: true,
    includePlants: true,
    includeStairs: false,
  });
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  });

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
  const savedSnapshotRef = useRef({ decor: new Map(), tables: new Map() });
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const dragStartItemsRef = useRef(null);
  const dragMovedRef = useRef(false);
  const lockNotifiedRef = useRef(false);

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
    savedSnapshotRef.current = {
      decor: buildDecorMap(decorItems),
      tables: buildTableMap(currentTables),
    };
    historyRef.current = [];
    historyIndexRef.current = -1;
    setCanUndo(false);
    setSelectedId(null);
  }, [activeFloorId, data]);

  useEffect(() => {
    if (!activeFloorId || !data) return;
    const currentFloor = data.floors.find((f) => f.id === activeFloorId);
    const currentTables = data.tables.filter(
      (t) => t.floorId === activeFloorId
    );
    const activeCount = currentTables.filter(
      (t) => t.status && t.status !== "available"
    ).length;
    const isWatching = !!currentFloor?.isWatching;
    if (activeCount > 0) {
      setIsLocked(true);
      setLockMessage(
        `Có ${activeCount} bàn đang hoạt động. Không thể chỉnh sửa sơ đồ.`
      );
    } else if (isWatching) {
      setIsLocked(true);
      setLockMessage("Tầng đang có khách xem sơ đồ. Không thể chỉnh sửa.");
    } else {
      setIsLocked(false);
      setLockMessage("");
    }
  }, [activeFloorId, data]);

  useEffect(() => {
    if (isLocked && lockMessage && !lockNotifiedRef.current) {
      showNotification(lockMessage, "warning");
      lockNotifiedRef.current = true;
    }
    if (!isLocked) lockNotifiedRef.current = false;
  }, [isLocked, lockMessage, showNotification]);

  useEffect(() => {
    const updateSize = () => {
      const node = containerRef.current;
      if (!node) return;
      setContainerSize({
        width: node.clientWidth || 0,
        height: node.clientHeight || 0,
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
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
  const cloneItems = (list) => list.map((item) => ({ ...item }));

  const pushHistory = (snapshot) => {
    historyRef.current = historyRef.current.slice(
      0,
      historyIndexRef.current + 1
    );
    historyRef.current.push(cloneItems(snapshot));
    historyIndexRef.current += 1;
    setCanUndo(historyIndexRef.current >= 0);
  };

  const handleUndo = () => {
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
    if (historyIndexRef.current < 0) return;
    const snapshot = historyRef.current[historyIndexRef.current];
    historyIndexRef.current -= 1;
    setItems(cloneItems(snapshot));
    setSelectedId(null);
    setCanUndo(historyIndexRef.current >= 0);
  };

  const buildDecorMap = (decorItems) =>
    new Map(
      decorItems.map((item) => [
        item.id,
        {
          id: item.id,
          type: item.type,
          x: Math.round(item.x),
          y: Math.round(item.y),
          w: item.w,
          h: item.h,
          rotation: item.rotation,
          label: item.label || "",
          icon: item.icon || "",
        },
      ])
    );

  const buildTableMap = (tables) =>
    new Map(
      tables.map((table) => [
        table.id,
        {
          x: Math.round(table.position?.x || 0),
          y: Math.round(table.position?.y || 0),
          rotation: table.position?.rotation || 0,
        },
      ])
    );

  const hasMapChanges = (nextMap, prevMap) => {
    if (nextMap.size !== prevMap.size) return true;
    for (const [key, nextValue] of nextMap.entries()) {
      const prevValue = prevMap.get(key);
      if (!prevValue) return true;
      if (
        Object.keys(nextValue).some(
          (field) => nextValue[field] !== prevValue[field]
        )
      ) {
        return true;
      }
    }
    return false;
  };

  const findAvailablePosition = ({
    existing,
    startX,
    startY,
    step = 80,
    size = 60,
    maxRadius = 10,
  }) => {
    const isOverlapping = (x, y) =>
      existing.some((t) => {
        const w = t.w || size;
        const h = t.h || size;
        const bx = t.x ?? 0;
        const by = t.y ?? 0;
        return (
          x < bx + w + 10 &&
          x + size + 10 > bx &&
          y < by + h + 10 &&
          y + size + 10 > by
        );
      });
    if (!isOverlapping(startX, startY)) return { x: startX, y: startY };
    for (let r = 1; r <= maxRadius; r += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          const x = startX + dx * step;
          const y = startY + dy * step;
          if (!isOverlapping(x, y)) return { x, y };
        }
      }
    }
    return { x: startX, y: startY };
  };

  const addItem = (tpl) => {
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
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
    setItems((prev) => {
      pushHistory(prev);
      return [...prev, newItem];
    });
    setSelectedId(newItem.id);
    setToolMode("select");
  };

  const updateLocalItem = (id, changes, recordHistory = false) => {
    setItems((prev) => {
      if (recordHistory) pushHistory(prev);
      return prev.map((i) => (i.id === id ? { ...i, ...changes } : i));
    });
  };

  const deleteLocalItem = () => {
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
    if (!selectedId) return;
    const found = items.find((i) => i.id === selectedId);
    if (found?.isRealTable) {
      return showNotification("Không thể xóa bàn hệ thống!", "warning");
    }
    setItems((prev) => {
      pushHistory(prev);
      return prev.filter((i) => i.id !== selectedId);
    });
    setSelectedId(null);
  };

  // Nudge: dùng cho trường hợp khó kéo bằng chuột
  const handleNudge = (dx, dy, step = 10) => {
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
    if (!selectedId) return;
    const current = items.find((i) => i.id === selectedId);
    if (!current) return;
    updateLocalItem(
      selectedId,
      {
        x: Math.round(current.x + dx * step),
        y: Math.round(current.y + dy * step),
      },
      true
    );
  };

  const handleSave = async () => {
    if (!activeFloorId) return;
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
    try {
      const decorItems = items.filter((i) => !i.isRealTable);
      const tableItems = items.filter((i) => i.isRealTable);
      const currentDecorMap = buildDecorMap(decorItems);
      const currentTableMap = new Map(
        tableItems.map((table) => [
          table.id,
          {
            x: Math.round(table.x),
            y: Math.round(table.y),
            rotation: table.rotation,
          },
        ])
      );

      const decorChanged = hasMapChanges(
        currentDecorMap,
        savedSnapshotRef.current.decor
      );
      const tablesChanged = hasMapChanges(
        currentTableMap,
        savedSnapshotRef.current.tables
      );

      if (!decorChanged && !tablesChanged) {
        showNotification("Không có thay đổi để lưu.", "info");
        return;
      }

      if (decorChanged) {
        await updateFloor({
          variables: { id: activeFloorId, layout: decorItems },
        });
      }

      if (tablesChanged) {
        const tablesToSave = tableItems
          .filter((table) => {
            const prev = savedSnapshotRef.current.tables.get(table.id);
            if (!prev) return true;
            return (
              prev.x !== Math.round(table.x) ||
              prev.y !== Math.round(table.y) ||
              prev.rotation !== table.rotation
            );
          })
          .map((table) => ({
            id: table.id,
            position: {
              x: Math.round(table.x),
              y: Math.round(table.y),
              rotation: table.rotation,
            },
          }));

        await Promise.all(
          tablesToSave.map((table) => updateTable({ variables: table }))
        );
      }

      await refetch();
      savedSnapshotRef.current = {
        decor: currentDecorMap,
        tables: currentTableMap,
      };
      showNotification("✅ Đã lưu thiết kế!", "success");
    } catch (err) {
      console.error(err);
      showNotification("Lỗi khi lưu", "error");
    }
  };

  const handleAddSymbol = () => {
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
    setShowSymbolModal(true);
  };

  const handleCreateSymbol = () => {
    if (!symbolForm.icon.trim()) {
      showNotification("Vui lòng nhập ký hiệu/emoji.", "warning");
      return;
    }
    const container = containerRef.current;
    const centerX = (container?.clientWidth || 800) / 2;
    const centerY = (container?.clientHeight || 600) / 2;
    const newItem = {
      id: `s_${Date.now()}`,
      type: "symbol",
      x: -view.x + centerX / view.scale,
      y: -view.y + centerY / view.scale,
      w: 50,
      h: 50,
      rotation: 0,
      label: symbolForm.name || "Ký hiệu",
      icon: symbolForm.icon,
      isRealTable: false,
    };
    setItems((prev) => {
      pushHistory(prev);
      return [...prev, newItem];
    });
    setSelectedId(newItem.id);
    setShowSymbolModal(false);
    setSymbolForm({ icon: "", name: "" });
  };

  const handleCreateTable = async () => {
    if (!activeFloorId) return;
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
    if (!tableForm.code.trim()) {
      showNotification("Vui lòng nhập mã bàn.", "warning");
      return;
    }
    const existingTables = items.filter((i) => i.isRealTable);
    const container = containerRef.current;
    const centerX = (container?.clientWidth || 800) / 2;
    const centerY = (container?.clientHeight || 600) / 2;
    const position = findAvailablePosition({
      existing: existingTables,
      startX: -view.x + centerX / view.scale,
      startY: -view.y + centerY / view.scale,
    });
    try {
      await createTable({
        variables: {
          input: {
            restaurantId,
            floorId: activeFloorId,
            code: tableForm.code.trim(),
            capacity: Number(tableForm.capacity) || 4,
            type: tableForm.type,
            status: "available",
            position: {
              x: Math.round(position.x),
              y: Math.round(position.y),
              rotation: 0,
            },
          },
        },
      });
      await refetch();
      showNotification(
        `Đã thêm bàn ${tableForm.code} ở tầng đang chọn. Hãy kiểm tra vị trí nếu cần.`,
        "success"
      );
      setShowAddTableModal(false);
      setTableForm({ code: "", capacity: 4, type: "standard" });
    } catch (err) {
      console.error(err);
      showNotification("Không thể thêm bàn.", "error");
    }
  };

  const handleSmartLayout = () => {
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
    setShowAiModal(true);
  };

  const handleGenerateSmartLayout = async () => {
    if (!activeFloorId) return;
    if (isLocked) {
      showNotification(lockMessage || "Không thể chỉnh sửa sơ đồ.", "warning");
      return;
    }
    if (aiForm.tableCount <= 0) {
      showNotification("Số bàn phải lớn hơn 0.", "warning");
      return;
    }
    const existingTables = items.filter((i) => i.isRealTable);
    const newDecor = [];
    const container = containerRef.current;
    const centerX = (container?.clientWidth || 800) / 2;
    const centerY = (container?.clientHeight || 600) / 2;
    const startX = -view.x + centerX / view.scale - 300;
    const startY = -view.y + centerY / view.scale - 200;
    const tablePositions = [];

    for (let i = 0; i < aiForm.tableCount; i += 1) {
      const pos = findAvailablePosition({
        existing: [...existingTables, ...tablePositions],
        startX: startX + (i % 4) * 120,
        startY: startY + Math.floor(i / 4) * 120,
        step: 80,
      });
      tablePositions.push({ x: pos.x, y: pos.y, w: 60, h: 60 });
    }

    if (aiForm.includeWalls) {
      newDecor.push(
        {
          id: `ai_wall_${Date.now()}_1`,
          type: "wall",
          x: startX - 80,
          y: startY - 60,
          w: 640,
          h: 10,
          rotation: 0,
          label: "Tường",
          isRealTable: false,
        },
        {
          id: `ai_wall_${Date.now()}_2`,
          type: "wall",
          x: startX - 80,
          y: startY + 420,
          w: 640,
          h: 10,
          rotation: 0,
          label: "Tường",
          isRealTable: false,
        }
      );
    }

    if (aiForm.includePlants) {
      newDecor.push(
        {
          id: `ai_plant_${Date.now()}_1`,
          type: "plant",
          x: startX - 40,
          y: startY + 40,
          w: 40,
          h: 40,
          rotation: 0,
          label: "Cây",
          isRealTable: false,
        },
        {
          id: `ai_plant_${Date.now()}_2`,
          type: "plant",
          x: startX + 520,
          y: startY + 280,
          w: 40,
          h: 40,
          rotation: 0,
          label: "Cây",
          isRealTable: false,
        }
      );
    }

    if (aiForm.includeStairs) {
      newDecor.push({
        id: `ai_stairs_${Date.now()}`,
        type: "stairs",
        x: startX + 500,
        y: startY - 20,
        w: 100,
        h: 60,
        rotation: 0,
        label: "Cầu thang",
        isRealTable: false,
      });
    }

    const newTablesPayload = tablePositions.map((pos, index) => ({
      code: `${aiForm.codePrefix || "AI"}-${index + 1}`,
      position: { x: Math.round(pos.x), y: Math.round(pos.y), rotation: 0 },
    }));

    try {
      pushHistory(items);
      for (const t of newTablesPayload) {
        await createTable({
          variables: {
            input: {
              restaurantId,
              floorId: activeFloorId,
              code: t.code,
              capacity: 4,
              type: "standard",
              status: "available",
              position: t.position,
            },
          },
        });
      }
      const nextDecor = [...items.filter((i) => !i.isRealTable), ...newDecor];
      await updateFloor({
        variables: { id: activeFloorId, layout: nextDecor },
      });
      await refetch();
      showNotification("Đã tạo sơ đồ thông minh. Hãy kiểm tra lại bố cục.", "success");
      setShowAiModal(false);
    } catch (err) {
      console.error(err);
      showNotification("Không thể tạo sơ đồ thông minh.", "error");
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
      if (isLocked) {
        showNotification(
          lockMessage || "Không thể chỉnh sửa sơ đồ.",
          "warning"
        );
        return;
      }
      e.stopPropagation();
      setIsDragging(true);
      setSelectedId(id);
      dragTarget.current = id;
      startMouse.current = { x: e.clientX, y: e.clientY };
      const item = items.find((i) => i.id === id);
      startItem.current = { x: item.x, y: item.y };
      dragStartItemsRef.current = cloneItems(items);
      dragMovedRef.current = false;
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

      dragMovedRef.current = true;
      updateLocalItem(dragTarget.current, { x: nx, y: ny });
    }
  };

  const handleMouseUp = () => {
    if (
      dragTarget.current &&
      dragTarget.current !== "CANVAS" &&
      dragMovedRef.current &&
      dragStartItemsRef.current
    ) {
      pushHistory(dragStartItemsRef.current);
    }
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
        title={item.type === "symbol" ? item.label : undefined}
        onMouseDown={(e) => handleMouseDown(e, item.id)}
      >
        {item.type === "symbol" && (
          <>
            <span className="symbol-icon">{item.icon}</span>
            {item.label && <span className="symbol-tooltip">{item.label}</span>}
          </>
        )}
        {item.type.includes("table") && (
          <span className="label">{item.label}</span>
        )}
        {!item.type.includes("table") &&
          item.label &&
          !["wall", "half-wall", "window", "symbol"].includes(item.type) && (
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
  const isReadOnly = isLocked;
  const miniMapWidth = 180;
  const miniMapHeight = 140;
  const mapBounds = items.reduce(
    (acc, item) => {
      const right = item.x + (item.w || 0);
      const bottom = item.y + (item.h || 0);
      return {
        minX: Math.min(acc.minX, item.x),
        minY: Math.min(acc.minY, item.y),
        maxX: Math.max(acc.maxX, right),
        maxY: Math.max(acc.maxY, bottom),
      };
    },
    { minX: 0, minY: 0, maxX: 800, maxY: 600 }
  );
  const boundsWidth = Math.max(mapBounds.maxX - mapBounds.minX, 200);
  const boundsHeight = Math.max(mapBounds.maxY - mapBounds.minY, 200);
  const minimapScale = Math.min(
    miniMapWidth / boundsWidth,
    miniMapHeight / boundsHeight
  );
  const viewWorldWidth = containerSize.width / view.scale;
  const viewWorldHeight = containerSize.height / view.scale;
  const viewWorldX = -view.x / view.scale;
  const viewWorldY = -view.y / view.scale;
  const viewportStyle = {
    width: viewWorldWidth * minimapScale,
    height: viewWorldHeight * minimapScale,
    transform: `translate(${(viewWorldX - mapBounds.minX) * minimapScale}px, ${
      (viewWorldY - mapBounds.minY) * minimapScale
    }px)`,
  };

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
              title="Thu nhỏ (Ctrl + lăn chuột)"
            >
              <ZoomOut size={16} />
            </button>
            <span>{Math.round(view.scale * 100)}%</span>
            <button
              onClick={() =>
                setView((v) => ({ ...v, scale: Math.min(4, v.scale + 0.1) }))
              }
              title="Phóng to (Ctrl + lăn chuột)"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          <button
            className="btn-secondary"
            onClick={handleUndo}
            disabled={!canUndo || isLocked}
            title="Hoàn tác (Ctrl + Z)"
          >
            <Undo2 size={16} /> Undo
          </button>
          <button
            className="btn-secondary"
            onClick={handleSmartLayout}
            title="Sơ đồ thông minh"
            disabled={isLocked}
          >
            <Sparkles size={16} /> Sơ đồ thông minh
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowAddTableModal(true)}
            disabled={isLocked}
            title="Thêm bàn hệ thống"
          >
            ➕ Bàn
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={isLocked}>
            <Save size={16} /> Lưu
          </button>
        </div>
      </header>

      {/* BODY */}
      <div className="fp-body" ref={containerRef}>
        {/* PALETTE */}
        <div
          className={`fp-palette ${isPaletteCollapsed ? "collapsed" : ""}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="palette-toggle-circle"
            onClick={() => setIsPaletteCollapsed((prev) => !prev)}
            title={isPaletteCollapsed ? "Mở rộng" : "Thu gọn"}
          >
            {isPaletteCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </button>
          {!isPaletteCollapsed && (
            <>
              <div className="palette-header">
                <span>Bộ công cụ</span>
              </div>
              {PALETTE_ITEMS.map((grp, i) => {
                const isCollapsed = collapsedGroups.has(grp.category);
                return (
                  <div key={i} className="tool-group">
                    <button
                      className="group-label"
                      onClick={() => {
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(grp.category)) {
                            next.delete(grp.category);
                          } else {
                            next.add(grp.category);
                          }
                          return next;
                        });
                      }}
                    >
                      <span>{grp.category}</span>
                      {isCollapsed ? (
                        <ChevronRight size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                    {!isCollapsed && (
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
                            onClick={() =>
                              t.type === "symbol"
                                ? handleAddSymbol()
                                : addItem(t)
                            }
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
                    )}
                  </div>
                );
              })}
            </>
          )}
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
                      }, true)
                    }
                    disabled={isReadOnly}
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
                      }, true)
                    }
                    disabled={isReadOnly}
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
                      }, true)
                    }
                    disabled={isReadOnly}
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
                      }, true)
                    }
                    disabled={isReadOnly}
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
                    }, true)
                  }
                  disabled={isReadOnly}
                />
              </div>

              <div className="input-group">
                <label>Nhãn</label>
                <input
                  value={selectedItem.label || ""}
                  onChange={(e) =>
                    updateLocalItem(selectedItem.id, {
                      label: e.target.value,
                    }, true)
                  }
                  disabled={selectedItem.isRealTable || isReadOnly}
                />
              </div>
              {selectedItem.type === "symbol" && (
                <div className="input-group">
                  <label>Ký hiệu</label>
                  <input
                    value={selectedItem.icon || ""}
                    onChange={(e) =>
                      updateLocalItem(
                        selectedItem.id,
                        { icon: e.target.value },
                        true
                      )
                    }
                    placeholder="Ví dụ: 🍀 hoặc :)"
                    disabled={isReadOnly}
                  />
                </div>
              )}

              {/* NUDGE CONTROLS */}
              <div className="nudge-group">
                <label>Di chuyển (giữ Shift: 1px)</label>
                <div className="nudge-grid">
                  <button
                    onClick={(e) => handleNudge(0, -1, e.shiftKey ? 1 : 10)}
                    disabled={isReadOnly}
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => handleNudge(-1, 0, e.shiftKey ? 1 : 10)}
                    disabled={isReadOnly}
                  >
                    ←
                  </button>
                  <button
                    onClick={(e) => handleNudge(1, 0, e.shiftKey ? 1 : 10)}
                    disabled={isReadOnly}
                  >
                    →
                  </button>
                  <button
                    onClick={(e) => handleNudge(0, 1, e.shiftKey ? 1 : 10)}
                    disabled={isReadOnly}
                  >
                    ↓
                  </button>
                </div>
              </div>

              <div className="divider" />
              <button
                className="btn-danger"
                onClick={deleteLocalItem}
                disabled={selectedItem.isRealTable || isReadOnly}
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
          {isLocked && (
            <div className="fp-lock-overlay">
              <div className="lock-card">
                <strong>Không thể chỉnh sửa</strong>
                <p>{lockMessage}</p>
              </div>
            </div>
          )}
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

        {/* MINI MAP */}
        <div className="fp-minimap">
          <div className="minimap-title">Tổng quan</div>
          <div
            className="minimap-canvas"
            style={{ width: miniMapWidth, height: miniMapHeight }}
          >
            {items.map((item) => (
              <div
                key={`mini_${item.id}`}
                className={`minimap-item ${item.isRealTable ? "table" : "decor"}`}
                style={{
                  width: Math.max(item.w * minimapScale, 4),
                  height: Math.max(item.h * minimapScale, 4),
                  transform: `translate(${
                    (item.x - mapBounds.minX) * minimapScale
                  }px, ${(item.y - mapBounds.minY) * minimapScale}px)`,
                }}
              />
            ))}
            <div className="minimap-viewport" style={viewportStyle} />
          </div>
        </div>
      </div>

      <Modal
        isOpen={showSymbolModal}
        onClose={() => setShowSymbolModal(false)}
        className="fp-modal-shell fp-modal-shell--symbol"
        title="Thêm ký hiệu"
      >
        <div className="fp-modal">
          <div className="fp-modal-row">
            <label>Tên ký hiệu</label>
            <input
              value={symbolForm.name}
              onChange={(e) =>
                setSymbolForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Ví dụ: Khu check-in"
            />
          </div>
          <div className="fp-modal-row">
            <label>Icon/Emoji</label>
            <input
              value={symbolForm.icon}
              onChange={(e) =>
                setSymbolForm((prev) => ({ ...prev, icon: e.target.value }))
              }
              placeholder="Ví dụ: ⭐️ hoặc :)"
            />
          </div>
          <div className="fp-modal-actions">
            <button className="btn-secondary" onClick={() => setShowSymbolModal(false)}>
              Hủy
            </button>
            <button className="btn-primary" onClick={handleCreateSymbol}>
              Thêm ký hiệu
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddTableModal}
        onClose={() => setShowAddTableModal(false)}
        className="fp-modal-shell fp-modal-shell--table"
        title="Thêm bàn vào sơ đồ"
      >
        <div className="fp-modal">
          <div className="fp-modal-intro">
            <strong>Thêm bàn nhanh</strong>
            <p>
              Bàn mới sẽ được đặt ở vị trí gần nhất không chồng lấn trong sơ đồ.
            </p>
          </div>
          <div className="fp-modal-row">
            <label>Mã bàn</label>
            <input
              value={tableForm.code}
              onChange={(e) =>
                setTableForm((prev) => ({ ...prev, code: e.target.value }))
              }
              placeholder="VD: A1, B2..."
            />
          </div>
          <div className="fp-modal-row">
            <label>Sức chứa</label>
            <input
              type="number"
              value={tableForm.capacity}
              onChange={(e) =>
                setTableForm((prev) => ({ ...prev, capacity: e.target.value }))
              }
            />
          </div>
          <div className="fp-modal-row">
            <label>Loại bàn</label>
            <select
              value={tableForm.type}
              onChange={(e) =>
                setTableForm((prev) => ({ ...prev, type: e.target.value }))
              }
            >
              <option value="standard">Trong nhà</option>
              <option value="vip">VIP</option>
              <option value="outdoor">Ngoài trời</option>
              <option value="bar">Bar</option>
            </select>
          </div>
          <div className="fp-modal-actions">
            <button className="btn-secondary" onClick={() => setShowAddTableModal(false)}>
              Hủy
            </button>
            <button className="btn-primary" onClick={handleCreateTable}>
              Thêm bàn
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        className="fp-modal-shell fp-modal-shell--ai"
        title="Sơ đồ thông minh"
      >
        <div className="fp-modal">
          <div className="fp-modal-intro">
            <strong>Trợ lý tạo sơ đồ A.I</strong>
            <p>
              Chọn số bàn và thành phần cần có, hệ thống sẽ đề xuất bố cục cơ bản.
            </p>
          </div>
          <div className="fp-modal-row">
            <label>Số bàn</label>
            <input
              type="number"
              min="1"
              value={aiForm.tableCount}
              onChange={(e) =>
                setAiForm((prev) => ({
                  ...prev,
                  tableCount: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="fp-modal-row">
            <label>Prefix mã bàn</label>
            <input
              value={aiForm.codePrefix}
              onChange={(e) =>
                setAiForm((prev) => ({ ...prev, codePrefix: e.target.value }))
              }
              placeholder="AI"
            />
          </div>
          <div className="fp-modal-row checkbox">
            <label>
              <input
                type="checkbox"
                checked={aiForm.includeWalls}
                onChange={(e) =>
                  setAiForm((prev) => ({
                    ...prev,
                    includeWalls: e.target.checked,
                  }))
                }
              />
              Tự thêm tường
            </label>
          </div>
          <div className="fp-modal-row checkbox">
            <label>
              <input
                type="checkbox"
                checked={aiForm.includePlants}
                onChange={(e) =>
                  setAiForm((prev) => ({
                    ...prev,
                    includePlants: e.target.checked,
                  }))
                }
              />
              Thêm cây trang trí
            </label>
          </div>
          <div className="fp-modal-row checkbox">
            <label>
              <input
                type="checkbox"
                checked={aiForm.includeStairs}
                onChange={(e) =>
                  setAiForm((prev) => ({
                    ...prev,
                    includeStairs: e.target.checked,
                  }))
                }
              />
              Có cầu thang
            </label>
          </div>
          <div className="fp-modal-actions">
            <button className="btn-secondary" onClick={() => setShowAiModal(false)}>
              Hủy
            </button>
            <button className="btn-primary" onClick={handleGenerateSmartLayout}>
              Tạo sơ đồ
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FloorPlanDesigner;
