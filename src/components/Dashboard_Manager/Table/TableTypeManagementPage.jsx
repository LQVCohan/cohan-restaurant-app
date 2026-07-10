import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { Building2, Tags, X } from "lucide-react";
import useTableManagement from "@/hooks/useTableManagement";
import useFloorManagement from "@/hooks/useFloorManagement";
import { useNotification } from "@/hooks/useNotification";
import { mapTableMutationError } from "@/utils/tableMutationError";
import {
  TABLE_AREA_OPTIONS,
  getTableAreaLabel,
  getTableStatusConfig,
} from "@/utils/tableManagementOptions";
import Modal from "../../../components/common/Modal";
import Button from "../../../components/common/Button";
import "./TableTypeManagementPage.scss";

const M_UPDATE_FLOOR = gql`
  mutation UpdateFloorFromTableSettings($input: UpdateFloorInput!) {
    updateFloor(input: $input) {
      id
      name
      level
      description
      isActive
    }
  }
`;

const M_DELETE_FLOOR = gql`
  mutation DeleteFloorFromTableSettings($id: ID!) {
    deleteFloor(id: $id)
  }
`;

const ALL_TYPES = "all";
const TYPE_TAB = "types";
const SPACE_TAB = "spaces";
const EMPTY_TABLE_FORM = {
  code: "",
  capacity: 4,
  floorId: "",
  type: "standard",
};

const sortByCode = (a, b) =>
  String(a.code || "").localeCompare(String(b.code || ""), "vi", {
    numeric: true,
  });

export default function TableTypeManagementPage({
  isOpen = false,
  onClose,
  restaurantId = null,
  restaurantName = "",
}) {
  const { showNotification } = useNotification();
  const scopedRestaurantId = isOpen ? restaurantId : null;
  const [activeTab, setActiveTab] = useState(TYPE_TAB);
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [showAddTable, setShowAddTable] = useState(false);
  const [tableForm, setTableForm] = useState(EMPTY_TABLE_FORM);
  const [editingTableId, setEditingTableId] = useState("");
  const [editTableForm, setEditTableForm] = useState(EMPTY_TABLE_FORM);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [editingFloorId, setEditingFloorId] = useState("");
  const [editingFloorName, setEditingFloorName] = useState("");

  const {
    tables = [],
    tablesLoading,
    tablesError,
    createTable,
    updateTable,
    moveTable,
    deleteTable,
    refetchTables,
  } = useTableManagement({ restaurantId: scopedRestaurantId });
  const {
    floors = [],
    floorsLoading,
    floorsError,
    createFloor,
    refetchFloors,
  } = useFloorManagement({
    restaurantId: scopedRestaurantId,
    enabled: Boolean(scopedRestaurantId),
  });
  const [updateFloor] = useMutation(M_UPDATE_FLOOR);
  const [deleteFloor] = useMutation(M_DELETE_FLOOR);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(TYPE_TAB);
    setSelectedType(ALL_TYPES);
    setSearchQuery("");
    setBusyKey("");
    setShowAddTable(false);
    setEditingTableId("");
    setEditingFloorId("");
    setNewSpaceName("");
  }, [isOpen, restaurantId]);

  useEffect(() => {
    if (!tableForm.floorId && floors[0]?.id) {
      setTableForm((current) => ({ ...current, floorId: String(floors[0].id) }));
    }
  }, [floors, tableForm.floorId]);

  const floorById = useMemo(
    () => new Map(floors.map((floor) => [String(floor.id), floor])),
    [floors],
  );
  const tableCountByFloor = useMemo(() => {
    const counts = new Map();
    tables.forEach((table) => {
      const key = String(table.floorId || "");
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [tables]);
  const typeSummaries = useMemo(
    () =>
      TABLE_AREA_OPTIONS.map((option) => {
        const matchingTables = tables.filter((table) => table.type === option.value);
        return {
          ...option,
          count: matchingTables.length,
          tableCodes: matchingTables
            .map((table) => table.code)
            .filter(Boolean)
            .sort((a, b) =>
              String(a).localeCompare(String(b), "vi", { numeric: true }),
            )
            .slice(0, 4),
        };
      }),
    [tables],
  );
  const filteredTables = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return [...tables]
      .filter((table) => selectedType === ALL_TYPES || table.type === selectedType)
      .filter((table) => {
        if (!normalizedSearch) return true;
        const floorName = floorById.get(String(table.floorId))?.name || "";
        return `${table.code || ""} ${floorName}`
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort(sortByCode);
  }, [floorById, searchQuery, selectedType, tables]);

  const getFloorName = (floorId) =>
    floorById.get(String(floorId))?.name || "Chưa xác định";

  const resetTableForm = (preferredType = "standard") => {
    setTableForm({
      ...EMPTY_TABLE_FORM,
      floorId: floors[0]?.id ? String(floors[0].id) : "",
      type: preferredType === ALL_TYPES ? "standard" : preferredType,
    });
  };

  const handleOpenAddTable = () => {
    resetTableForm(selectedType);
    setShowAddTable(true);
  };

  const handleCreateTable = async (event) => {
    event.preventDefault();
    const code = tableForm.code.trim();
    const capacity = Number(tableForm.capacity);
    if (!code || !tableForm.floorId || !Number.isFinite(capacity) || capacity < 1) {
      showNotification("Vui lòng nhập đủ mã bàn, sức chứa và không gian.", "error");
      return;
    }

    setBusyKey("create-table");
    try {
      const tableIndex = tables.filter(
        (table) => String(table.floorId) === String(tableForm.floorId),
      ).length;
      await createTable({
        restaurantId: scopedRestaurantId,
        floorId: tableForm.floorId,
        code,
        capacity,
        type: tableForm.type,
        status: "available",
        position: {
          x: 50 + (tableIndex % 6) * 90,
          y: 50 + Math.floor(tableIndex / 6) * 90,
        },
      });
      await refetchTables?.();
      showNotification(`Đã thêm bàn ${code}.`, "success");
      setShowAddTable(false);
      resetTableForm();
    } catch (error) {
      showNotification(
        mapTableMutationError(error, "Không thể thêm bàn. Vui lòng thử lại."),
        "error",
      );
    } finally {
      setBusyKey("");
    }
  };

  const handleTypeChange = async (table, nextType) => {
    if (!table?.id || !nextType || nextType === table.type || busyKey) return;
    setBusyKey(`type-${table.id}`);
    try {
      await updateTable({ id: String(table.id), type: nextType });
      await refetchTables?.();
      showNotification(
        `Đã chuyển bàn ${table.code || ""} sang loại ${getTableAreaLabel(nextType)}.`,
        "success",
      );
    } catch (error) {
      showNotification(
        mapTableMutationError(error, "Không thể cập nhật loại bàn. Vui lòng thử lại."),
        "error",
      );
    } finally {
      setBusyKey("");
    }
  };

  const beginEditTable = (table) => {
    setEditingTableId(String(table.id));
    setEditTableForm({
      code: table.code || "",
      capacity: Number(table.capacity || 1),
      floorId: String(table.floorId || ""),
      type: table.type || "standard",
    });
  };

  const handleUpdateTable = async (table) => {
    const code = editTableForm.code.trim();
    const capacity = Number(editTableForm.capacity);
    if (!code || !editTableForm.floorId || !Number.isFinite(capacity) || capacity < 1) {
      showNotification("Vui lòng nhập đủ mã bàn, sức chứa và không gian.", "error");
      return;
    }

    setBusyKey(`edit-${table.id}`);
    try {
      await updateTable({
        id: String(table.id),
        code,
        capacity,
        type: editTableForm.type,
      });
      if (String(editTableForm.floorId) !== String(table.floorId)) {
        await moveTable({
          id: String(table.id),
          floorId: editTableForm.floorId,
          position: table.position || { x: 50, y: 50 },
        });
      }
      await refetchTables?.();
      showNotification(`Đã cập nhật bàn ${code}.`, "success");
      setEditingTableId("");
    } catch (error) {
      showNotification(
        mapTableMutationError(error, "Không thể cập nhật bàn. Vui lòng thử lại."),
        "error",
      );
    } finally {
      setBusyKey("");
    }
  };

  const handleDeleteTable = async (table) => {
    if (!window.confirm(`Xóa bàn ${table.code || "này"}?`)) return;
    setBusyKey(`delete-${table.id}`);
    try {
      await deleteTable(String(table.id));
      await refetchTables?.();
      showNotification(`Đã xóa bàn ${table.code || ""}.`, "success");
    } catch (error) {
      showNotification(
        mapTableMutationError(error, "Không thể xóa bàn. Vui lòng thử lại."),
        "error",
      );
    } finally {
      setBusyKey("");
    }
  };

  const handleCreateSpace = async (event) => {
    event.preventDefault();
    const name = newSpaceName.trim();
    if (!name) {
      showNotification("Vui lòng nhập tên không gian.", "error");
      return;
    }
    setBusyKey("create-floor");
    try {
      await createFloor({ name });
      await refetchFloors?.();
      setNewSpaceName("");
      showNotification(`Đã thêm không gian ${name}.`, "success");
    } catch (error) {
      showNotification(error?.message || "Không thể thêm không gian.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleUpdateSpace = async (floor) => {
    const name = editingFloorName.trim();
    if (!name) {
      showNotification("Tên không gian không được để trống.", "error");
      return;
    }
    setBusyKey(`edit-floor-${floor.id}`);
    try {
      await updateFloor({ variables: { input: { id: String(floor.id), name } } });
      await refetchFloors?.();
      setEditingFloorId("");
      setEditingFloorName("");
      showNotification(`Đã đổi tên không gian thành ${name}.`, "success");
    } catch (error) {
      showNotification(error?.message || "Không thể cập nhật không gian.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleDeleteSpace = async (floor) => {
    const tableCount = tableCountByFloor.get(String(floor.id)) || 0;
    if (tableCount > 0) {
      showNotification("Hãy chuyển hoặc xóa hết bàn trước khi xóa không gian.", "warning");
      return;
    }
    if (!window.confirm(`Xóa không gian ${floor.name || "này"}?`)) return;
    setBusyKey(`delete-floor-${floor.id}`);
    try {
      await deleteFloor({ variables: { id: String(floor.id) } });
      await refetchFloors?.();
      showNotification(`Đã xóa không gian ${floor.name || ""}.`, "success");
    } catch (error) {
      showNotification(error?.message || "Không thể xóa không gian.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const renderTableRow = (table) => {
    const status = getTableStatusConfig(table.status);
    const isEditing = editingTableId === String(table.id);
    const isBusy = busyKey.includes(String(table.id));

    if (isEditing) {
      return (
        <article className="ttm-row ttm-row--editing" key={table.id}>
          <div className="ttm-edit-grid">
            <label className="ttm-field">
              <span>Mã bàn</span>
              <input
                aria-label={`Mã bàn ${table.code || "chưa có mã"}`}
                value={editTableForm.code}
                onChange={(event) =>
                  setEditTableForm((current) => ({ ...current, code: event.target.value }))
                }
              />
            </label>
            <label className="ttm-field">
              <span>Sức chứa</span>
              <input
                aria-label={`Sức chứa bàn ${table.code || "chưa có mã"}`}
                type="number"
                min="1"
                value={editTableForm.capacity}
                onChange={(event) =>
                  setEditTableForm((current) => ({
                    ...current,
                    capacity: event.target.value,
                  }))
                }
              />
            </label>
            <label className="ttm-field">
              <span>Không gian</span>
              <select
                aria-label={`Không gian bàn ${table.code || "chưa có mã"}`}
                value={editTableForm.floorId}
                onChange={(event) =>
                  setEditTableForm((current) => ({
                    ...current,
                    floorId: event.target.value,
                  }))
                }
              >
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="ttm-field">
              <span>Loại bàn</span>
              <select
                aria-label={`Chỉnh loại bàn ${table.code || "chưa có mã"}`}
                value={editTableForm.type}
                onChange={(event) =>
                  setEditTableForm((current) => ({ ...current, type: event.target.value }))
                }
              >
                {TABLE_AREA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ttm-row__actions">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditingTableId("")}
              disabled={isBusy}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleUpdateTable(table)}
              loading={isBusy}
            >
              Lưu thay đổi
            </Button>
          </div>
        </article>
      );
    }

    return (
      <article className="ttm-row" key={table.id}>
        <div className="ttm-row__main">
          <div className="ttm-row__identity">
            <strong>{table.code || "Chưa có mã"}</strong>
            <span>{getFloorName(table.floorId)}</span>
          </div>
          <div className="ttm-row__meta">
            <span>{Number(table.capacity || 0)} chỗ</span>
            <span className={`ttm-status ttm-status--${status.color}`}>
              {status.icon && <span aria-hidden="true">{status.icon}</span>}
              {status.text}
            </span>
          </div>
        </div>
        <label className="ttm-row__type">
          <span className="sr-only">Loại bàn</span>
          <select
            aria-label={`Loại bàn ${table.code || "chưa có mã"}`}
            value={table.type || "standard"}
            disabled={isBusy}
            onChange={(event) => handleTypeChange(table, event.target.value)}
          >
            {TABLE_AREA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ttm-row__actions">
          <button
            type="button"
            className="ttm-action ttm-action--edit"
            onClick={() => beginEditTable(table)}
            disabled={Boolean(busyKey)}
            aria-label={`Sửa bàn ${table.code || "chưa có mã"}`}
          >
            Sửa
          </button>
          <button
            type="button"
            className="ttm-action ttm-action--danger"
            onClick={() => handleDeleteTable(table)}
            disabled={Boolean(busyKey)}
            aria-label={`Xóa bàn ${table.code || "chưa có mã"}`}
          >
            Xóa
          </button>
        </div>
      </article>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      autoWrapBody={false}
      className="ttm-modal"
    >
      <Modal.Header className="ttm-modal__header" onClose={onClose}>
        <div>
          <span className="ttm-modal__eyebrow">Thiết lập bàn ăn</span>
          <h2>Loại bàn &amp; không gian</h2>
          <p>
            {restaurantName || "Chi nhánh đang chọn"} · Quản lý phân loại bàn và khu vực
            phục vụ trong cùng một nơi.
          </p>
        </div>
      </Modal.Header>

      <Modal.Body className="ttm-modal__body">
        <div className="ttm-tabs" role="tablist" aria-label="Thiết lập bàn ăn">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === TYPE_TAB}
            className={`ttm-tab ${activeTab === TYPE_TAB ? "is-active" : ""}`}
            onClick={() => setActiveTab(TYPE_TAB)}
          >
            <span aria-hidden="true"><Tags size={18} /></span>
            Loại bàn
            <strong>{tables.length}</strong>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === SPACE_TAB}
            className={`ttm-tab ${activeTab === SPACE_TAB ? "is-active" : ""}`}
            onClick={() => setActiveTab(SPACE_TAB)}
          >
            <span aria-hidden="true"><Building2 size={18} /></span>
            Không gian
            <strong>{floors.length}</strong>
          </button>
        </div>

        {activeTab === TYPE_TAB ? (
          <section className="ttm-panel" role="tabpanel" aria-label="Quản lý loại bàn">
            <div className="ttm-panel__heading">
              <div>
                <span>Danh mục hệ thống</span>
                <h3>Phân loại và quản lý từng bàn</h3>
                <p>Sáu mã loại được giữ cố định để đồng bộ đặt bàn, POS và báo cáo.</p>
              </div>
              <Button variant="primary" size="sm" onClick={handleOpenAddTable}>
                + Thêm bàn
              </Button>
            </div>

            <div className="ttm-type-grid">
              <button
                type="button"
                className={`ttm-type-card ${selectedType === ALL_TYPES ? "is-active" : ""}`}
                onClick={() => setSelectedType(ALL_TYPES)}
                aria-pressed={selectedType === ALL_TYPES}
              >
                <span className="ttm-type-card__code">all</span>
                <strong>Tất cả bàn</strong>
                <span>{tables.length} bàn</span>
                <small>Toàn bộ không gian phục vụ</small>
              </button>
              {typeSummaries.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={`ttm-type-card ${selectedType === item.value ? "is-active" : ""}`}
                  onClick={() => setSelectedType(item.value)}
                  aria-pressed={selectedType === item.value}
                >
                  <span className="ttm-type-card__code">{item.value}</span>
                  <strong>{item.label}</strong>
                  <span>{item.count} bàn</span>
                  <small>
                    {item.tableCodes.length
                      ? item.tableCodes.join(" · ")
                      : "Chưa có bàn thuộc loại này"}
                  </small>
                </button>
              ))}
            </div>

            <div className="ttm-toolbar">
              <label className="ttm-field ttm-field--search">
                <span>Tìm bàn</span>
                <input
                  type="search"
                  aria-label="Tìm bàn trong modal"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Mã bàn hoặc tên không gian"
                />
              </label>
              <label className="ttm-field">
                <span>Lọc loại</span>
                <select
                  aria-label="Lọc loại bàn trong modal"
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                >
                  <option value={ALL_TYPES}>Tất cả loại</option>
                  {TABLE_AREA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="ttm-result-count">{filteredTables.length} kết quả</span>
            </div>

            {showAddTable && (
              <form className="ttm-inline-form" onSubmit={handleCreateTable}>
                <div className="ttm-inline-form__heading">
                  <div>
                    <span>Thêm vào danh mục</span>
                    <h4>Tạo bàn mới</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddTable(false)}
                    aria-label="Đóng form thêm bàn"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="ttm-edit-grid">
                  <label className="ttm-field">
                    <span>Mã bàn *</span>
                    <input
                      aria-label="Mã bàn mới"
                      value={tableForm.code}
                      onChange={(event) =>
                        setTableForm((current) => ({ ...current, code: event.target.value }))
                      }
                      placeholder="VD: A1"
                    />
                  </label>
                  <label className="ttm-field">
                    <span>Sức chứa *</span>
                    <input
                      aria-label="Sức chứa bàn mới"
                      type="number"
                      min="1"
                      value={tableForm.capacity}
                      onChange={(event) =>
                        setTableForm((current) => ({
                          ...current,
                          capacity: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="ttm-field">
                    <span>Không gian *</span>
                    <select
                      aria-label="Tầng của bàn mới"
                      value={tableForm.floorId}
                      onChange={(event) =>
                        setTableForm((current) => ({
                          ...current,
                          floorId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Chọn không gian</option>
                      {floors.map((floor) => (
                        <option key={floor.id} value={floor.id}>
                          {floor.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="ttm-field">
                    <span>Loại bàn *</span>
                    <select
                      aria-label="Loại của bàn mới"
                      value={tableForm.type}
                      onChange={(event) =>
                        setTableForm((current) => ({ ...current, type: event.target.value }))
                      }
                    >
                      {TABLE_AREA_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="ttm-inline-form__actions">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddTable(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={busyKey === "create-table"}
                    disabled={!floors.length}
                  >
                    Tạo bàn
                  </Button>
                </div>
                {!floors.length && (
                  <p className="ttm-inline-warning">
                    Hãy tạo ít nhất một không gian trước khi thêm bàn.
                  </p>
                )}
              </form>
            )}

            {tablesError ? (
              <div className="ttm-state ttm-state--error" role="alert">
                Không thể tải danh sách bàn. Vui lòng thử lại sau.
              </div>
            ) : tablesLoading ? (
              <div className="ttm-skeleton" aria-label="Đang tải danh sách bàn">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={index} />
                ))}
              </div>
            ) : filteredTables.length ? (
              <div className="ttm-list">{filteredTables.map(renderTableRow)}</div>
            ) : (
              <div className="ttm-state">
                <strong>Không có bàn phù hợp</strong>
                <span>Đổi bộ lọc hoặc thêm bàn mới vào loại đang chọn.</span>
              </div>
            )}
          </section>
        ) : (
          <section className="ttm-panel" role="tabpanel" aria-label="Quản lý không gian">
            <div className="ttm-panel__heading">
              <div>
                <span>Tầng và khu vực phục vụ</span>
                <h3>Quản lý không gian đặt bàn</h3>
                <p>Tạo, đổi tên hoặc xóa tầng trống. Bàn đang thuộc tầng vẫn được bảo vệ.</p>
              </div>
            </div>

            <form className="ttm-space-form" onSubmit={handleCreateSpace}>
              <label className="ttm-field ttm-field--search">
                <span>Tên không gian mới</span>
                <input
                  aria-label="Tên không gian mới"
                  value={newSpaceName}
                  onChange={(event) => setNewSpaceName(event.target.value)}
                  placeholder="VD: Tầng 2, Sân vườn, Rooftop"
                />
              </label>
              <Button
                type="submit"
                variant="primary"
                loading={busyKey === "create-floor"}
              >
                + Thêm không gian
              </Button>
            </form>

            {floorsError ? (
              <div className="ttm-state ttm-state--error" role="alert">
                Không thể tải danh sách không gian.
              </div>
            ) : floorsLoading ? (
              <div className="ttm-skeleton" aria-label="Đang tải không gian">
                {Array.from({ length: 3 }).map((_, index) => (
                  <span key={index} />
                ))}
              </div>
            ) : floors.length ? (
              <div className="ttm-space-grid">
                {floors.map((floor) => {
                  const tableCount = tableCountByFloor.get(String(floor.id)) || 0;
                  const isEditing = editingFloorId === String(floor.id);
                  const isBusy = busyKey.includes(String(floor.id));
                  return (
                    <article className="ttm-space-card" key={floor.id}>
                      <div className="ttm-space-card__icon" aria-hidden="true">
                        {Number(floor.level || 0)}
                      </div>
                      <div className="ttm-space-card__content">
                        {isEditing ? (
                          <label className="ttm-field">
                            <span>Tên không gian</span>
                            <input
                              aria-label={`Tên không gian ${floor.name}`}
                              value={editingFloorName}
                              onChange={(event) => setEditingFloorName(event.target.value)}
                            />
                          </label>
                        ) : (
                          <>
                            <strong>{floor.name || `Tầng ${floor.level}`}</strong>
                            <span>Tầng {floor.level} · {tableCount} bàn</span>
                          </>
                        )}
                      </div>
                      <div className="ttm-space-card__actions">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              className="ttm-action"
                              onClick={() => setEditingFloorId("")}
                              disabled={isBusy}
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              className="ttm-action ttm-action--edit"
                              onClick={() => handleUpdateSpace(floor)}
                              disabled={isBusy}
                            >
                              Lưu
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="ttm-action ttm-action--edit"
                              onClick={() => {
                                setEditingFloorId(String(floor.id));
                                setEditingFloorName(floor.name || "");
                              }}
                              aria-label={`Sửa không gian ${floor.name}`}
                              disabled={Boolean(busyKey)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="ttm-action ttm-action--danger"
                              onClick={() => handleDeleteSpace(floor)}
                              aria-label={`Xóa không gian ${floor.name}`}
                              disabled={Boolean(busyKey) || tableCount > 0}
                              title={
                                tableCount > 0
                                  ? `Không thể xóa vì còn ${tableCount} bàn`
                                  : "Xóa không gian trống"
                              }
                            >
                              Xóa
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="ttm-state">
                <strong>Chưa có không gian phục vụ</strong>
                <span>Tạo tầng hoặc khu vực đầu tiên để bắt đầu thêm bàn.</span>
              </div>
            )}
          </section>
        )}
      </Modal.Body>

      <Modal.Footer className="ttm-modal__footer">
        <p>
          Loại bàn dùng mã hệ thống; thao tác thêm và xóa áp dụng cho từng bàn. Không gian
          tương ứng với tầng phục vụ của nhà hàng.
        </p>
        <Button variant="secondary" onClick={onClose}>
          Đóng
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
