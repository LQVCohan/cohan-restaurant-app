import React, { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useTableManagement from "@/hooks/useTableManagement";
import { useNotification } from "@/hooks/useNotification";
import { mapTableMutationError } from "@/utils/tableMutationError";
import {
  TABLE_AREA_OPTIONS,
  getTableAreaLabel,
  getTableStatusConfig,
} from "@/utils/tableManagementOptions";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import "./TableTypeManagementPage.scss";

const ALL_TYPES = "all";

const getInitialRestaurantId = (restaurants = []) => {
  const stored = localStorage.getItem("manager.selectedRestaurantId");
  if (stored) return stored;
  const first = restaurants[0];
  return first ? String(first.id ?? first.restaurantId ?? "") : "";
};

export default function TableTypeManagementPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(() =>
    getInitialRestaurantId(restaurants),
  );
  const [selectedType, setSelectedType] = useState(ALL_TYPES);
  const [searchQuery, setSearchQuery] = useState("");
  const [busyTableId, setBusyTableId] = useState("");

  useEffect(() => {
    if (!selectedRestaurantId && restaurants.length) {
      setSelectedRestaurantId(getInitialRestaurantId(restaurants));
    }
  }, [restaurants, selectedRestaurantId]);

  useEffect(() => {
    const handleScopeSelection = (event) => {
      if (event?.detail?.key !== "manager.selectedRestaurantId") return;
      const nextRestaurantId = String(event.detail.value || "");
      if (nextRestaurantId) setSelectedRestaurantId(nextRestaurantId);
    };
    window.addEventListener("manager:scope-selection", handleScopeSelection);
    return () => window.removeEventListener("manager:scope-selection", handleScopeSelection);
  }, []);

  const restaurantId = selectedRestaurantId || null;
  const {
    tables = [],
    tablesLoading,
    tablesError,
    updateTable,
    refetchTables,
  } = useTableManagement({ restaurantId });

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
            .slice(0, 4),
        };
      }),
    [tables],
  );

  const usedTypeCount = typeSummaries.filter((item) => item.count > 0).length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredTables = useMemo(
    () =>
      tables
        .filter((table) => selectedType === ALL_TYPES || table.type === selectedType)
        .filter((table) =>
          !normalizedSearch
            ? true
            : String(table.code || "").toLowerCase().includes(normalizedSearch),
        )
        .sort((a, b) =>
          String(a.code || "").localeCompare(String(b.code || ""), "vi", {
            numeric: true,
          }),
        ),
    [normalizedSearch, selectedType, tables],
  );

  const handleRestaurantChange = (nextRestaurantId) => {
    const value = String(nextRestaurantId || "");
    setSelectedRestaurantId(value);
    setSelectedType(ALL_TYPES);
    setSearchQuery("");
    if (value) localStorage.setItem("manager.selectedRestaurantId", value);
  };

  const handleTypeChange = async (table, nextType) => {
    if (!table?.id || !nextType || nextType === table.type || busyTableId) return;
    setBusyTableId(String(table.id));
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
      setBusyTableId("");
    }
  };

  const openTableManagement = () => {
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: { page: "tables", source: "table-types" },
      }),
    );
  };

  return (
    <div className="ttm-page">
      <ManagementPageHeader
        density="compact"
        showTimeWidget={false}
        eyebrow="PHÂN LOẠI BÀN"
        title="Quản lý loại bàn"
        subtitle="Xem và cập nhật loại của từng bàn từ một nơi. Mã loại hệ thống được giữ cố định để bảo toàn dữ liệu."
        icon="🏷️"
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={handleRestaurantChange}
        restaurantList={restaurants.map((restaurant) => ({
          id: String(restaurant.id ?? restaurant.restaurantId),
          name: restaurant.name,
        }))}
        stats={[
          { id: "types", icon: "🏷️", label: "Loại hệ thống", value: TABLE_AREA_OPTIONS.length },
          { id: "used", icon: "✓", label: "Đang sử dụng", value: usedTypeCount },
          { id: "tables", icon: "🪑", label: "Tổng bàn", value: tables.length },
          { id: "visible", icon: "⌕", label: "Đang hiển thị", value: filteredTables.length },
        ]}
        loading={tablesLoading}
        secondaryActions={[
          { label: "Quay lại bàn ăn", icon: "←", onClick: openTableManagement },
        ]}
      />

      <section className="ttm-type-section" aria-labelledby="ttm-type-heading">
        <div className="ttm-section-heading">
          <div>
            <span>Danh mục cố định</span>
            <h2 id="ttm-type-heading">Sáu loại bàn trong hệ thống</h2>
          </div>
          <button
            type="button"
            className={`ttm-all-filter ${selectedType === ALL_TYPES ? "is-active" : ""}`}
            onClick={() => setSelectedType(ALL_TYPES)}
            aria-pressed={selectedType === ALL_TYPES}
          >
            Tất cả · {tables.length}
          </button>
        </div>

        <div className="ttm-type-grid">
          {typeSummaries.map((item) => {
            const isSelected = selectedType === item.value;
            return (
              <button
                type="button"
                key={item.value}
                className={`ttm-type-card ${isSelected ? "is-active" : ""}`}
                onClick={() => setSelectedType(item.value)}
                aria-pressed={isSelected}
              >
                <span className="ttm-type-card__code">{item.value}</span>
                <strong>{item.label}</strong>
                <span className="ttm-type-card__count">{item.count} bàn</span>
                <small>
                  {item.tableCodes.length
                    ? item.tableCodes.join(" · ")
                    : "Chưa có bàn thuộc loại này"}
                </small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="ttm-list-section" aria-labelledby="ttm-list-heading">
        <div className="ttm-list-toolbar">
          <div>
            <span>Phân loại trực tiếp</span>
            <h2 id="ttm-list-heading">
              {selectedType === ALL_TYPES
                ? "Tất cả bàn"
                : `Bàn ${getTableAreaLabel(selectedType)}`}
            </h2>
          </div>
          <div className="ttm-controls">
            <label>
              <span>Tìm mã bàn</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Ví dụ: A1, VIP-02"
              />
            </label>
            <label>
              <span>Lọc loại bàn</span>
              <select
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
          </div>
        </div>

        {tablesError ? (
          <div className="ttm-state ttm-state--error" role="alert">
            Không thể tải danh sách bàn. Vui lòng thử lại sau.
          </div>
        ) : tablesLoading ? (
          <div className="ttm-skeleton" aria-label="Đang tải danh sách loại bàn">
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="ttm-state">
            <strong>Không có bàn phù hợp</strong>
            <span>Hãy đổi bộ lọc hoặc thêm bàn tại trang Quản lý bàn.</span>
          </div>
        ) : (
          <div className="ttm-table-wrap">
            <table className="ttm-table">
              <thead>
                <tr>
                  <th>Bàn</th>
                  <th>Vị trí</th>
                  <th>Sức chứa</th>
                  <th>Trạng thái</th>
                  <th>Loại hiện tại</th>
                </tr>
              </thead>
              <tbody>
                {filteredTables.map((table) => {
                  const status = getTableStatusConfig(table.status);
                  const isBusy = busyTableId === String(table.id);
                  return (
                    <tr key={table.id}>
                      <td data-label="Bàn">
                        <strong>{table.code || "Chưa có mã"}</strong>
                        <code>{table.type || "standard"}</code>
                      </td>
                      <td data-label="Vị trí">
                        {table.floorLevel != null ? `Tầng ${table.floorLevel}` : "Chưa rõ tầng"}
                      </td>
                      <td data-label="Sức chứa">{Number(table.capacity || 0)} chỗ</td>
                      <td data-label="Trạng thái">
                        <span className={`ttm-status ttm-status--${status.color}`}>
                          {status.icon && <span aria-hidden="true">{status.icon}</span>}
                          {status.text}
                        </span>
                      </td>
                      <td data-label="Loại hiện tại">
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
                        {isBusy && <small>Đang lưu…</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
