import React, { useCallback, useRef, useState } from "react";
import { ChevronDown, Star, Users } from "lucide-react";
import {
  clearStaffOrderTableSelection,
  isStaffOrderMobile,
  openStaffOrderMenuTab,
  readStaffOrderTableSelection,
  saveStaffOrderTableSelection,
} from "../staffOrderMobileSelection";
import "./TableMap.scss";
import "../StaffOrderingMobileFlow.scss";

const MOBILE_FILTER_QUERY = "(max-width: 560px)";

const getTableCode = (table) =>
  table?.tableCode || table?.code || table?.name || "Chưa đặt mã";

const getTableCapacity = (table) =>
  Number(table?.guests ?? table?.capacity ?? 0);

const getOperationalStatus = (status) => {
  if (status === "empty") {
    return { key: "empty", label: "Sẵn sàng" };
  }
  return { key: "serving", label: "Đang phục vụ" };
};

const getDefaultFilterOpen = () =>
  typeof window === "undefined" ||
  !window.matchMedia?.(MOBILE_FILTER_QUERY).matches;

export default function TableMap({
  tables = [],
  onSelect,
  selectedTable,
  floors = [],
}) {
  const [floor, setFloor] = useState(floors[0] || "");
  const [filterOpen, setFilterOpen] = useState(getDefaultFilterOpen);
  const restoredSelectionRef = useRef(false);

  React.useEffect(() => {
    if (!floor && floors.length) setFloor(floors[0]);
    if (floor && floors.length && !floors.includes(floor)) setFloor(floors[0]);
  }, [floor, floors]);

  React.useEffect(() => {
    const media = window.matchMedia?.(MOBILE_FILTER_QUERY);
    if (!media) return undefined;

    const syncFilter = () => setFilterOpen(!media.matches);
    syncFilter();
    media.addEventListener?.("change", syncFilter);
    return () => media.removeEventListener?.("change", syncFilter);
  }, []);

  React.useEffect(() => {
    if (
      restoredSelectionRef.current ||
      selectedTable?.id ||
      tables.length === 0
    ) {
      return;
    }

    restoredSelectionRef.current = true;
    const stored = readStaffOrderTableSelection();
    if (!stored) return;

    const restoredTable = tables.find(
      (table) => String(table.id) === stored.id,
    );
    if (!restoredTable) {
      clearStaffOrderTableSelection();
      return;
    }

    if (restoredTable.floor) setFloor(restoredTable.floor);
    onSelect?.(restoredTable);
    if (isStaffOrderMobile()) {
      window.requestAnimationFrame(openStaffOrderMenuTab);
    }
  }, [onSelect, selectedTable?.id, tables]);

  const handleSelectTable = useCallback(
    (table) => {
      onSelect?.(table);
      saveStaffOrderTableSelection(table);

      if (isStaffOrderMobile()) {
        window.requestAnimationFrame(openStaffOrderMenuTab);
      }
    },
    [onSelect],
  );

  const currentFloorTables = tables.filter((table) => table.floor === floor);
  const servingCount = currentFloorTables.filter(
    (table) => table.status !== "empty",
  ).length;

  return (
    <div className="staff-pos-tables">
      <div className="floor-header">
        <div className="floor-stats">
          <h3>Chọn bàn / khu vực</h3>
          <p>
            <Users size={15} aria-hidden="true" />{" "}
            <strong>{servingCount}</strong>/{currentFloorTables.length} bàn đang phục vụ
          </p>
        </div>
      </div>

      <details
        className="floor-filter"
        data-testid="floor-filter"
        open={filterOpen}
        onToggle={(event) => setFilterOpen(event.currentTarget.open)}
      >
        <summary>
          <span>
            <small>Bộ lọc bàn</small>
            <strong>{floor || "Chưa có khu vực"}</strong>
          </span>
          <span className="floor-filter__count">
            {currentFloorTables.length} bàn
            <ChevronDown size={17} aria-hidden="true" />
          </span>
        </summary>

        <div className="floor-selector-scroll" aria-label="Chọn không gian phục vụ">
          {floors.map((floorName) => (
            <button
              key={floorName}
              type="button"
              className={`floor-chip ${floorName === floor ? "active" : ""}`}
              onClick={() => setFloor(floorName)}
            >
              {floorName}
            </button>
          ))}
        </div>
      </details>

      <div className="table-grid">
        {currentFloorTables.map((table) => {
          const isSelected = selectedTable?.id === table.id;
          const status = getOperationalStatus(table.status);
          const code = getTableCode(table);
          const capacity = getTableCapacity(table);

          return (
            <article
              key={table.id}
              className={`table-card-wrapper status-${status.key} ${
                isSelected ? "selected" : ""
              }`}
            >
              <button
                type="button"
                className="table-card-main"
                onClick={() => handleSelectTable(table)}
                aria-pressed={isSelected}
                aria-label={`Chọn bàn ${code}, ${capacity} khách, ${status.label}`}
              >
                <div className="table-header">
                  <span className="table-name">{code}</span>
                  <span className="table-status-badge">
                    <span className="status-indicator" aria-hidden="true" />
                    {status.label}
                  </span>
                </div>
                <div className="table-body">
                  <span className="guest-count">
                    <Users size={14} aria-hidden="true" />
                    {capacity} khách
                  </span>
                  {table.customer?.name ? (
                    <span className="customer-tag">
                      <Star className="star-icon" size={12} aria-hidden="true" />
                      <span className="truncate">{table.customer.name}</span>
                    </span>
                  ) : null}
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export const __testables = {
  getTableCode,
  getTableCapacity,
  getOperationalStatus,
};
