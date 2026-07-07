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
import { mapTableMutationError } from "@/utils/tableMutationError";
import { getTableGuardState } from "@/utils/tableGuardState";
import {
  isPosManagedStatusTransition,
  POS_MANAGED_STATUS_TRANSITION_MESSAGE,
  POS_MANAGED_STATUS_TRANSITION_TITLE,
} from "@/utils/tableStatusTransitionGuard";
import {
  filterTableRows,
  filterTablesByFloor,
  getRawTableById,
  sortTableRowsByNumber,
} from "@/utils/tableManagementDisplay";
import {
  TABLE_STATUS_OPTIONS,
  TABLE_AREA_OPTIONS,
  getTableStatusConfig,
  getTableAreaLabel,
} from "@/utils/tableManagementOptions";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import { getVisualConfigSummary } from "./tableVisualConfigHelpers";

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
    floorsLoading,
    floorsError,
    setActiveLevel,
    getIdFromLevel,
    getLevelFromId,
    createFloor,
  } = useFloorManagement({ restaurantId });

  const {
    tables: tablesRaw,
    tablesLoading,
    tablesError,
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
        visualConfig: t.visualConfig || null,
        position: t.position || null,
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
  const [simulatorTargetFloor, setSimulatorTargetFloor] = useState(null);
  const latestLiteTable = useMemo(
    () =>
      liteTable?.id
        ? getRawTableById(tablesRaw, liteTable.id) || liteTable
        : liteTable,
    [liteTable, tablesRaw]
  );
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
    visualConfig: null,
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
    !!tableForm.visualTemplate ||
    !!tableForm.visualConfig;
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
      visualConfig: v?.visualConfig ?? null,
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
    if (currentFloor === ALL_FLOORS_KEY) return;
    const hasSelectedFloor = floors.some(
      (floor) => String(floor.id) === String(currentFloor)
    );
    if (!hasSelectedFloor) {
      setCurrentFloor(ALL_FLOORS_KEY);
      setActiveLevel(null);
    }
  }, [currentFloor, floors, setActiveLevel]);

  useEffect(() => {
    if (vrDraft.didRestore) return;
    const nextUrl = restaurant?.vrTourUrl || "";
    setVrForm((prev) =>
      prev.vrTourUrl === nextUrl ? prev : { ...prev, vrTourUrl: nextUrl }
    );
  }, [restaurant?.vrTourUrl, vrDraft.didRestore]);

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
  const getStatusConfig = getTableStatusConfig;
  const getAreaText = getTableAreaLabel;

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

  const getQuickActionBlockReason = (currentStatus, nextStatus) =>
    isPosManagedStatusTransition(currentStatus, nextStatus)
      ? POS_MANAGED_STATUS_TRANSITION_TITLE
      : "";

  const renderQuickAction = (targetTable, nextStatus, label, className) => {
    const reason = getQuickActionBlockReason(targetTable?.status, nextStatus);
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          handleTableStatusChange(targetTable, nextStatus);
        }}
        disabled={!!reason}
        title={reason}
      >
        {label}
      </button>
    );
  };
  const hasActiveFilters = Boolean(
    searchQuery.trim() || currentFilters.status || currentFilters.area
  );

  const baseFilteredTables = useMemo(
    () =>
      filterTableRows(tablesMapped, {
        searchQuery,
        status: currentFilters.status,
        area: currentFilters.area,
      }),
    [tablesMapped, searchQuery, currentFilters.status, currentFilters.area]
  );

  const filteredTables = useMemo(() => {
    const shouldFilterByFloor =
      currentFloor != null &&
      currentFloor !== "" &&
      currentFloor !== ALL_FLOORS_KEY;
    const scopedTables = shouldFilterByFloor
      ? filterTablesByFloor(baseFilteredTables, currentFloor)
      : baseFilteredTables;
    return sortTableRowsByNumber(scopedTables);
  }, [baseFilteredTables, currentFloor]);

  const allFloorsCount = baseFilteredTables.length;
  const getFloorTableCount = (floorId) =>
    filterTablesByFloor(baseFilteredTables, floorId).length;
  const getFloorName = (floorId) =>
    floors.find((floor) => String(floor.id) === String(floorId))?.name ||
    "Chưa gán tầng";
  const selectedFloorName = isAllFloorsSelected
    ? "Tất cả tầng"
    : getFloorName(currentFloor);
  const isLoadingTables = !!tablesLoading || !!floorsLoading;
  const tableLoadError = tablesError || floorsError;

  // --- Handlers ---
  const handleTableStatusChange = async (table, nextStatus) => {
    if (isPosManagedStatusTransition(table?.status, nextStatus)) {
      showNotification(POS_MANAGED_STATUS_TRANSITION_MESSAGE, "warning");
      return;
    }
    return changeTableStatus(table.id, nextStatus);
  };

  const changeTableStatus = async (tableId, newStatus) => {
    try {
      await setTableStatus({ id: String(tableId), status: newStatus });
      await refetchTables();
    } catch (error) {
      showNotification(mapTableMutationError(error), "error");
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
    navigate(`/manager/floor-map/${restaurantId}?floorId=${targetFloorId}`);
  };

  const handleOpenTableDetail = (tableRow) => {
    const rawTable = getRawTableById(tablesRaw, tableRow.id);
    setLiteTable(rawTable || tableRow);
    setShowLiteModal(true);
  };

  const handleOpenArPlacementForTable = (tableRow) => {
    if (!tableRow?.id) return;
    const rawTable = getRawTableById(tablesRaw, tableRow.id);
    const targetTable = rawTable || tableRow;
    const targetFloorId = targetTable?.floorId ?? tableRow?.floorId;
    const foundFloor =
      floors.find((floor) => String(floor.id) === String(targetFloorId)) ||
      (floorsRaw || []).find((floor) => String(floor.id) === String(targetFloorId));
    setLiteTable(targetTable);
    setSimulatorTargetFloor(foundFloor || null);
    setShowTable3DModal(true);
  };

  const handleOpen3DSimulatorFromHeader = () => {
    setLiteTable(null);
    setSimulatorTargetFloor(null);
    setShowTable3DModal(true);
  };

  const handleOpenAddTableModal = () => {
    setTableForm((prev) => ({
      ...prev,
      floorId: prev.floorId || (isAllFloorsSelected ? "" : currentFloor),
    }));
    setShowAddTableModal(true);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setCurrentFilters({ status: "", area: "" });
  };

  const handleSaveTable = async () => {
    if (tableSaving) return;
    const { number, seats, floorId, area, visualConfig } = tableForm;
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
        visualConfig: visualConfig || null,
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



  const handleSaveArTablePosition = async ({ position, visualConfigPatch } = {}) => {
    const targetTable = liteTable || null;
    if (!targetTable?.id) {
      showNotification("Vui lòng mở chi tiết một bàn trước khi lưu vị trí AR.", "warning");
      return;
    }
    try {
      await updateTable({
        id: targetTable.id,
        position,
        visualConfig: {
          ...(targetTable.visualConfig || {}),
          ...(visualConfigPatch || {}),
        },
      });
      await refetchTables();
      showNotification("Đã lưu vị trí bàn từ AR.", "success");
    } catch (error) {
      console.error(error);
      showNotification("Không thể lưu vị trí bàn từ AR.", "error");
      throw error;
    }
  };

  const handleApply3DTemplate = (selectedModel, extras = {}) => {
    const mapped = mapModelToTableForm(selectedModel);
    // Chỉ prefill form để user xác nhận lại theo luồng thêm bàn hiện tại.
    setTableForm((prev) => ({
      ...prev,
      seats: mapped.seats,
      area: mapped.area,
      floorId:
        prev.floorId ||
        (isAllFloorsSelected ? "" : currentFloor) ||
        "",
      visualTemplate: mapped.visualTemplate,
      visualConfig: extras.visualConfig || prev.visualConfig || null,
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
      <ManagementPageHeader
        density="compact"
        showTimeWidget={false}
        eyebrow="QUẢN LÝ BÀN"
        title="Quản lý bàn"
        subtitle="Theo dõi trạng thái bàn, sơ đồ tầng và đặt chỗ."
        icon="🍽️"
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={restaurantList.map((r) => ({ id: String(r.id), name: r.name }))}
        stats={[
          { id: "total", icon: "🪑", label: "Tổng bàn", value: tablesMapped.length },
          { id: "busy", icon: "🔴", label: "Đang sử dụng", value: tablesMapped.filter((t) => t.status === "occupied").length },
          { id: "free", icon: "🟢", label: "Trống", value: tablesMapped.filter((t) => t.status === "available").length },
          { id: "floors", icon: "🏢", label: "Số tầng", value: floors.length },
        ]}
        loading={isLoadingTables}
        secondaryActions={[
          { label: "Thiết kế sơ đồ", icon: "🗺️", onClick: handleOpenFloorDesigner },
          { label: "VR toàn quán", icon: "🕶️", onClick: () => setShowVrModal(true) },
          { label: "Mô phỏng 3D", icon: "🪑", onClick: handleOpen3DSimulatorFromHeader, disabled: !restaurantId },
        ]}
        primaryAction={{ label: "Thêm bàn", icon: "➕", onClick: handleOpenAddTableModal }}
      />

      {/* --- Main Layout --- */}
      <div className="tm-layout">
        {/* Sidebar: Floors */}
        <aside className="tm-sidebar" aria-label="Chọn tầng và lọc bàn">
          <div className="tm-panel-heading">
            <span className="tm-panel-kicker">Điều hướng tầng</span>
            <h2>Khu vực / Tầng</h2>
          </div>
          <nav className="tm-floor-list" aria-label="Danh sách tầng">
            <button
              type="button"
              className={`tm-floor-item ${isAllFloorsSelected ? "active" : ""}`}
              onClick={selectAllFloors}
              aria-pressed={isAllFloorsSelected}
            >
              <span className="icon" aria-hidden="true">🏬</span>
              <span className="name">Tất cả tầng</span>
              <span className="count" aria-label={`${allFloorsCount} bàn`}>{allFloorsCount}</span>
            </button>
            {floors.map((f) => {
              const isActiveFloor =
                !isAllFloorsSelected && String(currentFloor) === String(f.id);
              return (
                <button
                  type="button"
                  key={f.id}
                  className={`tm-floor-item ${isActiveFloor ? "active" : ""}`}
                  onClick={() => selectFloor(f.id)}
                  aria-pressed={isActiveFloor}
                >
                  <span className="icon" aria-hidden="true">{f.icon}</span>
                  <span className="name">{f.name}</span>
                  <span className="count" aria-label={`${getFloorTableCount(f.id)} bàn`}>
                    {getFloorTableCount(f.id)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className="tm-add-floor-btn"
              onClick={() => setShowFloorModal(true)}
            >
              + Thêm tầng
            </button>
          </nav>

          {!isAllFloorsSelected && (
            <section className="tm-floor-design-card" aria-label="Thiết kế sơ đồ tầng đang chọn">
              <div>
                <span>Đang chọn</span>
                <strong>{selectedFloorName}</strong>
              </div>
              <button type="button" onClick={handleOpenFloorDesigner}>
                Thiết kế sơ đồ tầng
              </button>
            </section>
          )}

          <section className="tm-filter-box" aria-label="Bộ lọc bàn">
            <div className="tm-filter-heading">
              <span>Bộ lọc bàn</span>
              {hasActiveFilters && (
                <button type="button" onClick={handleResetFilters}>
                  Reset
                </button>
              )}
            </div>
            <label className="tm-filter-field" htmlFor="tm-table-search">
              <span>Tìm bàn</span>
              <input
                id="tm-table-search"
                type="text"
                placeholder="Nhập mã hoặc số bàn"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm bàn theo mã hoặc số bàn"
              />
            </label>
            <label className="tm-filter-field" htmlFor="tm-status-filter">
              <span>Trạng thái</span>
              <select
                id="tm-status-filter"
                value={currentFilters.status}
                onChange={(e) =>
                  setCurrentFilters({ ...currentFilters, status: e.target.value })
                }
                aria-label="Lọc theo trạng thái bàn"
              >
                <option value="">Tất cả trạng thái</option>
                {TABLE_STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.icon} {statusOption.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="tm-filter-field" htmlFor="tm-area-filter">
              <span>Khu vực</span>
              <select
                id="tm-area-filter"
                value={currentFilters.area}
                onChange={(e) =>
                  setCurrentFilters({ ...currentFilters, area: e.target.value })
                }
                aria-label="Lọc theo khu vực bàn"
              >
                <option value="">Tất cả khu vực</option>
                {TABLE_AREA_OPTIONS.map((areaOption) => (
                  <option key={areaOption.value} value={areaOption.value}>
                    {areaOption.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </aside>

        {/* Main: Grid Tables */}
        <section className="tm-grid-area" aria-label="Danh sách bàn vận hành">
          <div className="tm-grid-toolbar">
            <div>
              <span className="tm-panel-kicker">Danh sách bàn</span>
              <h2>{selectedFloorName}</h2>
            </div>
            <span className="tm-result-count">{filteredTables.length} bàn</span>
          </div>
          {tableLoadError ? (
            <div className="tm-empty tm-empty--error" role="alert">
              <span aria-hidden="true">⚠️</span>
              <p>Không thể tải dữ liệu bàn/tầng. Vui lòng thử lại sau.</p>
            </div>
          ) : isLoadingTables ? (
            <div className="tm-table-grid" aria-label="Đang tải bàn">
              {Array.from({ length: 8 }).map((_, index) => (
                <article key={index} className="tm-table-card tm-table-card--skeleton" aria-hidden="true">
                  <div className="skeleton-line skeleton-line--title" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                  <div className="skeleton-actions">
                    <span />
                    <span />
                  </div>
                </article>
              ))}
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="tm-empty">
              <span aria-hidden="true">🪑</span>
              <p>
                {hasActiveFilters
                  ? "Không có bàn phù hợp với bộ lọc hiện tại."
                  : floors.length === 0
                    ? "Chưa có tầng để gán bàn."
                    : tablesMapped.length === 0
                      ? "Chưa có bàn nào trong nhà hàng."
                      : "Không có bàn nào hiển thị."}
              </p>
              {hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Xóa bộ lọc
                </Button>
              ) : floors.length === 0 ? (
                <Button variant="primary" size="sm" onClick={() => setShowFloorModal(true)}>
                  Thêm tầng
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleOpenAddTableModal}>
                  Thêm bàn đầu tiên
                </Button>
              )}
            </div>
          ) : (
            <div className="tm-table-grid">
              {filteredTables.map((t) => {
                const statusCfg = getStatusConfig(t.status);
                const hasVr = !!t.vrUrl || !!loadTableVrImage(t.id);
                const hasVisualConfig = !!t.visualConfig;
                const guardState = getTableGuardState(t);
                return (
                  <article
                    key={t.id}
                    className={`tm-table-card ${t.status}`}
                  >
                    <div className="card-top">
                      <span className="table-no">{t.number || "Bàn chưa mã"}</span>
                      <div className="card-top-right">
                        {hasVr && <span className="vr-badge">360°</span>}
                        {hasVisualConfig && (
                          <span
                            className="tm-3d-badge"
                            title="Bàn này có cấu hình mô phỏng 3D"
                          >
                            3D
                          </span>
                        )}
                        {guardState.hasGuard && (
                          <span className="tm-guard-badge" title={guardState.reason}>
                            {guardState.badge}
                          </span>
                        )}
                        <span className={`status-badge ${statusCfg.color}`}>
                          {statusCfg.text}
                        </span>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="info-row">
                        <span aria-hidden="true">👥</span> {t.seats} chỗ
                      </div>
                      <div className="info-row">
                        <span aria-hidden="true">🏢</span> {getFloorName(t.floorId)}
                      </div>
                      <div className="info-row">
                        <span aria-hidden="true">🏷️</span> {getAreaText(t.area)}
                      </div>
                      <div className="info-row">
                        <span aria-hidden="true">💰</span> {formatCurrency(t.deposit)}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button
                        type="button"
                        className="btn-mini primary btn-mini--3d"
                        aria-label={`Mở 3D và AR cho bàn ${t.number || "chưa có mã"}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenArPlacementForTable(t);
                        }}
                      >
                        3D / AR
                      </button>
                      <button
                        type="button"
                        className="btn-mini secondary"
                        aria-label={`Mở cấu hình bàn ${t.number || "chưa có mã"}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenTableDetail(t);
                        }}
                      >
                        Chi tiết
                      </button>
                      {t.status === "available" && (
                        renderQuickAction(t, "occupied", "Nhận khách", "btn-mini success")
                      )}
                      {t.status === "occupied" && (
                        renderQuickAction(t, "payment_pending", "T.Toán", "btn-mini warning")
                      )}
                      {t.status === "payment_pending" && (
                        renderQuickAction(t, "cleaning", "Dọn bàn", "btn-mini primary")
                      )}
                      {t.status === "cleaning" && (
                        renderQuickAction(t, "available", "Hoàn tất", "btn-mini secondary")
                      )}
                      {t.status === "reserved" && (
                        renderQuickAction(t, "occupied", "Nhận khách", "btn-mini success")
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* --- MODALS SECTION --- */}

      {/* 1. Quick Actions Modal */}
      {showLiteModal && latestLiteTable && (
        <TableActionsLiteModal
          open={showLiteModal}
          table={latestLiteTable}
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
        size="lg"
        className="tm-modal tm-modal--add-table"
      >
        <Modal.Header>Thêm bàn mới</Modal.Header>
        <Modal.Body className="tm-form tm-form--add-table">
          <div className="tm-form-header tm-form-header--add-table">
            <h4>Thiết lập thông tin bàn</h4>
            <p>Điền thông tin cơ bản để tạo bàn mới trong khu vực quản lý.</p>
          </div>
          <div className="tm-form-section tm-form-section--basic">
            <div className="tm-form-section-title">Thông tin cơ bản</div>
            <div className="tm-form-grid">
              <div className={`tm-field ${tableErrors.number ? "is-invalid" : ""}`}>
                <label htmlFor="tm-add-table-number">Số bàn *</label>
                <input
                  id="tm-add-table-number"
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
                <label htmlFor="tm-add-table-seats">Số ghế *</label>
                <input
                  id="tm-add-table-seats"
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
              <div className={`tm-field ${tableErrors.floorId ? "is-invalid" : ""}`}>
                <label htmlFor="tm-add-table-floor">Tầng *</label>
                <select
                  id="tm-add-table-floor"
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
                <label htmlFor="tm-add-table-area">Khu vực</label>
                <select
                  id="tm-add-table-area"
                  value={tableForm.area}
                  onChange={(e) =>
                    setTableForm({ ...tableForm, area: e.target.value })
                  }
                >
                  {TABLE_AREA_OPTIONS.map((areaOption) => (
                    <option key={areaOption.value} value={areaOption.value}>
                      {areaOption.label}
                    </option>
                  ))}
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
          {tableForm.visualConfig && (
            <div className="tm-template-preview">
              <div className="tm-template-preview__title">Cấu hình mô phỏng 3D</div>
              <div className="tm-template-preview__value">
                {getVisualConfigSummary(tableForm.visualConfig)?.label || "Mẫu bàn đã lưu"}
              </div>
              <div className="tm-template-preview__hint">
                Đã lưu metadata model, nguồn và camera placement nếu có cho bàn này.
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
        size="sm"
        className="tm-modal tm-modal--floor"
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
              <label htmlFor="tm-add-floor-name">Tên tầng *</label>
              <input
                id="tm-add-floor-name"
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
        currentFloorName={
          simulatorTargetFloor?.name ||
          floors.find((f) => String(f.id) === String(currentFloor))?.name
        }
        restaurantName={restaurant?.name}
        restaurantId={restaurantId}
        restaurant={restaurant}
        table={latestLiteTable}
        floor={
          simulatorTargetFloor ||
          floors.find((f) => String(f.id) === String(currentFloor))
        }
        currentFloorLayout={
          simulatorTargetFloor ||
          floors.find((f) => String(f.id) === String(currentFloor))
        }
        onSaveArPosition={handleSaveArTablePosition}
      />

      {/* 4. Restaurant VR Modal */}
      <Modal
        isOpen={showVrModal}
        onClose={() => vrDraft.requestCloseWithDraft(() => setShowVrModal(false))}
        title="Cấu hình VR toàn quán"
        size="lg"
        className="tm-modal tm-modal--vr"
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
