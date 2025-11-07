// src/components/Dashboard_Manager/POS/TableManagement.jsx
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useContext,
} from "react";
import Modal from "../../../components/common/Modal";
import Button from "../../../components/common/Button";
import Card from "../../../components/common/Card";
import { AuthContext } from "@/context/AuthContext";
import "./TableManagement.scss";
import { useNotification } from "../../../hooks/useNotification";
import useTableManagement from "@/hooks/useTableManagement";
import useFloorManagement from "@/hooks/useFloorManagement";
import TableActionsLiteModal from "./TableActionsLiteModal";
const TableManagement = () => {
  const { showNotification } = useNotification();

  // Restaurant selector
  const useRestaurant = () => {
    const { restaurants } = useContext(AuthContext);
    return { restaurantList: restaurants || [] };
  };
  const { restaurantList } = useRestaurant();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [showLiteModal, setShowLiteModal] = useState(false);
  const [liteTable, setLiteTable] = useState(null);

  useEffect(() => {
    if (!selectedRestaurantId && restaurantList?.length > 0) {
      setSelectedRestaurantId(
        String(restaurantList[0].id ?? restaurantList[0].restaurantId)
      );
    }
  }, [restaurantList, selectedRestaurantId]);

  const restaurantId = selectedRestaurantId || null;

  // Floors
  const {
    floors: floorsRaw,
    floorsLoading,
    floorsError,
    activeLevel,
    setActiveLevel,
    getIdFromLevel,
    getLevelFromId,
    refetchFloors,
  } = useFloorManagement({ restaurantId });

  // Tables
  const {
    tables: tablesRaw,
    tablesLoading,
    tablesError,
    setTableStatus,
    createTable,
    updateTable,
    refetchTables,
    moveTable,
    swapTableCodes,
    mergeTables,
    splitTables,
    deleteTable,
    fetchTableByCode,
  } = useTableManagement({ restaurantId });

  // Map floors
  const floors = useMemo(
    () =>
      (floorsRaw || []).map((f) => ({
        id: String(f.id),
        name: f.name || `Tầng ${f.level ?? ""}`,
        icon: "🏢",
        description: "",
        level: Number(f.level),
        active:
          activeLevel != null ? Number(f.level) === Number(activeLevel) : false,
      })),
    [floorsRaw, activeLevel]
  );

  // Map tables
  const tablesMapped = useMemo(
    () =>
      (tablesRaw || []).map((t) => ({
        id: String(t.id),
        number: t.code || "",
        seats: Number(t.capacity ?? 0),
        status: t.status || "available",
        floorId: t.floorId != null ? String(t.floorId) : null,
        floorLevel: t.floorLevel != null ? Number(t.floorLevel) : null,
        area: t.type || "standard",
        x: t.position?.x ?? 100,
        y: t.position?.y ?? 100,
      })),
    [tablesRaw]
  );

  // Floor selection
  const [currentFloor, setCurrentFloor] = useState(null);
  useEffect(() => setCurrentFloor(null), [restaurantId]);
  useEffect(() => {
    if (!floors.length) return;
    if (currentFloor == null) {
      if (activeLevel != null) {
        const id = getIdFromLevel(activeLevel);
        if (id) setCurrentFloor(String(id));
      } else {
        setCurrentFloor(String(floors[0].id));
      }
    }
  }, [floors, activeLevel, currentFloor, getIdFromLevel]);

  const selectFloor = useCallback(
    (floorId) => {
      setCurrentFloor(String(floorId));
      const lvl = getLevelFromId(floorId);
      if (lvl != null) setActiveLevel(Number(lvl));
    },
    [setActiveLevel, getLevelFromId]
  );

  // UI states
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFilters, setCurrentFilters] = useState({
    status: "",
    area: "",
  });
  const [currentSort, setCurrentSort] = useState("number");
  const [showTableDiagram, setShowTableDiagram] = useState(false);
  const [diagramSearchQuery, setDiagramSearchQuery] = useState("");
  const [diagramFloorFilter, setDiagramFloorFilter] = useState("");
  const [diagramStatusFilter, setDiagramStatusFilter] = useState("");
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showAddTableModal, setShowAddTableModal] = useState(false);

  const [floorForm, setFloorForm] = useState({
    name: "",
    icon: "",
    description: "",
  });
  const [editingFloor, setEditingFloor] = useState(null);
  const [tableForm, setTableForm] = useState({
    number: "",
    seats: 4,
    floorId: "",
    area: "standard",
  });

  // Utils
  const getStatusText = (status) =>
    ({
      available: "Trống",
      occupied: "Có khách",
      reserved: "Đã đặt",
      cleaning: "Dọn dẹp",
      offline: "Ngưng",
    }[status] || status);

  const getAreaText = (area) =>
    ({
      standard: "Trong nhà",
      vip: "VIP",
      outdoor: "Ngoài trời",
      bar: "Quầy bar",
      private: "Phòng riêng",
      booth: "Booth",
    }[area] || area);

  const getTableStats = () => {
    const stats = tablesMapped.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});
    return {
      total: tablesMapped.length,
      available: stats.available || 0,
      occupied: stats.occupied || 0,
      reserved: stats.reserved || 0,
      cleaning: stats.cleaning || 0,
    };
  };

  const getFloorTableCount = (floorId) =>
    tablesMapped.filter((t) => String(t.floorId) === String(floorId)).length;

  // Actions
  const changeTableStatus = useCallback(
    async (tableId, newStatus) => {
      try {
        await setTableStatus({ id: String(tableId), status: newStatus });
        // không cần refetch vì có optimistic, nhưng nếu muốn chắc chắn:
        // await refetchTables?.();
      } catch (e) {
        console.error(e);
        showNotification("❌ Lỗi đổi trạng thái bàn!", "error");
      }
    },
    [setTableStatus, showNotification]
  );

  // Floor ops (stub)
  const saveFloor = () => {
    showNotification("ℹ️ Thêm/Sửa tầng sẽ được hỗ trợ sau (server).", "info");
    setShowFloorModal(false);
    setFloorForm({ name: "", icon: "", description: "" });
    setEditingFloor(null);
  };
  const editFloor = (floorId) => {
    const floor = floors.find((f) => String(f.id) === String(floorId));
    if (!floor) return;
    setEditingFloor(floor);
    setFloorForm({
      name: floor.name,
      icon: floor.icon,
      description: floor.description || "",
    });
    setShowFloorModal(true);
  };
  const deleteFloor = () => {
    showNotification("ℹ️ Xóa tầng sẽ được hỗ trợ sau (server).", "info");
  };

  // Create table
  const saveTable = useCallback(async () => {
    const { number, seats, floorId, area } = tableForm;
    if (!number || !seats || !floorId || !area) {
      showNotification("Vui lòng điền đầy đủ thông tin!", "error");
      return;
    }
    try {
      await createTable({
        restaurantId,
        code: String(number).trim(),
        capacity: Number(seats),
        floorId: String(floorId),
        type: area || "standard",
        status: "available",
        position: { x: 120, y: 120 },
      });
      // ✅ refetch lại danh sách bàn
      await refetchTables?.();

      setShowAddTableModal(false);
      setTableForm({ number: "", seats: 4, floorId: "", area: "standard" });
      showNotification("✅ Đã thêm bàn mới!", "success");
    } catch (e) {
      console.error(e);
      showNotification("❌ Lỗi khi thêm bàn!", "error");
    }
  }, [tableForm, createTable, restaurantId, refetchTables, showNotification]);

  // Filters
  const getFilteredTables = () => {
    let filtered = [...tablesMapped];
    if (currentFloor)
      filtered = filtered.filter(
        (t) => String(t.floorId) === String(currentFloor)
      );
    if (searchQuery) {
      filtered = filtered.filter((t) =>
        (t.number || "").toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (currentFilters.status)
      filtered = filtered.filter((t) => t.status === currentFilters.status);
    if (currentFilters.area)
      filtered = filtered.filter((t) => t.area === currentFilters.area);
    filtered.sort((a, b) => {
      switch (currentSort) {
        case "number":
          return (a.number || "").localeCompare(b.number || "");
        case "status": {
          const order = { occupied: 0, reserved: 1, cleaning: 2, available: 3 };
          return (order[a.status] ?? 4) - (order[b.status] ?? 4);
        }
        default:
          return 0;
      }
    });
    return filtered;
  };

  const getDiagramFilteredTables = () => {
    let filtered = [...tablesMapped];
    if (diagramFloorFilter)
      filtered = filtered.filter(
        (t) => String(t.floorId) === String(diagramFloorFilter)
      );
    if (diagramStatusFilter)
      filtered = filtered.filter((t) => t.status === diagramStatusFilter);
    if (diagramSearchQuery) {
      filtered = filtered.filter((t) =>
        (t.number || "")
          .toLowerCase()
          .includes(diagramSearchQuery.toLowerCase())
      );
    }
    return filtered;
  };

  // Chart (giữ nguyên)
  const renderCircularChart = () => {
    const { total, available, occupied, reserved, cleaning } = getTableStats();
    if (total === 0) {
      return (
        <div className="chart-container">
          <div className="chart-wrapper">
            <div className="chart-center">
              <div className="chart-total">0</div>
              <div className="chart-label">Chưa có bàn</div>
            </div>
          </div>
        </div>
      );
    }
    const radius = 55;
    const circumference = 2 * Math.PI * radius;
    const pct = (v) => (v / total) * circumference;
    let offset = 0;
    const parts = [
      { val: available, color: "#10b981" },
      { val: occupied, color: "#f59e0b" },
      { val: reserved, color: "#3b82f6" },
      { val: cleaning, color: "#8b5cf6" },
    ];
    return (
      <div className="chart-container">
        <div className="chart-wrapper">
          <svg className="chart-svg" width="140" height="140">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="16"
            />
            {parts.map((p, idx) => {
              if (p.val <= 0) return null;
              const dash = `${pct(p.val)} ${circumference}`;
              const el = (
                <circle
                  key={idx}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="16"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 70 70)"
                />
              );
              offset += pct(p.val);
              return el;
            })}
          </svg>
          <div className="chart-center">
            <div className="chart-total">{total}</div>
            <div className="chart-label">Tổng bàn</div>
          </div>
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color available"></div>
            <span>Trống ({available})</span>
          </div>
          <div className="legend-item">
            <div className="legend-color occupied"></div>
            <span>Có khách ({occupied})</span>
          </div>
          <div className="legend-item">
            <div className="legend-color reserved"></div>
            <span>Đã đặt ({reserved})</span>
          </div>
          <div className="legend-item">
            <div className="legend-color cleaning"></div>
            <span>Dọn dẹp ({cleaning})</span>
          </div>
        </div>
      </div>
    );
  };

  const renderTableActions = (table) => {
    switch (table.status) {
      case "available":
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="info"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "reserved");
              }}
            >
              📅 Đặt
            </Button>
            <Button
              size="sm"
              variant="warning"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "occupied");
              }}
            >
              🍽️ Nhận
            </Button>
          </div>
        );
      case "occupied":
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "cleaning");
              }}
            >
              🧹 Trả bàn
            </Button>
          </div>
        );
      case "reserved":
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="success"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "occupied");
              }}
            >
              ✅ Đến
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "available");
              }}
            >
              ❌ Hủy
            </Button>
          </div>
        );
      case "cleaning":
        return (
          <div className="table-actions">
            <Button
              size="sm"
              variant="primary"
              onClick={(e) => {
                e.stopPropagation();
                changeTableStatus(table.id, "available");
              }}
            >
              ✨ Dọn xong
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  if (!restaurantList || restaurantList.length === 0) {
    return (
      <div className="table-management">
        <div className="error">
          Không tìm thấy nhà hàng nào trong tài khoản.
        </div>
      </div>
    );
  }

  return (
    <div className="table-management">
      {/* Top Actions */}
      <div className="top-actions">
        <h1>🍽️ Quản Lý Bàn Ăn</h1>

        <div className="restaurant-selector">
          <label className="selector-label">🏬 Nhà hàng</label>
          <div className="selector-wrap">
            <select
              className="selector-input"
              value={selectedRestaurantId || ""}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
            >
              {(restaurantList || []).map((r) => {
                const id = String(r.id ?? r.restaurantId);
                const name = r.name || r.restaurantName || `Restaurant ${id}`;
                return (
                  <option key={id} value={id}>
                    {name}
                  </option>
                );
              })}
            </select>
            <span className="selector-caret">▾</span>
          </div>
        </div>

        <div className="top-actions-right">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTableDiagram(true)}
          >
            🗺️ Sơ đồ bàn
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFloorModal(true)}
          >
            🏗️ Thêm tầng
          </Button>
        </div>
      </div>

      {(floorsLoading || tablesLoading) && (
        <div className="loading" style={{ marginTop: 16 }}>
          Đang tải dữ liệu…
        </div>
      )}
      {(!floorsLoading && floorsError) || (!tablesLoading && tablesError) ? (
        <div className="error" style={{ marginTop: 16 }}>
          Không tải được dữ liệu!
        </div>
      ) : null}

      <div className="main-layout">
        <aside className="table_sidebar">
          <div className="table_sidebar-section">{renderCircularChart()}</div>

          <div className="table_sidebar-section">
            <h3 className="table_sidebar-title">🔍 Tìm bàn</h3>
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Tìm bàn theo số…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>
          </div>

          <div className="table_sidebar-section">
            <h3 className="table_sidebar-title">🏢 Tầng</h3>
            <div className="floor-list">
              {floors.map((floor) => (
                <div
                  key={floor.id}
                  className={`floor-item ${floor.active ? "active" : ""}`}
                  onClick={() => selectFloor(floor.id)}
                >
                  <div className="floor-info">
                    <span>{floor.icon}</span>
                    <div>
                      <div className="floor-name">{floor.name}</div>
                      <div className="floor-count">
                        {getFloorTableCount(floor.id)} bàn
                      </div>
                    </div>
                  </div>
                  <div className="floor-actions">
                    <button
                      className="floor-btn edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        editFloor(floor.id);
                      }}
                      title="Sửa"
                    >
                      ✏️
                    </button>
                    <button
                      className="floor-btn delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFloor(floor.id);
                      }}
                      title="Xóa"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="main-content">
          <div className="tables-container">
            <div className="tables-header">
              <h2>
                {currentFloor
                  ? `${
                      floors.find((f) => String(f.id) === String(currentFloor))
                        ?.icon
                    } ${
                      floors.find((f) => String(f.id) === String(currentFloor))
                        ?.name
                    }`
                  : "📍 Tất cả bàn"}
              </h2>
              <div className="header-actions">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowAddTableModal(true)}
                >
                  ➕ Thêm bàn
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    refetchFloors?.();
                    refetchTables?.(); // ✅ làm mới cả bàn
                    showNotification("🔄 Đã làm mới dữ liệu!", "info");
                  }}
                >
                  🔄 Làm mới
                </Button>
              </div>
            </div>

            <div className="table-controls">
              <div className="filter-section">
                <select
                  className="filter-select"
                  value={currentFilters.status}
                  onChange={(e) =>
                    setCurrentFilters((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="available">🟢 Trống</option>
                  <option value="occupied">🟡 Có khách</option>
                  <option value="reserved">🔵 Đã đặt</option>
                  <option value="cleaning">🟣 Dọn dẹp</option>
                  <option value="offline">⚪ Ngưng</option>
                </select>
                <select
                  className="filter-select"
                  value={currentFilters.area}
                  onChange={(e) =>
                    setCurrentFilters((prev) => ({
                      ...prev,
                      area: e.target.value,
                    }))
                  }
                >
                  <option value="">Tất cả khu vực</option>
                  <option value="standard">🏢 Trong nhà</option>
                  <option value="vip">👑 VIP</option>
                  <option value="outdoor">🌳 Ngoài trời</option>
                  <option value="bar">🍸 Quầy bar</option>
                  <option value="private">🚪 Phòng riêng</option>
                </select>
                <select
                  className="filter-select"
                  value={currentSort}
                  onChange={(e) => setCurrentSort(e.target.value)}
                >
                  <option value="number">Số bàn A-Z</option>
                  <option value="status">Theo trạng thái</option>
                </select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCurrentFilters({ status: "", area: "" });
                    setCurrentSort("number");
                  }}
                >
                  🗑️ Xóa lọc
                </Button>
              </div>
            </div>

            <div className="tables-grid">
              {getFilteredTables().length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🍽️</div>
                  <div className="empty-state-text">Không tìm thấy bàn nào</div>
                  <div className="empty-state-subtext">
                    Thử thay đổi bộ lọc hoặc thêm bàn mới
                  </div>
                </div>
              ) : (
                getFilteredTables().map((table) => (
                  <Card
                    key={table.id}
                    className={`table-card ${table.status}`}
                    onDoubleClick={() => {
                      setLiteTable(table);
                      setShowLiteModal(true);
                    }}
                  >
                    <div className="table-header">
                      <div className="table-number">{table.number}</div>
                      <div className={`table-status status-${table.status}`}>
                        {getStatusText(table.status)}
                      </div>
                    </div>
                    <div className="table-info">
                      <div className="table-detail">
                        <span>👥</span>
                        <span>
                          {table.seats > 0 ? table.seats + " chỗ" : "—"}
                        </span>
                      </div>
                      <div className="table-detail">
                        <span>📍</span>
                        <span>{getAreaText(table.area)}</span>
                      </div>
                    </div>
                    {renderTableActions(table)}
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Diagram */}
      <Modal
        isOpen={showTableDiagram}
        onClose={() => setShowTableDiagram(false)}
        title="🗺️ Sơ đồ bàn ăn"
        size="large"
      >
        <div className="diagram-controls">
          <div className="diagram-search">
            <input
              type="text"
              className="diagram-search-input"
              placeholder="🔍 Tìm bàn..."
              value={diagramSearchQuery}
              onChange={(e) => setDiagramSearchQuery(e.target.value)}
            />
          </div>
          <div className="diagram-filters">
            <select
              className="diagram-filter-select"
              value={diagramFloorFilter}
              onChange={(e) => setDiagramFloorFilter(e.target.value)}
            >
              <option value="">Tất cả tầng</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.icon} {f.name}
                </option>
              ))}
            </select>
            <select
              className="diagram-filter-select"
              value={diagramStatusFilter}
              onChange={(e) => setDiagramStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="available">🟢 Trống</option>
              <option value="occupied">🟡 Có khách</option>
              <option value="reserved">🔵 Đã đặt</option>
              <option value="cleaning">🟣 Dọn dẹp</option>
            </select>
          </div>
        </div>

        <div className="diagram-container">
          <svg
            className="diagram-svg"
            width="100%"
            height="500"
            viewBox="0 0 600 400"
          >
            <defs>
              <pattern
                id="grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 L 0 20"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {getDiagramFilteredTables().map((t) => (
              <g key={t.id} className={`diagram-table ${t.status}`}>
                <circle
                  cx={t.x}
                  cy={t.y}
                  r="25"
                  className={`table-circle status-${t.status}`}
                  onDoubleClick={() => {
                    setLiteTable(t);
                    setShowLiteModal(true);
                  }}
                />
                <text
                  x={t.x}
                  y={t.y - 5}
                  textAnchor="middle"
                  className="table-number-text"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {t.number}
                </text>
                <text
                  x={t.x}
                  y={t.y + 8}
                  textAnchor="middle"
                  className="table-seats-text"
                  fontSize="8"
                >
                  {t.seats > 0 ? `${t.seats} chỗ` : "—"}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="diagram-legend">
          <div className="legend-item">
            <div className="legend-circle available"></div>
            <span>Trống</span>
          </div>
          <div className="legend-item">
            <div className="legend-circle occupied"></div>
            <span>Có khách</span>
          </div>
          <div className="legend-item">
            <div className="legend-circle reserved"></div>
            <span>Đã đặt</span>
          </div>
          <div className="legend-item">
            <div className="legend-circle cleaning"></div>
            <span>Dọn dẹp</span>
          </div>
        </div>
      </Modal>

      {/* Floor Modal */}
      <Modal
        isOpen={showFloorModal}
        onClose={() => {
          setShowFloorModal(false);
          setFloorForm({ name: "", icon: "", description: "" });
          setEditingFloor(null);
        }}
        title={editingFloor ? "✏️ Sửa thông tin tầng" : "🏗️ Thêm tầng mới"}
      >
        <div className="form-group">
          <label className="form-label">Tên tầng</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: Tầng 1, Tầng trệt, Sân thượng..."
            value={floorForm.name}
            onChange={(e) =>
              setFloorForm((p) => ({ ...p, name: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label className="form-label">Biểu tượng</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: 1️⃣, 🏢, 🌳..."
            maxLength="2"
            value={floorForm.icon}
            onChange={(e) =>
              setFloorForm((p) => ({ ...p, icon: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label className="form-label">Mô tả</label>
          <input
            type="text"
            className="form-input"
            placeholder="Mô tả ngắn về tầng này..."
            value={floorForm.description}
            onChange={(e) =>
              setFloorForm((p) => ({ ...p, description: e.target.value }))
            }
          />
        </div>
        <div className="modal-footer">
          <Button
            variant="secondary"
            onClick={() => {
              setShowFloorModal(false);
              setFloorForm({ name: "", icon: "", description: "" });
              setEditingFloor(null);
            }}
          >
            Hủy
          </Button>
          <Button variant="primary" onClick={saveFloor}>
            💾 Lưu tầng
          </Button>
        </div>
      </Modal>

      {/* Add Table Modal */}
      <Modal
        isOpen={showAddTableModal}
        onClose={() => {
          setShowAddTableModal(false);
          setTableForm({ number: "", seats: 4, floorId: "", area: "standard" });
        }}
        title="➕ Thêm bàn mới"
      >
        <div className="form-group">
          <label className="form-label">Số bàn</label>
          <input
            type="text"
            className="form-input"
            placeholder="VD: A01, B12..."
            value={tableForm.number}
            onChange={(e) =>
              setTableForm((p) => ({ ...p, number: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label className="form-label">Số chỗ ngồi</label>
          <input
            type="number"
            className="form-input"
            min="1"
            max="20"
            value={tableForm.seats}
            onChange={(e) =>
              setTableForm((p) => ({ ...p, seats: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label className="form-label">Tầng</label>
          <select
            className="form-select"
            value={tableForm.floorId}
            onChange={(e) =>
              setTableForm((p) => ({ ...p, floorId: e.target.value }))
            }
          >
            <option value="">Chọn tầng...</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon} {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Khu vực/Loại</label>
          <select
            className="form-select"
            value={tableForm.area}
            onChange={(e) =>
              setTableForm((p) => ({ ...p, area: e.target.value }))
            }
          >
            <option value="standard">🏢 Trong nhà (standard)</option>
            <option value="vip">👑 VIP</option>
            <option value="outdoor">🌳 Ngoài trời</option>
            <option value="bar">🍸 Quầy bar</option>
            <option value="private">🚪 Phòng riêng</option>
          </select>
        </div>
        <div className="modal-footer">
          <Button
            variant="secondary"
            onClick={() => {
              setShowAddTableModal(false);
              setTableForm({
                number: "",
                seats: 4,
                floorId: "",
                area: "standard",
              });
            }}
          >
            Hủy
          </Button>
          <Button variant="primary" onClick={saveTable}>
            💾 Thêm bàn
          </Button>
        </div>
      </Modal>

      {/* Modal thao tác bàn */}
      {showLiteModal && liteTable && (
        <TableActionsLiteModal
          open={showLiteModal}
          table={liteTable}
          restaurantId={restaurantId}
          floors={floorsRaw} // hoặc floors đã map, miễn có {id, level, name}
          actions={{
            onSaveCustomer,
            updateTable,
            setTableStatus,
            moveTable,
            swapTableCodes,
            mergeTables,
            splitTables,
            deleteTable,
            fetchTableByCode: (code) => fetchTableByCode(code, restaurantId),
            getIdFromLevel,
          }}
          onUpdated={async () => {
            try {
              await refetchTables?.();
            } catch {}
          }}
          onClose={() => {
            setShowLiteModal(false);
            setLiteTable(null);
          }}
        />
      )}

      {/* ⛔️ Đổi từ <style jsx> sang <style> để tránh warning */}
      <style>{`
        .restaurant-selector{display:flex;align-items:center;gap:8px;margin-left:auto;margin-right:12px}
        .selector-label{font-size:.9rem;color:#475569}
        .selector-wrap{position:relative}
        .selector-input{-webkit-appearance:none;appearance:none;padding:8px 32px 8px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:.95rem;color:#0f172a;outline:none;transition:box-shadow .15s ease,border-color .15s ease}
        .selector-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
        .selector-caret{position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:#64748b;font-size:.9rem}
        @media (max-width:720px){
          .restaurant-selector{width:100%;margin:8px 0 0}
          .selector-wrap{flex:1}
          .top-actions{flex-wrap:wrap;gap:8px}
        }
      `}</style>
    </div>
  );
};

export default TableManagement;
