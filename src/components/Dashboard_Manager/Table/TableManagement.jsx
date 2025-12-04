import React, { useState, useMemo, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import useNavigate
import Modal from "../../../components/common/Modal";
import Button from "../../../components/common/Button";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "../../../hooks/useNotification";
import useTableManagement from "@/hooks/useTableManagement";
import useFloorManagement from "@/hooks/useFloorManagement";
import TableActionsLiteModal from "./TableActionsLiteModal";
import "./TableManagement.scss";

const TableManagement = () => {
  const navigate = useNavigate(); // 2. Init Hook
  const { showNotification } = useNotification();
  const { restaurants } = useContext(AuthContext);
  const restaurantList = restaurants || [];

  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  // --- Init Restaurant ---
  useEffect(() => {
    if (!selectedRestaurantId && restaurantList?.length > 0) {
      setSelectedRestaurantId(
        String(restaurantList[0].id ?? restaurantList[0].restaurantId)
      );
    }
  }, [restaurantList, selectedRestaurantId]);

  const restaurantId = selectedRestaurantId || null;

  // --- Hooks ---
  const {
    floors: floorsRaw,
    activeLevel,
    setActiveLevel,
    getIdFromLevel,
    getLevelFromId,
  } = useFloorManagement({ restaurantId });

  const {
    tables: tablesRaw,
    setTableStatus,
    createTable,
    updateTable,
    refetchTables,
    moveTable,
    deleteTable,
    fetchTableByCode,
  } = useTableManagement({ restaurantId });

  // --- Data Mapping (Chỉ giữ lại data cần thiết cho quản lý danh sách) ---
  const floors = useMemo(
    () =>
      (floorsRaw || []).map((f) => ({
        id: String(f.id),
        name: f.name || `Tầng ${f.level ?? ""}`,
        icon: "🏢",
        level: Number(f.level),
        active:
          activeLevel != null ? Number(f.level) === Number(activeLevel) : false,
      })),
    [floorsRaw, activeLevel]
  );

  const tablesMapped = useMemo(
    () =>
      (tablesRaw || []).map((t) => ({
        id: String(t.id),
        number: t.code || "",
        seats: Number(t.capacity ?? 0),
        status: t.status || "available",
        floorId: t.floorId != null ? String(t.floorId) : null,
        area: t.type || "standard",
      })),
    [tablesRaw]
  );

  // --- UI States ---
  const [currentFloor, setCurrentFloor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFilters, setCurrentFilters] = useState({
    status: "",
    area: "",
  });

  // Modals State
  const [showLiteModal, setShowLiteModal] = useState(false);
  const [liteTable, setLiteTable] = useState(null);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);

  // Forms State
  const [tableForm, setTableForm] = useState({
    number: "",
    seats: 4,
    floorId: "",
    area: "standard",
  });
  const [floorForm, setFloorForm] = useState({ name: "" });

  // --- Auto Select Floor ---
  useEffect(() => {
    if (!floors.length) return;
    if (!currentFloor) {
      const targetId =
        activeLevel != null ? getIdFromLevel(activeLevel) : floors[0].id;
      if (targetId) setCurrentFloor(String(targetId));
    }
  }, [floors, activeLevel, currentFloor, getIdFromLevel]);

  const selectFloor = (floorId) => {
    setCurrentFloor(String(floorId));
    const lvl = getLevelFromId(floorId);
    if (lvl != null) setActiveLevel(Number(lvl));
  };

  // --- Helpers ---
  const getStatusConfig = (status) =>
    ({
      available: { text: "Trống", color: "success" },
      occupied: { text: "Có khách", color: "danger" },
      reserved: { text: "Đã đặt", color: "primary" },
      cleaning: { text: "Dọn dẹp", color: "secondary" },
      payment_pending: { text: "T.Toán", color: "warning" },
    }[status] || { text: status, color: "secondary" });

  const getAreaText = (area) =>
    ({
      standard: "Trong nhà",
      vip: "VIP",
      outdoor: "Ngoài trời",
      bar: "Bar",
      private: "Riêng",
    }[area] || area);

  const getFilteredTables = () => {
    let filtered = [...tablesMapped];
    if (currentFloor)
      filtered = filtered.filter(
        (t) => String(t.floorId) === String(currentFloor)
      );
    if (searchQuery)
      filtered = filtered.filter((t) =>
        t.number.toLowerCase().includes(searchQuery.toLowerCase())
      );
    if (currentFilters.status)
      filtered = filtered.filter((t) => t.status === currentFilters.status);
    return filtered.sort((a, b) => a.number.localeCompare(b.number));
  };

  // --- Handlers ---
  const changeTableStatus = async (tableId, newStatus) => {
    try {
      await setTableStatus({ id: String(tableId), status: newStatus });
      showNotification("Cập nhật trạng thái thành công", "success");
      await refetchTables();
    } catch (e) {
      showNotification("Lỗi đổi trạng thái!", "error");
    }
  };

  const handleSaveTable = async () => {
    const { number, seats, floorId, area } = tableForm;
    if (!number || !seats || !floorId)
      return showNotification("Vui lòng điền đủ thông tin!", "error");
    try {
      await createTable({
        restaurantId,
        code: number,
        capacity: Number(seats),
        floorId,
        type: area,
        status: "available",
        position: { x: 50, y: 50 },
      });
      await refetchTables();
      setShowAddTableModal(false);
      showNotification("Thêm bàn thành công!", "success");
    } catch {
      showNotification("Lỗi thêm bàn!", "error");
    }
  };

  return (
    <div className="tm-container">
      {/* --- Header --- */}
      <header className="tm-header">
        <div className="tm-title">
          <h1>🍽️ Quản Lý Bàn</h1>
          <div className="tm-res-select">
            <select
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
            >
              {restaurantList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="tm-actions">
          {/* 3. Cập nhật hành động chuyển trang */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              navigate(`/manager/dashboard/floor-map/${restaurantId}`)
            }
          >
            🗺️ Thiết kế Sơ đồ
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddTableModal(true)}
          >
            ➕ Thêm bàn
          </Button>
        </div>
      </header>

      {/* --- Main Layout --- */}
      <div className="tm-layout">
        {/* Sidebar: Floors */}
        <aside className="tm-sidebar">
          <h3>Khu vực / Tầng</h3>
          <div className="tm-floor-list">
            {floors.map((f) => (
              <div
                key={f.id}
                className={`tm-floor-item ${f.active ? "active" : ""}`}
                onClick={() => selectFloor(f.id)}
              >
                <span className="icon">{f.icon}</span>
                <span className="name">{f.name}</span>
                <span className="count">
                  {tablesMapped.filter((t) => t.floorId === f.id).length}
                </span>
              </div>
            ))}
            <button
              className="tm-add-floor-btn"
              onClick={() => setShowFloorModal(true)}
            >
              + Thêm tầng
            </button>
          </div>

          <div className="tm-filter-box">
            <input
              type="text"
              placeholder="🔍 Tìm số bàn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              value={currentFilters.status}
              onChange={(e) =>
                setCurrentFilters({ ...currentFilters, status: e.target.value })
              }
            >
              <option value="">Tất cả trạng thái</option>
              <option value="available">🟢 Trống</option>
              <option value="occupied">🔴 Có khách</option>
              <option value="payment_pending">🟡 Chờ thanh toán</option>
              <option value="reserved">🔵 Đã đặt</option>
            </select>
          </div>
        </aside>

        {/* Main: Grid Tables */}
        <main className="tm-grid-area">
          {getFilteredTables().length === 0 ? (
            <div className="tm-empty">
              <span>🪑</span> <p>Không có bàn nào hiển thị.</p>
            </div>
          ) : (
            <div className="tm-table-grid">
              {getFilteredTables().map((t) => {
                const statusCfg = getStatusConfig(t.status);
                return (
                  <div
                    key={t.id}
                    className={`tm-table-card ${t.status}`}
                    onDoubleClick={() => {
                      setLiteTable(t);
                      setShowLiteModal(true);
                    }}
                  >
                    <div className="card-top">
                      <span className="table-no">{t.number}</span>
                      <span className={`status-badge ${statusCfg.color}`}>
                        {statusCfg.text}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="info-row">
                        <span>👥</span> {t.seats} chỗ
                      </div>
                      <div className="info-row">
                        <span>📍</span> {getAreaText(t.area)}
                      </div>
                    </div>
                    <div className="card-actions">
                      {t.status === "available" && (
                        <button
                          className="btn-mini success"
                          onClick={() => changeTableStatus(t.id, "occupied")}
                        >
                          Nhận khách
                        </button>
                      )}
                      {t.status === "occupied" && (
                        <button
                          className="btn-mini warning"
                          onClick={() =>
                            changeTableStatus(t.id, "payment_pending")
                          }
                        >
                          T.Toán
                        </button>
                      )}
                      {t.status === "payment_pending" && (
                        <button
                          className="btn-mini primary"
                          onClick={() => changeTableStatus(t.id, "cleaning")}
                        >
                          Dọn
                        </button>
                      )}
                      {t.status === "cleaning" && (
                        <button
                          className="btn-mini secondary"
                          onClick={() => changeTableStatus(t.id, "available")}
                        >
                          Xong
                        </button>
                      )}
                      {t.status === "reserved" && (
                        <button
                          className="btn-mini success"
                          onClick={() => changeTableStatus(t.id, "occupied")}
                        >
                          Nhận khách
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* --- MODALS SECTION --- */}

      {/* 1. Quick Actions Modal */}
      {showLiteModal && liteTable && (
        <TableActionsLiteModal
          open={showLiteModal}
          table={liteTable}
          restaurantId={restaurantId}
          floors={floorsRaw}
          actions={{
            updateTable,
            setTableStatus,
            moveTable,
            deleteTable,
            fetchTableByCode,
          }}
          onUpdated={refetchTables}
          onClose={() => {
            setShowLiteModal(false);
            setLiteTable(null);
          }}
        />
      )}

      {/* 2. Add Table Modal */}
      <Modal
        isOpen={showAddTableModal}
        onClose={() => setShowAddTableModal(false)}
        title="Thêm bàn mới"
      >
        <div className="tm-form">
          <label>Số bàn</label>
          <input
            value={tableForm.number}
            onChange={(e) =>
              setTableForm({ ...tableForm, number: e.target.value })
            }
            placeholder="VD: A1, B2..."
          />
          <label>Số ghế</label>
          <input
            type="number"
            value={tableForm.seats}
            onChange={(e) =>
              setTableForm({ ...tableForm, seats: e.target.value })
            }
          />
          <label>Tầng</label>
          <select
            value={tableForm.floorId}
            onChange={(e) =>
              setTableForm({ ...tableForm, floorId: e.target.value })
            }
          >
            <option value="">Chọn tầng...</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <label>Khu vực</label>
          <select
            value={tableForm.area}
            onChange={(e) =>
              setTableForm({ ...tableForm, area: e.target.value })
            }
          >
            <option value="standard">Trong nhà</option>
            <option value="outdoor">Ngoài trời</option>
            <option value="vip">VIP</option>
          </select>
          <div className="modal-footer">
            <Button variant="primary" onClick={handleSaveTable}>
              Lưu
            </Button>
          </div>
        </div>
      </Modal>

      {/* 3. Add Floor Modal (Stub) */}
      <Modal
        isOpen={showFloorModal}
        onClose={() => setShowFloorModal(false)}
        title="Thêm tầng"
      >
        <div className="tm-form">
          <label>Tên tầng</label>
          <input
            value={floorForm.name}
            onChange={(e) =>
              setFloorForm({ ...floorForm, name: e.target.value })
            }
          />
          <div className="modal-footer">
            <Button
              onClick={() => {
                showNotification("Đã thêm tầng demo", "success");
                setShowFloorModal(false);
              }}
            >
              Lưu
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TableManagement;
