import React, { useState, useMemo, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import useNavigate
import Modal from "../../../components/common/Modal";
import Button from "../../../components/common/Button";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "../../../hooks/useNotification";
import useTableManagement from "@/hooks/useTableManagement";
import useFloorManagement from "@/hooks/useFloorManagement";
import { useRestaurant } from "@/hooks/useRestaurant";
import TableActionsLiteModal from "./TableActionsLiteModal";
import Table3DSimulatorModal from "./Table3DSimulatorModal";
import { loadTableVrImage } from "@/utils/vrStorage";
import useModalDraft from "@/hooks/useModalDraft";
import "./TableManagement.scss";
import { mapModelToTableForm } from "@/config/table3dCatalog";

const ALL_FLOORS_KEY = "all";

const resolveTableDuplicateMessage = (error, fallbackCode = "") => {
  const gqlErrors = error?.graphQLErrors || error?.networkError?.result?.errors || [];
  const duplicateErr = gqlErrors.find(
    (item) => item?.extensions?.code === "TABLE_CODE_DUPLICATE"
  );
  if (duplicateErr?.message) return duplicateErr.message;
  const message = error?.message || "";
  if (message.includes("TABLE_CODE_DUPLICATE")) {
    return `Bàn '${fallbackCode}' đã tồn tại trong tầng này. Vui lòng dùng tên khác.`;
  }
  return "";
};

const TableManagement = () => {
  const navigate = useNavigate(); // 2. Init Hook
  const { showNotification } = useNotification();
  const { restaurants } = useContext(AuthContext);
  const restaurantList = useMemo(() => restaurants || [], [restaurants]);

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
  const {
    restaurant,
    updateRestaurant,
    refetch: refetchRestaurant,
  } = useRestaurant(restaurantId);

  // --- Hooks ---
  const {
    floors: floorsRaw,
    activeLevel,
    setActiveLevel,
    getIdFromLevel,
    getLevelFromId,
    createFloor,
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
    swapTableCodes,
    mergeTables,
    splitTables,
  } = useTableManagement({ restaurantId });

  // --- Data Mapping (Chỉ giữ lại data cần thiết cho quản lý danh sách) ---
  const floors = useMemo(
    () =>
      (floorsRaw || []).map((f) => ({
        id: String(f.id),
        name: f.name || `Tầng ${f.level ?? ""}`,
        icon: "🏢",
        level: Number(f.level),
      })),
    [floorsRaw]
  );

  const tablesMapped = useMemo(
    () =>
      (tablesRaw || []).map((t) => ({
        id: String(t.id),
        number: String(t.code || ""),
        seats: Number(t.capacity ?? 0),
        status: t.status || "available",
        floorId: t.floorId != null ? String(t.floorId) : null,
        area: t.type || "standard",
        vrUrl: t.vrUrl || "",
        deposit: t.deposit ?? 0,
      })),
    [tablesRaw]
  );

  // --- UI States ---
  const [currentFloor, setCurrentFloor] = useState(ALL_FLOORS_KEY);
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
  const [showVrModal, setShowVrModal] = useState(false);
  const [showTable3DModal, setShowTable3DModal] = useState(false);
  const [vrForm, setVrForm] = useState({
    vrTourUrl: "",
  });

  // Forms State
  const [tableForm, setTableForm] = useState({
    number: "",
    seats: 4,
    floorId: "",
    area: "standard",
    visualTemplate: "",
  });
  const [floorForm, setFloorForm] = useState({ name: "" });
  const [vrSaving, setVrSaving] = useState(false);
  const [tableSaving, setTableSaving] = useState(false);
  const [floorSaving, setFloorSaving] = useState(false);
  const [tableErrors, setTableErrors] = useState({});
  const [floorErrors, setFloorErrors] = useState({});

  const addTableDirty =
    !!tableForm.number.trim() ||
    Number(tableForm.seats || 0) !== 4 ||
    !!tableForm.floorId ||
    tableForm.area !== "standard" ||
    !!tableForm.visualTemplate;
  const floorDirty = !!floorForm.name.trim();
  const normalizeVrTourUrl = (value) => {
    const normalized = String(value || "").trim();
    return normalized;
  };
  const vrInitialUrl = normalizeVrTourUrl(restaurant?.vrTourUrl);
  const vrCurrentUrl = normalizeVrTourUrl(vrForm.vrTourUrl);
  const vrDirty = vrCurrentUrl !== vrInitialUrl;

  const addTableDraft = useModalDraft({
    enabled: showAddTableModal,
    draftIdentity: {
      module: "table",
      modal: "add-table-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "table",
      recordId: null,
      context: String(restaurantId || "default"),
      schemaVersion: "1",
    },
    formValue: tableForm,
    isDirty: addTableDirty,
    sanitize: (v) => ({
      number: v?.number || "",
      seats: v?.seats ?? 4,
      floorId: v?.floorId || "",
      area: v?.area || "standard",
      visualTemplate: v?.visualTemplate || "",
    }),
    onRestore: (draft) => setTableForm((prev) => ({ ...prev, ...draft })),
    notify: showNotification,
  });

  const addFloorDraft = useModalDraft({
    enabled: showFloorModal,
    draftIdentity: {
      module: "table",
      modal: "add-floor-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "floor",
      recordId: null,
      context: String(restaurantId || "default"),
      schemaVersion: "1",
    },
    formValue: floorForm,
    isDirty: floorDirty,
    sanitize: (v) => ({ name: v?.name || "" }),
    onRestore: (draft) => setFloorForm((prev) => ({ ...prev, ...draft })),
    notify: showNotification,
  });

  const vrDraft = useModalDraft({
    enabled: showVrModal,
    draftIdentity: {
      module: "table",
      modal: "restaurant-vr-modal",
      route: typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "edit",
      entityType: "restaurant-vr",
      recordId: restaurantId || null,
      context: "table-management",
      schemaVersion: "1",
    },
    formValue: vrForm,
    isDirty: vrDirty,
    sanitize: (v) => ({ vrTourUrl: v?.vrTourUrl || "" }),
    onRestore: (draft) => setVrForm((prev) => ({ ...prev, ...draft })),
    notify: showNotification,
  });

  const isAllFloorsSelected = currentFloor === ALL_FLOORS_KEY;

  useEffect(() => {
    if (vrDraft.didRestore) return;
    setVrForm({ vrTourUrl: restaurant?.vrTourUrl || "" });
  }, [restaurant, vrDraft.didRestore]);

  useEffect(() => {
    if (!showAddTableModal) {
      setTableSaving(false);
      setTableErrors({});
    }
  }, [showAddTableModal]);

  useEffect(() => {
    if (!showFloorModal) {
      setFloorSaving(false);
      setFloorErrors({});
    }
  }, [showFloorModal]);

  const selectAllFloors = () => {
    setCurrentFloor(ALL_FLOORS_KEY);
    setActiveLevel(null);
  };

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

  const formatCurrency = (amount) =>
    `${Number(amount || 0).toLocaleString("vi-VN")}đ`;

  const findAvailablePosition = (floorId) => {
    const existing = (tablesRaw || [])
      .filter((t) => String(t.floorId) === String(floorId))
      .map((t) => ({
        x: t.position?.x ?? 0,
        y: t.position?.y ?? 0,
        w: 60,
        h: 60,
      }));
    const isOverlapping = (x, y) =>
      existing.some(
        (t) =>
          x < t.x + t.w + 10 &&
          x + 60 + 10 > t.x &&
          y < t.y + t.h + 10 &&
          y + 60 + 10 > t.y
      );
    const startX = 50;
    const startY = 50;
    if (!isOverlapping(startX, startY)) return { x: startX, y: startY };
    const step = 80;
    for (let r = 1; r <= 10; r += 1) {
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

  const normalizeSearch = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const getFilteredTables = () => {
    let filtered = [...tablesMapped];
    const shouldFilterByFloor =
      currentFloor != null &&
      currentFloor !== "" &&
      currentFloor !== ALL_FLOORS_KEY;
    if (shouldFilterByFloor)
      filtered = filtered.filter(
        (t) => String(t.floorId) === String(currentFloor)
      );

    const normalizedQuery = normalizeSearch(searchQuery);
    if (normalizedQuery) {
      const compactQuery = normalizedQuery.replace(/\s+/g, "");
      filtered = filtered.filter((t) => {
        const normalizedNumber = normalizeSearch(t.number);
        const compactNumber = normalizedNumber.replace(/\s+/g, "");
        return (
          normalizedNumber.includes(normalizedQuery) ||
          compactNumber.includes(compactQuery)
        );
      });
    }

    if (currentFilters.status)
      filtered = filtered.filter((t) => t.status === currentFilters.status);
    return filtered.sort((a, b) =>
      String(a.number || "").localeCompare(String(b.number || ""), "vi", {
        numeric: true,
        sensitivity: "base",
      })
    );
  };

  // --- Handlers ---
  const POS_MANAGED_STATUS_TRANSITIONS = new Set([
    "available->occupied",
    "reserved->occupied",
    "occupied->payment_pending",
    "payment_pending->cleaning",
    "occupied->available",
    "payment_pending->available",
  ]);

  const isPosManagedStatusTransition = (currentStatus, nextStatus) =>
    POS_MANAGED_STATUS_TRANSITIONS.has(`${currentStatus}->${nextStatus}`);

  const handleTableStatusChange = async (table, nextStatus) => {
    if (isPosManagedStatusTransition(table?.status, nextStatus)) {
      showNotification(
        "Vui lòng thao tác nhận khách, thanh toán hoặc dọn bàn tại POS để đồng bộ order và phiên bàn.",
        "warning"
      );
      return;
    }
    return changeTableStatus(table.id, nextStatus);
  };

  const changeTableStatus = async (tableId, newStatus) => {
    try {
      await setTableStatus({ id: String(tableId), status: newStatus });
      await refetchTables();
    } catch {
      showNotification("Lỗi đổi trạng thái!", "error");
    }
  };

  const handleOpenFloorDesigner = () => {
    if (isAllFloorsSelected || !currentFloor) {
      showNotification("Vui lòng chọn một tầng cụ thể để thiết kế sơ đồ.", "warning");
      return;
    }
    const targetFloorId = currentFloor;
    if (!targetFloorId) {
      showNotification("Chưa chọn tầng để chỉnh sửa sơ đồ.", "warning");
      return;
    }
    const activeCount = (tablesRaw || []).filter(
      (t) =>
        String(t.floorId) === String(targetFloorId) &&
        t.status &&
        t.status !== "available"
    ).length;
    const floorWatching = (floorsRaw || []).find(
      (f) => String(f.id) === String(targetFloorId)
    )?.isWatching;
    if (activeCount > 0 || floorWatching) {
      const floorName =
        floors.find((f) => String(f.id) === String(targetFloorId))?.name ||
        "";
      const message = floorWatching
        ? `Tầng ${floorName} đang có khách xem sơ đồ, không thể chỉnh sửa.`
        : `Có ${activeCount} bàn đang hoạt động ở tầng ${floorName}. Không thể chỉnh sửa sơ đồ.`;
      showNotification(message, "warning");
      return;
    }
    navigate(`/manager/floor-map/${restaurantId}`);
  };

  const handleSaveTable = async () => {
    if (tableSaving) return;
    const { number, seats, floorId, area } = tableForm;
    const nextErrors = {};
    if (!number?.trim()) nextErrors.number = "Vui lòng nhập số bàn.";
    if (!floorId) nextErrors.floorId = "Vui lòng chọn tầng cho bàn.";
    if (!seats || Number(seats) < 1) {
      nextErrors.seats = "Số ghế phải lớn hơn hoặc bằng 1.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setTableErrors(nextErrors);
      showNotification("Vui lòng kiểm tra lại các trường bắt buộc.", "error");
      return;
    }
    setTableErrors({});
    setTableSaving(true);
    try {
      const position = findAvailablePosition(floorId);
      const existingCount = (tablesRaw || []).filter(
        (t) => String(t.floorId) === String(floorId)
      ).length;
      const floorName = floors.find((f) => f.id === String(floorId))?.name;
      await createTable({
        restaurantId,
        code: number,
        capacity: Number(seats),
        floorId,
        type: area,
        status: "available",
        position: { x: position.x, y: position.y },
      });
      await refetchTables();
      addTableDraft.clearDraft();
      setShowAddTableModal(false);
      showNotification("Thêm bàn thành công!", "success");
      if (existingCount > 0) {
        showNotification(
          `Có bàn ở tầng ${floorName || ""} cần điều chỉnh vị trí.`,
          "info"
        );
      }
    } catch (error) {
      const duplicateMessage = resolveTableDuplicateMessage(error, number?.trim());
      if (duplicateMessage) {
        setTableErrors((prev) => ({
          ...prev,
          number: duplicateMessage,
        }));
        showNotification(duplicateMessage, "error");
        return;
      }
      showNotification("Lỗi thêm bàn!", "error");
    } finally {
      setTableSaving(false);
    }
  };


  const handleApply3DTemplate = (selectedModel) => {
    const mapped = mapModelToTableForm(selectedModel);
    // Chỉ prefill form để user xác nhận lại theo luồng thêm bàn hiện tại.
    setTableForm((prev) => ({
      ...prev,
      seats: mapped.seats,
      area: mapped.area,
      floorId: prev.floorId || currentFloor || floors[0]?.id || "",
      visualTemplate: mapped.visualTemplate,
    }));
    setShowTable3DModal(false);
    setShowAddTableModal(true);
  };

  const handleSaveRestaurantVr = async () => {
    if (!restaurantId) return;
    if (!vrDirty) {
      showNotification("Không có thay đổi để lưu.", "info");
      return;
    }
    setVrSaving(true);
    try {
      await updateRestaurant(restaurantId, {
        vrTourUrl: vrCurrentUrl || null,
      });
      await refetchRestaurant?.();
      vrDraft.clearDraft();
      showNotification("Đã cập nhật VR toàn quán.", "success");
      setShowVrModal(false);
    } catch (e) {
      console.error(e);
      showNotification("Không thể cập nhật VR toàn quán.", "error");
    } finally {
      setVrSaving(false);
    }
  };

  const handleSaveFloor = async () => {
    if (floorSaving) return;
    const normalizedName = floorForm.name.trim();
    if (!normalizedName) {
      setFloorErrors({ name: "Vui lòng nhập tên tầng." });
      showNotification("Vui lòng nhập tên tầng trước khi lưu.", "error");
      return;
    }
    setFloorSaving(true);
    setFloorErrors({});
    try {
      const createdFloor = await createFloor({ name: normalizedName });
      if (createdFloor?.id) {
        setCurrentFloor(String(createdFloor.id));
      }
      if (createdFloor?.level != null) {
        setActiveLevel(Number(createdFloor.level));
      }
      showNotification(`Đã thêm tầng '${normalizedName}' thành công.`, "success");
      addFloorDraft.clearDraft();
      setFloorForm({ name: "" });
      setShowFloorModal(false);
    } catch (error) {
      const errMsg = error?.message || "Không thể thêm tầng. Vui lòng thử lại.";
      setFloorErrors((prev) => ({
        ...prev,
        name: prev?.name || errMsg,
      }));
      showNotification(errMsg, "error");
    } finally {
      setFloorSaving(false);
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
            onClick={handleOpenFloorDesigner}
          >
            🗺️ Thiết kế Sơ đồ
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowVrModal(true)}
          >
            🕶️ VR toàn quán
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowTable3DModal(true)}
            disabled={!restaurantId}
          >
            🪑 Mô phỏng 3D
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
            <div
              className={`tm-floor-item ${isAllFloorsSelected ? "active" : ""}`}
              onClick={selectAllFloors}
            >
              <span className="icon">🏬</span>
              <span className="name">Tất cả tầng</span>
              <span className="count">{tablesMapped.length}</span>
            </div>
            {floors.map((f) => (
              <div
                key={f.id}
                className={`tm-floor-item ${
                  !isAllFloorsSelected && String(currentFloor) === String(f.id)
                    ? "active"
                    : ""
                }`}
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
              placeholder="🔍 Tìm mã/số bàn..."
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
                const hasVr = !!t.vrUrl || !!loadTableVrImage(t.id);
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
                      <div className="card-top-right">
                        {hasVr && <span className="vr-badge">360°</span>}
                        <span className={`status-badge ${statusCfg.color}`}>
                          {statusCfg.text}
                        </span>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="info-row">
                        <span>👥</span> {t.seats} chỗ
                      </div>
                      <div className="info-row">
                        <span>🏷️</span> {getAreaText(t.area)}
                      </div>
                      <div className="info-row">
                        <span>💰</span> {formatCurrency(t.deposit)}
                      </div>
                    </div>
                    <div className="card-actions">
                      {t.status === "available" && (
                        <button
                          className="btn-mini success"
                          onClick={() => handleTableStatusChange(t, "occupied")}
                        >
                          Nhận khách
                        </button>
                      )}
                      {t.status === "occupied" && (
                        <button
                          className="btn-mini warning"
                          onClick={() =>
                            handleTableStatusChange(t, "payment_pending")
                          }
                        >
                          T.Toán
                        </button>
                      )}
                      {t.status === "payment_pending" && (
                        <button
                          className="btn-mini primary"
                          onClick={() => handleTableStatusChange(t, "cleaning")}
                        >
                          Dọn
                        </button>
                      )}
                      {t.status === "cleaning" && (
                        <button
                          className="btn-mini secondary"
                          onClick={() => handleTableStatusChange(t, "available")}
                        >
                          Xong
                        </button>
                      )}
                      {t.status === "reserved" && (
                        <button
                          className="btn-mini success"
                          onClick={() => handleTableStatusChange(t, "occupied")}
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
          tables={tablesRaw}
          actions={{
            updateTable,
            setTableStatus,
            moveTable,
            deleteTable,
            fetchTableByCode,
            getIdFromLevel,
            swapTableCodes,
            mergeTables,
            splitTables,
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
        onClose={() => addTableDraft.requestCloseWithDraft(() => setShowAddTableModal(false))}
        onBeforeClose={() => !tableSaving}
        closeOnEscape={!tableSaving}
        autoWrapBody={false}
      >
        <Modal.Header>Thêm bàn mới</Modal.Header>
        <Modal.Body className="tm-form tm-form--add-table">
          <div className="tm-form-header tm-form-header--add-table">
            <h4>Thiết lập thông tin bàn</h4>
            <p>Điền thông tin cơ bản để tạo bàn mới trong khu vực quản lý.</p>
          </div>
          <div className="tm-form-section">
            <div className="tm-form-section-title">Thông tin cơ bản</div>
            <div className="tm-form-grid">
              <div className={`tm-field ${tableErrors.number ? "is-invalid" : ""}`}>
                <label>Số bàn *</label>
                <input
                  value={tableForm.number}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTableForm({ ...tableForm, number: value });
                    if (tableErrors.number && value.trim()) {
                      setTableErrors((prev) => ({ ...prev, number: undefined }));
                    }
                  }}
                  placeholder="VD: A1, B2..."
                  aria-invalid={!!tableErrors.number}
                />
                <div className="tm-field-meta">
                  <span className="tm-field-hint">Dùng mã ngắn, dễ nhận biết theo khu vực.</span>
                  {tableErrors.number && (
                    <span className="tm-field-error">{tableErrors.number}</span>
                  )}
                </div>
              </div>
              <div className={`tm-field ${tableErrors.seats ? "is-invalid" : ""}`}>
                <label>Số ghế *</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={tableForm.seats}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTableForm({ ...tableForm, seats: value });
                    if (tableErrors.seats && Number(value) >= 1) {
                      setTableErrors((prev) => ({ ...prev, seats: undefined }));
                    }
                  }}
                  aria-invalid={!!tableErrors.seats}
                />
                <div className="tm-field-meta">
                  <span className="tm-field-hint">Nên khớp với sức chứa thực tế của bàn.</span>
                  {tableErrors.seats && (
                    <span className="tm-field-error">{tableErrors.seats}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="tm-form-section">
            <div className="tm-form-section-title">Vị trí phục vụ</div>
            <div className="tm-form-grid">
              <div className={`tm-field ${tableErrors.floorId ? "is-invalid" : ""}`}>
                <label>Tầng *</label>
                <select
                  value={tableForm.floorId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setTableForm({ ...tableForm, floorId: value });
                    if (tableErrors.floorId && value) {
                      setTableErrors((prev) => ({ ...prev, floorId: undefined }));
                    }
                  }}
                  aria-invalid={!!tableErrors.floorId}
                >
                  <option value="">Chọn tầng...</option>
                  {floors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <div className="tm-field-meta">
                  <span className="tm-field-hint">Tầng giúp phân bổ bàn và sơ đồ chính xác.</span>
                  {tableErrors.floorId && (
                    <span className="tm-field-error">{tableErrors.floorId}</span>
                  )}
                </div>
              </div>
              <div className="tm-field">
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
                <div className="tm-field-meta">
                  <span className="tm-field-hint">Giúp lọc nhanh khi điều phối khách theo nhu cầu.</span>
                </div>
              </div>
            </div>
          </div>
          {tableForm.visualTemplate && (
            <div className="tm-template-preview">
              <div className="tm-template-preview__title">Mẫu 3D đã áp dụng</div>
              <div className="tm-template-preview__value">{tableForm.visualTemplate}</div>
              <div className="tm-template-preview__hint">
                Số ghế, khu vực hoặc tầng có thể đã được gợi ý sẵn từ mẫu này.
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="tm-add-table-footer">
          <Button
            variant="secondary"
            onClick={() =>
              addTableDraft.requestCloseWithDraft(() =>
                setShowAddTableModal(false)
              )
            }
            disabled={tableSaving}
          >
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSaveTable} loading={tableSaving}>
            {tableSaving ? "Đang lưu..." : "Lưu bàn"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 3. Add Floor Modal (Stub) */}
      <Modal
        isOpen={showFloorModal}
        onClose={() =>
          addFloorDraft.requestCloseWithDraft(() => setShowFloorModal(false))
        }
        onBeforeClose={() => !floorSaving}
        closeOnEscape={!floorSaving}
      >
        <Modal.Header>Thêm tầng mới</Modal.Header>
        <Modal.Body className="tm-form tm-form--add-floor">
          <div className="tm-form-header">
            <h4>Cấu hình khu vực phục vụ theo tầng</h4>
            <p>
              Đặt tên tầng rõ ràng để phân bổ bàn và quản lý sơ đồ thuận tiện
              hơn.
            </p>
          </div>
          <div className="tm-form-section">
            <div className="tm-form-section-title">Thông tin tầng</div>
            <div className={`tm-field ${floorErrors.name ? "is-invalid" : ""}`}>
              <label>Tên tầng *</label>
              <input
                value={floorForm.name}
                onChange={(e) => {
                  const value = e.target.value;
                  setFloorForm({ ...floorForm, name: value });
                  if (floorErrors.name && value.trim()) {
                    setFloorErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                placeholder="VD: Tầng 1, Tầng 2, Sân thượng..."
                aria-invalid={!!floorErrors.name}
              />
              <div className="tm-field-meta">
                <span className="tm-field-hint">
                  Tên nên ngắn gọn, dễ nhận diện khi điều phối bàn.
                </span>
                {floorErrors.name && (
                  <span className="tm-field-error">{floorErrors.name}</span>
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="tm-add-floor-footer">
          <Button
            variant="secondary"
            onClick={() =>
              addFloorDraft.requestCloseWithDraft(() => setShowFloorModal(false))
            }
            disabled={floorSaving}
          >
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSaveFloor} loading={floorSaving}>
            {floorSaving ? "Đang lưu..." : "Lưu tầng"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Table3DSimulatorModal
        open={showTable3DModal}
        onClose={() => setShowTable3DModal(false)}
        onApply={handleApply3DTemplate}
        currentFloorName={floors.find((f) => String(f.id) === String(currentFloor))?.name}
        restaurantName={restaurant?.name}
      />

      {/* 4. Restaurant VR Modal */}
      <Modal
        isOpen={showVrModal}
        onClose={() => vrDraft.requestCloseWithDraft(() => setShowVrModal(false))}
        title="Cấu hình VR toàn quán"
      >
        <div className="tm-form tm-form--vr">
          <div className="tm-form-header">
            <h4>Trải nghiệm VR toàn quán</h4>
            <p>Giúp khách xem tổng quan không gian trước khi chọn bàn.</p>
          </div>
          <div className="tm-vr-panel">
            <div className="tm-vr-card">
              <div className="tm-vr-icon">🕶️</div>
              <div className="tm-vr-content">
                <label>Link VR tổng quan (360/Google VR)</label>
                <input
                  value={vrForm.vrTourUrl}
                  onChange={(e) =>
                    setVrForm({ ...vrForm, vrTourUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
                <div className="hint">
                  Link này dùng để mở trải nghiệm VR toàn quán. Ảnh VR theo từng
                  bàn vẫn lưu ở field vrUrl của từng bàn.
                </div>
                <div className="tm-vr-actions">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (vrCurrentUrl) {
                        window.open(
                          vrCurrentUrl,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }
                    }}
                  >
                    Mở thử VR
                  </Button>
                  <span className="tm-vr-status">
                    {vrForm.vrTourUrl
                      ? "Đã gắn link VR tổng quan"
                      : "Chưa có link VR"}
                  </span>
                </div>
              </div>
            </div>
            <div className="tm-vr-tips">
              <div className="tm-vr-tip">
                <span className="tip-icon">✨</span>
                <div>
                  <strong>Gợi ý trải nghiệm</strong>
                  <p>
                    Dùng link 360/Google VR có chế độ xoay để khách dễ khám phá
                    không gian.
                  </p>
                </div>
              </div>
              <div className="tm-vr-tip">
                <span className="tip-icon">📌</span>
                <div>
                  <strong>Phân bổ theo bàn</strong>
                  <p>
                    Mỗi bàn vẫn có thể gắn VR riêng ở mục “Hành động bàn” để mô
                    tả chi tiết vị trí.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <Button
              variant="primary"
              onClick={handleSaveRestaurantVr}
              disabled={vrSaving || !vrDirty}
            >
              {vrSaving ? "Đang lưu..." : "Lưu VR"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TableManagement;
