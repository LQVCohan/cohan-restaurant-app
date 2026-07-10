import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../../../components/common/Modal";
import Button from "../../../components/common/Button";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "../../../hooks/useNotification";
import useTableManagement from "@/hooks/useTableManagement";
import useFloorManagement from "@/hooks/useFloorManagement";
import { useRestaurant } from "@/hooks/useRestaurant";
import TableActionsLiteModal from "./TableActionsLiteModal";
import { loadTableVrImage } from "@/utils/vrStorage";
import useModalDraft from "@/hooks/useModalDraft";
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
import "./TableManagement.scss";
import "./TableAddModal360.css";

const ALL_FLOORS_KEY = "all";
const EMPTY_TABLE_FORM = {
  number: "",
  seats: 4,
  floorId: "",
  area: "standard",
};

const resolveTableDuplicateMessage = (error, fallbackCode = "") => {
  const graphQLErrors =
    error?.graphQLErrors || error?.networkError?.result?.errors || [];
  const duplicateError = graphQLErrors.find(
    (item) => item?.extensions?.code === "TABLE_CODE_DUPLICATE",
  );
  if (duplicateError?.message) return duplicateError.message;

  const message = error?.message || "";
  if (message.includes("TABLE_CODE_DUPLICATE")) {
    return `Bàn '${fallbackCode}' đã tồn tại trong tầng này. Vui lòng dùng tên khác.`;
  }
  return "";
};

const TableManagement = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { restaurants } = useContext(AuthContext);
  const restaurantList = useMemo(() => restaurants || [], [restaurants]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  useEffect(() => {
    if (!selectedRestaurantId && restaurantList.length > 0) {
      setSelectedRestaurantId(
        String(restaurantList[0].id ?? restaurantList[0].restaurantId),
      );
    }
  }, [restaurantList, selectedRestaurantId]);

  const restaurantId = selectedRestaurantId || null;
  const {
    restaurant,
    updateRestaurant,
    refetch: refetchRestaurant,
  } = useRestaurant(restaurantId);

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

  const floors = useMemo(
    () =>
      (floorsRaw || []).map((floor) => ({
        id: String(floor.id),
        name: floor.name || `Tầng ${floor.level ?? ""}`,
        icon: "🏢",
        level: Number(floor.level),
      })),
    [floorsRaw],
  );

  const tablesMapped = useMemo(
    () =>
      (tablesRaw || []).map((table) => ({
        id: String(table.id),
        number: String(table.code || ""),
        seats: Number(table.capacity ?? 0),
        status: table.status || "available",
        floorId: table.floorId != null ? String(table.floorId) : null,
        area: table.type || "standard",
        vrUrl: table.vrUrl || "",
        deposit: table.deposit ?? 0,
        position: table.position || null,
      })),
    [tablesRaw],
  );

  const [currentFloor, setCurrentFloor] = useState(ALL_FLOORS_KEY);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFilters, setCurrentFilters] = useState({
    status: "",
    area: "",
  });

  const [showLiteModal, setShowLiteModal] = useState(false);
  const [liteTable, setLiteTable] = useState(null);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [showVrModal, setShowVrModal] = useState(false);
  const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM);
  const [floorForm, setFloorForm] = useState({ name: "" });
  const [vrForm, setVrForm] = useState({ vrTourUrl: "" });
  const [vrSaving, setVrSaving] = useState(false);
  const [tableSaving, setTableSaving] = useState(false);
  const [floorSaving, setFloorSaving] = useState(false);
  const [tableErrors, setTableErrors] = useState({});
  const [floorErrors, setFloorErrors] = useState({});

  const latestLiteTable = useMemo(
    () =>
      liteTable?.id
        ? getRawTableById(tablesRaw, liteTable.id) || liteTable
        : liteTable,
    [liteTable, tablesRaw],
  );

  const addTableDirty =
    Boolean(tableForm.number.trim()) ||
    Number(tableForm.seats || 0) !== 4 ||
    Boolean(tableForm.floorId) ||
    tableForm.area !== "standard";
  const floorDirty = Boolean(floorForm.name.trim());
  const normalizeVrTourUrl = (value) => String(value || "").trim();
  const vrInitialUrl = normalizeVrTourUrl(restaurant?.vrTourUrl);
  const vrCurrentUrl = normalizeVrTourUrl(vrForm.vrTourUrl);
  const vrDirty = vrCurrentUrl !== vrInitialUrl;

  const addTableDraft = useModalDraft({
    enabled: showAddTableModal,
    draftIdentity: {
      module: "table",
      modal: "add-table-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "table",
      recordId: null,
      context: String(restaurantId || "default"),
      schemaVersion: "2",
    },
    formValue: tableForm,
    isDirty: addTableDirty,
    sanitize: (value) => ({
      number: value?.number || "",
      seats: value?.seats ?? 4,
      floorId: value?.floorId || "",
      area: value?.area || "standard",
    }),
    onRestore: (draft) =>
      setTableForm((previous) => ({ ...previous, ...draft })),
    notify: showNotification,
  });

  const addFloorDraft = useModalDraft({
    enabled: showFloorModal,
    draftIdentity: {
      module: "table",
      modal: "add-floor-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "floor",
      recordId: null,
      context: String(restaurantId || "default"),
      schemaVersion: "1",
    },
    formValue: floorForm,
    isDirty: floorDirty,
    sanitize: (value) => ({ name: value?.name || "" }),
    onRestore: (draft) =>
      setFloorForm((previous) => ({ ...previous, ...draft })),
    notify: showNotification,
  });

  const vrDraft = useModalDraft({
    enabled: showVrModal,
    draftIdentity: {
      module: "table",
      modal: "restaurant-vr-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "edit",
      entityType: "restaurant-vr",
      recordId: restaurantId || null,
      context: "table-management",
      schemaVersion: "1",
    },
    formValue: vrForm,
    isDirty: vrDirty,
    sanitize: (value) => ({ vrTourUrl: value?.vrTourUrl || "" }),
    onRestore: (draft) => setVrForm((previous) => ({ ...previous, ...draft })),
    notify: showNotification,
  });

  const isAllFloorsSelected = currentFloor === ALL_FLOORS_KEY;

  useEffect(() => {
    if (currentFloor === ALL_FLOORS_KEY) return;
    const floorExists = floors.some(
      (floor) => String(floor.id) === String(currentFloor),
    );
    if (!floorExists) {
      setCurrentFloor(ALL_FLOORS_KEY);
      setActiveLevel(null);
    }
  }, [currentFloor, floors, setActiveLevel]);

  useEffect(() => {
    if (vrDraft.didRestore) return;
    const nextUrl = restaurant?.vrTourUrl || "";
    setVrForm((previous) =>
      previous.vrTourUrl === nextUrl
        ? previous
        : { ...previous, vrTourUrl: nextUrl },
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
    const level = getLevelFromId(floorId);
    if (level != null) setActiveLevel(Number(level));
  };

  const formatCurrency = (amount) =>
    `${Number(amount || 0).toLocaleString("vi-VN")}đ`;

  const findAvailablePosition = (floorId) => {
    const occupiedPositions = (tablesRaw || [])
      .filter((table) => String(table.floorId) === String(floorId))
      .map((table) => ({
        x: table.position?.x ?? 0,
        y: table.position?.y ?? 0,
        w: Number(table.position?.w || 60),
        h: Number(table.position?.h || 60),
      }));
    const overlaps = (x, y) =>
      occupiedPositions.some(
        (position) =>
          x < position.x + position.w + 10 &&
          x + 70 > position.x &&
          y < position.y + position.h + 10 &&
          y + 70 > position.y,
      );

    const start = { x: 50, y: 50 };
    if (!overlaps(start.x, start.y)) return start;

    const step = 80;
    for (let radius = 1; radius <= 10; radius += 1) {
      for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
        for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
          const candidate = {
            x: start.x + deltaX * step,
            y: start.y + deltaY * step,
          };
          if (!overlaps(candidate.x, candidate.y)) return candidate;
        }
      }
    }
    return start;
  };

  const hasActiveFilters = Boolean(
    searchQuery.trim() || currentFilters.status || currentFilters.area,
  );
  const baseFilteredTables = useMemo(
    () =>
      filterTableRows(tablesMapped, {
        searchQuery,
        status: currentFilters.status,
        area: currentFilters.area,
      }),
    [currentFilters.area, currentFilters.status, searchQuery, tablesMapped],
  );
  const filteredTables = useMemo(() => {
    const scopedTables = isAllFloorsSelected
      ? baseFilteredTables
      : filterTablesByFloor(baseFilteredTables, currentFloor);
    return sortTableRowsByNumber(scopedTables);
  }, [baseFilteredTables, currentFloor, isAllFloorsSelected]);

  const allFloorsCount = baseFilteredTables.length;
  const getFloorTableCount = (floorId) =>
    filterTablesByFloor(baseFilteredTables, floorId).length;
  const getFloorName = (floorId) =>
    floors.find((floor) => String(floor.id) === String(floorId))?.name ||
    "Chưa gán tầng";
  const selectedFloorName = isAllFloorsSelected
    ? "Tất cả tầng"
    : getFloorName(currentFloor);
  const isLoadingTables = Boolean(tablesLoading || floorsLoading);
  const tableLoadError = tablesError || floorsError;

  const changeTableStatus = async (tableId, newStatus) => {
    try {
      await setTableStatus({ id: String(tableId), status: newStatus });
      await refetchTables();
    } catch (error) {
      showNotification(mapTableMutationError(error), "error");
    }
  };

  const handleTableStatusChange = async (table, nextStatus) => {
    if (isPosManagedStatusTransition(table?.status, nextStatus)) {
      showNotification(POS_MANAGED_STATUS_TRANSITION_MESSAGE, "warning");
      return;
    }
    await changeTableStatus(table.id, nextStatus);
  };

  const renderQuickAction = (table, nextStatus, label, className) => {
    const reason = isPosManagedStatusTransition(table?.status, nextStatus)
      ? POS_MANAGED_STATUS_TRANSITION_TITLE
      : "";
    return (
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          handleTableStatusChange(table, nextStatus);
        }}
        disabled={Boolean(reason)}
        title={reason}
      >
        {label}
      </button>
    );
  };

  const handleOpenFloorDesigner = () => {
    if (isAllFloorsSelected || !currentFloor) {
      showNotification(
        "Vui lòng chọn một tầng cụ thể để thiết kế sơ đồ.",
        "warning",
      );
      return;
    }

    const activeCount = (tablesRaw || []).filter(
      (table) =>
        String(table.floorId) === String(currentFloor) &&
        table.status &&
        table.status !== "available",
    ).length;
    const floorWatching = (floorsRaw || []).find(
      (floor) => String(floor.id) === String(currentFloor),
    )?.isWatching;

    if (activeCount > 0 || floorWatching) {
      const floorName = getFloorName(currentFloor);
      showNotification(
        floorWatching
          ? `Tầng ${floorName} đang có khách xem sơ đồ, không thể chỉnh sửa.`
          : `Có ${activeCount} bàn đang hoạt động ở tầng ${floorName}. Không thể chỉnh sửa sơ đồ.`,
        "warning",
      );
      return;
    }

    navigate(`/manager/floor-map/${restaurantId}?floorId=${currentFloor}`);
  };

  const handleOpenTableDetail = (tableRow) => {
    setLiteTable(getRawTableById(tablesRaw, tableRow.id) || tableRow);
    setShowLiteModal(true);
  };

  const handleTable360Action = (tableRow) => {
    const rawTable = getRawTableById(tablesRaw, tableRow.id) || tableRow;
    const panoramaUrl = String(rawTable?.vrUrl || tableRow?.vrUrl || "").trim();
    const hasStoredPanorama = Boolean(loadTableVrImage(tableRow.id));

    if (panoramaUrl) {
      if (panoramaUrl.startsWith("/")) {
        navigate(panoramaUrl);
      } else {
        window.open(panoramaUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    if (hasStoredPanorama) {
      navigate(`/vr/table/${tableRow.id}`);
      return;
    }

    handleOpenTableDetail(tableRow);
  };

  const handleOpenAddTableModal = () => {
    setTableForm((previous) => ({
      ...previous,
      floorId:
        previous.floorId || (isAllFloorsSelected ? "" : String(currentFloor)),
    }));
    setShowAddTableModal(true);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setCurrentFilters({ status: "", area: "" });
  };

  const handleSaveTable = async () => {
    if (tableSaving) return;

    const number = tableForm.number.trim();
    const seats = Number(tableForm.seats);
    const floorId = tableForm.floorId;
    const nextErrors = {};
    if (!number) nextErrors.number = "Vui lòng nhập số bàn.";
    if (!floorId) nextErrors.floorId = "Vui lòng chọn tầng cho bàn.";
    if (!Number.isFinite(seats) || seats < 1) {
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
        (table) => String(table.floorId) === String(floorId),
      ).length;
      const floorName = getFloorName(floorId);

      await createTable({
        restaurantId,
        code: number,
        capacity: seats,
        floorId,
        type: tableForm.area,
        status: "available",
        position: { x: position.x, y: position.y },
      });
      await refetchTables();
      addTableDraft.clearDraft();
      setTableForm({
        ...EMPTY_TABLE_FORM,
        floorId: isAllFloorsSelected ? "" : String(currentFloor),
      });
      setShowAddTableModal(false);
      showNotification("Thêm bàn thành công.", "success");

      if (existingCount > 0) {
        showNotification(
          `Bàn mới đã được đặt tạm trên sơ đồ ${floorName}. Bạn có thể kéo chỉnh trong Thiết kế sơ đồ.`,
          "info",
        );
      }
    } catch (error) {
      const duplicateMessage = resolveTableDuplicateMessage(error, number);
      if (duplicateMessage) {
        setTableErrors((previous) => ({
          ...previous,
          number: duplicateMessage,
        }));
        showNotification(duplicateMessage, "error");
      } else {
        showNotification(mapTableMutationError(error), "error");
      }
    } finally {
      setTableSaving(false);
    }
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
    } catch (error) {
      console.error(error);
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
      if (createdFloor?.id) setCurrentFloor(String(createdFloor.id));
      if (createdFloor?.level != null) {
        setActiveLevel(Number(createdFloor.level));
      }
      showNotification(`Đã thêm tầng '${normalizedName}' thành công.`, "success");
      addFloorDraft.clearDraft();
      setFloorForm({ name: "" });
      setShowFloorModal(false);
    } catch (error) {
      const message = error?.message || "Không thể thêm tầng. Vui lòng thử lại.";
      setFloorErrors({ name: message });
      showNotification(message, "error");
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
        subtitle="Theo dõi trạng thái, sơ đồ tầng và không gian 360° quanh từng bàn."
        icon="🍽️"
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={restaurantList.map((item) => ({
          id: String(item.id),
          name: item.name,
        }))}
        stats={[
          {
            id: "total",
            icon: "🪑",
            label: "Tổng bàn",
            value: tablesMapped.length,
          },
          {
            id: "busy",
            icon: "🔴",
            label: "Đang sử dụng",
            value: tablesMapped.filter((table) => table.status === "occupied")
              .length,
          },
          {
            id: "free",
            icon: "🟢",
            label: "Trống",
            value: tablesMapped.filter((table) => table.status === "available")
              .length,
          },
          {
            id: "floors",
            icon: "🏢",
            label: "Số tầng",
            value: floors.length,
          },
        ]}
        loading={isLoadingTables}
        secondaryActions={[
          {
            label: "Thiết kế sơ đồ",
            icon: "🗺️",
            onClick: handleOpenFloorDesigner,
          },
          {
            label: "VR toàn quán",
            icon: "🕶️",
            onClick: () => setShowVrModal(true),
          },
        ]}
        primaryAction={{
          label: "Thêm bàn",
          icon: "➕",
          onClick: handleOpenAddTableModal,
        }}
      />

      <div className="tm-layout">
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
              <span className="icon" aria-hidden="true">
                🏬
              </span>
              <span className="name">Tất cả tầng</span>
              <span className="count" aria-label={`${allFloorsCount} bàn`}>
                {allFloorsCount}
              </span>
            </button>

            {floors.map((floor) => {
              const isActive =
                !isAllFloorsSelected &&
                String(currentFloor) === String(floor.id);
              return (
                <button
                  type="button"
                  key={floor.id}
                  className={`tm-floor-item ${isActive ? "active" : ""}`}
                  onClick={() => selectFloor(floor.id)}
                  aria-pressed={isActive}
                >
                  <span className="icon" aria-hidden="true">
                    {floor.icon}
                  </span>
                  <span className="name">{floor.name}</span>
                  <span
                    className="count"
                    aria-label={`${getFloorTableCount(floor.id)} bàn`}
                  >
                    {getFloorTableCount(floor.id)}
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
            <section
              className="tm-floor-design-card"
              aria-label="Thiết kế sơ đồ tầng đang chọn"
            >
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
                type="search"
                placeholder="Nhập mã hoặc số bàn"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Tìm bàn theo mã hoặc số bàn"
              />
            </label>

            <label className="tm-filter-field" htmlFor="tm-status-filter">
              <span>Trạng thái</span>
              <select
                id="tm-status-filter"
                value={currentFilters.status}
                onChange={(event) =>
                  setCurrentFilters((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))
                }
                aria-label="Lọc theo trạng thái bàn"
              >
                <option value="">Tất cả trạng thái</option>
                {TABLE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="tm-filter-field" htmlFor="tm-area-filter">
              <span>Khu vực</span>
              <select
                id="tm-area-filter"
                value={currentFilters.area}
                onChange={(event) =>
                  setCurrentFilters((previous) => ({
                    ...previous,
                    area: event.target.value,
                  }))
                }
                aria-label="Lọc theo khu vực bàn"
              >
                <option value="">Tất cả khu vực</option>
                {TABLE_AREA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        </aside>

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
                <article
                  key={index}
                  className="tm-table-card tm-table-card--skeleton"
                  aria-hidden="true"
                >
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
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowFloorModal(true)}
                >
                  Thêm tầng
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenAddTableModal}
                >
                  Thêm bàn đầu tiên
                </Button>
              )}
            </div>
          ) : (
            <div className="tm-table-grid">
              {filteredTables.map((table) => {
                const statusConfig = getTableStatusConfig(table.status);
                const hasPanorama = Boolean(
                  table.vrUrl || loadTableVrImage(table.id),
                );
                const guardState = getTableGuardState(table);

                return (
                  <article
                    key={table.id}
                    className={`tm-table-card ${table.status}`}
                  >
                    <div className="card-top">
                      <span className="table-no">
                        {table.number || "Bàn chưa mã"}
                      </span>
                      <div className="card-top-right">
                        {hasPanorama && <span className="vr-badge">360°</span>}
                        {guardState.hasGuard && (
                          <span
                            className="tm-guard-badge"
                            title={guardState.reason}
                          >
                            {guardState.badge}
                          </span>
                        )}
                        <span className={`status-badge ${statusConfig.color}`}>
                          {statusConfig.text}
                        </span>
                      </div>
                    </div>

                    <div className="card-body">
                      <div className="info-row">
                        <span aria-hidden="true">👥</span> {table.seats} chỗ
                      </div>
                      <div className="info-row">
                        <span aria-hidden="true">🏢</span>{" "}
                        {getFloorName(table.floorId)}
                      </div>
                      <div className="info-row">
                        <span aria-hidden="true">🏷️</span>{" "}
                        {getTableAreaLabel(table.area)}
                      </div>
                      <div className="info-row">
                        <span aria-hidden="true">💰</span>{" "}
                        {formatCurrency(table.deposit)}
                      </div>
                    </div>

                    <div className="card-actions">
                      <button
                        type="button"
                        className={`btn-mini btn-mini--360 ${
                          hasPanorama ? "is-ready" : "is-empty"
                        }`}
                        aria-label={
                          hasPanorama
                            ? `Xem không gian 360 của bàn ${table.number || "chưa có mã"}`
                            : `Thêm ảnh 360 cho bàn ${table.number || "chưa có mã"}`
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          handleTable360Action(table);
                        }}
                      >
                        {hasPanorama ? "Xem 360°" : "Thêm ảnh 360°"}
                      </button>

                      <button
                        type="button"
                        className="btn-mini secondary"
                        aria-label={`Mở cấu hình bàn ${table.number || "chưa có mã"}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenTableDetail(table);
                        }}
                      >
                        Chi tiết
                      </button>

                      {table.status === "available" &&
                        renderQuickAction(
                          table,
                          "occupied",
                          "Nhận khách",
                          "btn-mini success",
                        )}
                      {table.status === "occupied" &&
                        renderQuickAction(
                          table,
                          "payment_pending",
                          "T.Toán",
                          "btn-mini warning",
                        )}
                      {table.status === "payment_pending" &&
                        renderQuickAction(
                          table,
                          "cleaning",
                          "Dọn bàn",
                          "btn-mini primary",
                        )}
                      {table.status === "cleaning" &&
                        renderQuickAction(
                          table,
                          "available",
                          "Hoàn tất",
                          "btn-mini secondary",
                        )}
                      {table.status === "reserved" &&
                        renderQuickAction(
                          table,
                          "occupied",
                          "Nhận khách",
                          "btn-mini success",
                        )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

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

      <Modal
        isOpen={showAddTableModal}
        onClose={() =>
          addTableDraft.requestCloseWithDraft(() => setShowAddTableModal(false))
        }
        onBeforeClose={() => !tableSaving}
        closeOnEscape={!tableSaving}
        autoWrapBody={false}
        size="lg"
        className="tm-modal tm-modal--add-table tm-modal--360-only"
      >
        <Modal.Header>Thêm bàn</Modal.Header>
        <Modal.Body className="tm-form tm-form--add-table">
          <div className="tm-add-table-intro">
            <span className="tm-add-table-intro__icon" aria-hidden="true">
              🪑
            </span>
            <div>
              <span className="tm-add-table-intro__kicker">Thiết lập nhanh</span>
              <h4>Tạo vị trí phục vụ mới</h4>
              <p>
                Nhập thông tin vận hành của bàn. Ảnh không gian 360° được bổ sung
                sau khi tạo.
              </p>
            </div>
          </div>

          <section className="tm-form-section tm-form-section--basic">
            <div className="tm-form-section-title">Thông tin bàn</div>
            <div className="tm-form-grid">
              <div
                className={`tm-field ${tableErrors.number ? "is-invalid" : ""}`}
              >
                <label htmlFor="tm-add-table-number">Số bàn *</label>
                <input
                  id="tm-add-table-number"
                  value={tableForm.number}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTableForm((previous) => ({
                      ...previous,
                      number: value,
                    }));
                    if (tableErrors.number && value.trim()) {
                      setTableErrors((previous) => ({
                        ...previous,
                        number: undefined,
                      }));
                    }
                  }}
                  placeholder="VD: A1, B2..."
                  aria-invalid={Boolean(tableErrors.number)}
                />
                <div className="tm-field-meta">
                  <span className="tm-field-hint">
                    Dùng mã ngắn, dễ nhận biết theo khu vực.
                  </span>
                  {tableErrors.number && (
                    <span className="tm-field-error">{tableErrors.number}</span>
                  )}
                </div>
              </div>

              <div
                className={`tm-field ${tableErrors.seats ? "is-invalid" : ""}`}
              >
                <label htmlFor="tm-add-table-seats">Số ghế *</label>
                <input
                  id="tm-add-table-seats"
                  type="number"
                  min={1}
                  step={1}
                  value={tableForm.seats}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTableForm((previous) => ({
                      ...previous,
                      seats: value,
                    }));
                    if (tableErrors.seats && Number(value) >= 1) {
                      setTableErrors((previous) => ({
                        ...previous,
                        seats: undefined,
                      }));
                    }
                  }}
                  aria-invalid={Boolean(tableErrors.seats)}
                />
                <div className="tm-field-meta">
                  <span className="tm-field-hint">
                    Nên khớp với sức chứa thực tế của bàn.
                  </span>
                  {tableErrors.seats && (
                    <span className="tm-field-error">{tableErrors.seats}</span>
                  )}
                </div>
              </div>

              <div
                className={`tm-field ${tableErrors.floorId ? "is-invalid" : ""}`}
              >
                <label htmlFor="tm-add-table-floor">Tầng *</label>
                <select
                  id="tm-add-table-floor"
                  value={tableForm.floorId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setTableForm((previous) => ({
                      ...previous,
                      floorId: value,
                    }));
                    if (tableErrors.floorId && value) {
                      setTableErrors((previous) => ({
                        ...previous,
                        floorId: undefined,
                      }));
                    }
                  }}
                  aria-invalid={Boolean(tableErrors.floorId)}
                >
                  <option value="">Chọn tầng...</option>
                  {floors.map((floor) => (
                    <option key={floor.id} value={floor.id}>
                      {floor.name}
                    </option>
                  ))}
                </select>
                <div className="tm-field-meta">
                  <span className="tm-field-hint">
                    Bàn sẽ được đặt tạm trên sơ đồ của tầng này.
                  </span>
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
                  onChange={(event) =>
                    setTableForm((previous) => ({
                      ...previous,
                      area: event.target.value,
                    }))
                  }
                >
                  {TABLE_AREA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="tm-field-meta">
                  <span className="tm-field-hint">
                    Giúp lọc và điều phối khách theo nhu cầu.
                  </span>
                </div>
              </div>
            </div>
          </section>

          <aside className="tm-add-table-360-note">
            <span className="tm-add-table-360-note__badge">360°</span>
            <div>
              <strong>Thêm ảnh không gian sau khi tạo bàn</strong>
              <p>
                Mở Chi tiết bàn để tải ảnh panorama hoặc gắn liên kết xem 360°.
              </p>
            </div>
          </aside>
        </Modal.Body>

        <Modal.Footer className="tm-add-table-footer">
          <Button
            variant="secondary"
            onClick={() =>
              addTableDraft.requestCloseWithDraft(() =>
                setShowAddTableModal(false),
              )
            }
            disabled={tableSaving}
          >
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSaveTable} loading={tableSaving}>
            {tableSaving ? "Đang tạo..." : "Tạo bàn"}
          </Button>
        </Modal.Footer>
      </Modal>

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
              Đặt tên tầng rõ ràng để phân bổ bàn và quản lý sơ đồ thuận tiện hơn.
            </p>
          </div>
          <div className="tm-form-section">
            <div className="tm-form-section-title">Thông tin tầng</div>
            <div
              className={`tm-field ${floorErrors.name ? "is-invalid" : ""}`}
            >
              <label htmlFor="tm-add-floor-name">Tên tầng *</label>
              <input
                id="tm-add-floor-name"
                value={floorForm.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setFloorForm({ name: value });
                  if (floorErrors.name && value.trim()) setFloorErrors({});
                }}
                placeholder="VD: Tầng 1, Sân thượng..."
                aria-invalid={Boolean(floorErrors.name)}
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

      <Modal
        isOpen={showVrModal}
        onClose={() =>
          vrDraft.requestCloseWithDraft(() => setShowVrModal(false))
        }
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
                <label htmlFor="tm-restaurant-vr-url">
                  Link VR tổng quan (360/Google VR)
                </label>
                <input
                  id="tm-restaurant-vr-url"
                  value={vrForm.vrTourUrl}
                  onChange={(event) =>
                    setVrForm({ vrTourUrl: event.target.value })
                  }
                  placeholder="https://..."
                />
                <div className="hint">
                  Link này dành cho toàn quán. Ảnh 360° quanh từng bàn được quản
                  lý trong Chi tiết bàn.
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
                          "noopener,noreferrer",
                        );
                      }
                    }}
                    disabled={!vrCurrentUrl}
                  >
                    Mở thử VR
                  </Button>
                  <span className="tm-vr-status">
                    {vrCurrentUrl
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
                  <strong>Ảnh panorama rõ nét</strong>
                  <p>
                    Ưu tiên ảnh tỉ lệ 2:1 và chụp ở tầm mắt để thao tác xoay tự
                    nhiên hơn.
                  </p>
                </div>
              </div>
              <div className="tm-vr-tip">
                <span className="tip-icon">🪑</span>
                <div>
                  <strong>Mỗi bàn một góc nhìn</strong>
                  <p>
                    Dùng Chi tiết bàn để tải ảnh riêng, giúp khách hiểu khu vực
                    xung quanh chỗ ngồi.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="tm-modal-footer tm-vr-footer">
            <Button
              variant="secondary"
              onClick={() =>
                vrDraft.requestCloseWithDraft(() => setShowVrModal(false))
              }
              disabled={vrSaving}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveRestaurantVr}
              loading={vrSaving}
              disabled={!vrDirty}
            >
              {vrSaving ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TableManagement;
