import React, { useMemo, useState, useCallback } from "react";
import cls from "./LeftPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import {
  DndContext,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
} from "@dnd-kit/core";
import { TableActionsModal } from "../modals/TableActionsModal";

/* -------------------------------- UI bits -------------------------------- */

function StatusDot({ status }) {
  return (
    <span
      className={`${cls.dot} ${
        status === "occupied"
          ? cls.dotOccupied
          : status === "reserved"
          ? cls.dotReserved
          : status === "cleaning"
          ? cls.dotCleaning
          : status === "offline"
          ? cls.dotOffline
          : cls.dotAvailable
      }`}
    />
  );
}

function TableCard({ t, active, selected, onClick, onOpenTableActions }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: t.id });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: t.id, data: { table: t } });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px,0)` }
    : undefined;

  return (
    <div
      ref={(n) => {
        setDropRef(n);
        setDragRef(n);
      }}
      className={`${cls.tableItem} ${active ? cls.selected : ""} ${
        selected ? cls.checked : ""
      } ${isDragging ? cls.dragging : ""} ${isOver ? cls.over : ""}`}
      data-status={t.status} // SCSS dùng để tô màu theo trạng thái
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={style}
      {...attributes}
      {...listeners}
      title={`Bàn ${t.code} • ${t.capacity ?? 0} chỗ • ${t.status}`}
    >
      <div className={cls.tableTop}>
        <StatusDot status={t.status} />
        {t.type && <span className={cls.badge}>{t.type}</span>}
      </div>

      <div className={cls.tableCode}>Bàn {t.code}</div>

      <div className={`${cls.tableMeta} ${cls.metaRow}`}>
        <span className={cls.kv}>{t.capacity ?? 0} chỗ</span>
        <span className={cls.kv}>{t.status}</span>
        {/* {t.position?.shape && (
          <span className={cls.kv}>
            {t.position.shape}
            {t.position.w && t.position.h
              ? ` ${t.position.w}×${t.position.h}`
              : ""}
          </span>
        )} */}
        {/* {Number.isFinite(t.position?.x) && Number.isFinite(t.position?.y) && (
          <span className={cls.kv}>
            ({t.position.x}, {t.position.y})
          </span>
        )} */}
      </div>

      {/* Nút 3 chấm (kebab) – ẩn mặc định, hiện khi hover card (styled trong SCSS) */}
      <button
        type="button"
        className={cls.kebab}
        onClick={(e) => {
          e.stopPropagation();
          onOpenTableActions?.(t);
        }}
        aria-label="Hành động bàn"
        title="Hành động bàn"
      >
        •••
      </button>

      {Array.isArray(t.tags) && t.tags.length > 0 && (
        <div className={`${cls.tableMeta} ${cls.metaRow}`}>
          {t.tags.map((tag, i) => (
            <span key={i} className={cls.kv}>
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Main -------------------------------- */

export default function LeftPanel({ className = "" }) {
  const {
    restaurantId,

    // Floors & filter
    floors,
    activeLevel,
    setActiveLevel,

    // Tables + filters
    tables,
    tableSearch,
    setTableSearch,
    statusFilter,
    setStatusFilter,

    // Tabs (order type)
    currentOrderType,
    setCurrentOrderType,

    // Actions
    selectTableForOrder,
    swapTableCodes,
    mergeTables,
    splitTables,
    refetchTables,
  } = usePos();
  setTimeout(() => refetchTables?.(), 500);
  // Tabs config (chia đều 3 cột bằng CSS grid)
  const tabs = useMemo(
    () => [
      { key: "dine_in", label: "Bàn ăn" },
      { key: "delivery", label: "Giao hàng" },
      { key: "takeaway", label: "Mang về" },
    ],
    []
  );
  const setTab = (key) => setCurrentOrderType(key);

  // Multi-select
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modal actions
  const [actionsOpen, setActionsOpen] = useState(false);
  const [activeTableForActions, setActiveTableForActions] = useState(null);
  const onOpenTableActions = useCallback((t) => {
    setActiveTableForActions(t);
    setActionsOpen(true);
  }, []);

  // Status counts
  const counts = useMemo(() => {
    const base = {
      all: tables?.length || 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      offline: 0,
    };
    (tables || []).forEach((t) => {
      if (base[t.status] != null) base[t.status] += 1;
    });
    return base;
  }, [tables]);

  const selectedEntities = useMemo(
    () => (tables || []).filter((t) => selectedIds.includes(t.id)),
    [tables, selectedIds]
  );

  const sameGroupSelected = useMemo(() => {
    if (!selectedEntities.length) return null;
    const gid = selectedEntities[0]?.joinGroupId || null;
    return selectedEntities.every((t) => t.joinGroupId === gid) ? gid : null;
  }, [selectedEntities]);

  const canSwap = useMemo(() => {
    if (!restaurantId || selectedEntities.length !== 2) return false;
    const [a, b] = selectedEntities;
    return String(a.floorId) === String(b.floorId);
  }, [selectedEntities, restaurantId]);

  const toggleSelect = (id) =>
    setSelectedIds((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
    );

  const handleClickTable = (t) => {
    if (multiSelect) return toggleSelect(t.id);
    selectTableForOrder(t.code, t.capacity || 0);
  };

  const handleSwap = async () => {
    if (!canSwap) return;
    const [a, b] = selectedEntities;
    await swapTableCodes({
      restaurantId,
      floorId: a.floorId,
      aId: a.id,
      bId: b.id,
    });
    setSelectedIds([]);
    setMultiSelect(false);
    await refetchTables?.();
  };

  const handleMerge = async () => {
    if (selectedIds.length < 2) return;
    await mergeTables({ tableIds: selectedIds, anchorId: selectedIds[0] });
    setSelectedIds([]);
    setMultiSelect(false);
    await refetchTables?.();
  };

  const handleSplitPartial = async () => {
    if (!sameGroupSelected) return;
    await splitTables({
      joinGroupId: sameGroupSelected,
      mode: "PARTIAL",
      tableIds: selectedIds,
    });
    setSelectedIds([]);
    setMultiSelect(false);
    await refetchTables?.();
  };

  // Drag & drop -> swap codes giữa 2 bàn cùng tầng
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 5 },
    }),
    useSensor(KeyboardSensor)
  );
  const onDragEnd = async ({ active, over }) => {
    if (!active?.id || !over?.id || active.id === over.id) return;
    const a = tables.find((t) => t.id === active.id);
    const b = tables.find((t) => t.id === over.id);
    if (!a || !b || String(a.floorId) !== String(b.floorId)) return;
    await swapTableCodes({
      restaurantId,
      floorId: a.floorId,
      aId: a.id,
      bId: b.id,
    });
    await refetchTables?.();
    setSelectedIds([]);
    setMultiSelect(false);
  };

  return (
    <div className={`${cls.wrapper} ${className}`}>
      {/* Tabs chia đều */}
      <div className={cls.header}>
        <div className={cls.navTabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${cls.tab} ${
                currentOrderType === t.key ? cls.active : ""
              }`}
              onClick={() => setTab(t.key)}
              aria-selected={currentOrderType === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Hộp “Tạo đơn mới” theo tab */}
        {currentOrderType === "dine_in" && (
          <div className={cls.newOrderBox}>
            <h4>Tạo đơn mới (Bàn ăn)</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={() => {
                  // Gợi ý: focus ô tìm kiếm để chọn bàn nhanh
                  const el = document.querySelector(`.${cls.search}`);
                  el?.focus();
                }}
              >
                Chọn bàn
              </button>
              <button
                className={cls.btn}
                onClick={() => {
                  /* mở modal đặt bàn nếu có */
                }}
              >
                + Đặt bàn
              </button>
            </div>
          </div>
        )}

        {currentOrderType === "delivery" && (
          <div className={cls.newOrderBox}>
            <h4>Tạo đơn mới (Giao hàng)</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={() => {
                  /* mở form giao hàng */
                }}
              >
                + Đơn giao
              </button>
              <button
                className={cls.btn}
                onClick={() => {
                  /* chọn khách cũ */
                }}
              >
                Chọn khách cũ
              </button>
            </div>
          </div>
        )}

        {currentOrderType === "takeaway" && (
          <div className={cls.newOrderBox}>
            <h4>Tạo đơn mới (Mang về)</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={() => {
                  /* form nhanh */
                }}
              >
                + Đơn mang về
              </button>
              <button
                className={cls.btn}
                onClick={() => {
                  /* chọn combo */
                }}
              >
                Chọn combo
              </button>
            </div>
          </div>
        )}

        {/* Select tầng + tìm kiếm chung 1 hàng */}
        <div className={cls.filterRow}>
          <select
            className={cls.select}
            value={activeLevel ?? ""}
            onChange={(e) =>
              setActiveLevel(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Tất cả tầng</option>
            {[...floors]
              .sort((a, b) => a.level - b.level)
              .map((f) => (
                <option key={f.id} value={f.level}>
                  Tầng {f.level}
                  {f.name ? ` — ${f.name}` : ""}
                </option>
              ))}
          </select>

          <input
            className={cls.search}
            placeholder='Tìm bàn… ví dụ "A1" (tiền tố), "A1 " (chính xác)'
            value={tableSearch || ""}
            onChange={(e) => setTableSearch(e.target.value)}
          />
        </div>

        {/* Chips trạng thái */}
        <div className={cls.statusChips}>
          {[
            { key: "all", label: `Tất cả (${counts.all})` },
            { key: "available", label: `Trống (${counts.available})` },
            { key: "occupied", label: `Có khách (${counts.occupied})` },
            { key: "reserved", label: `Đã đặt (${counts.reserved})` },
            { key: "cleaning", label: `Đang dọn (${counts.cleaning})` },
            { key: "offline", label: `Ngưng (${counts.offline})` },
          ].map((chip) => (
            <button
              key={chip.key}
              className={`${cls.chip} ${
                statusFilter === chip.key ? cls.chipActive : ""
              }`}
              onClick={() => setStatusFilter(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar – luôn đủ nút khi bật chọn nhiều */}
      <div className={cls.toolbar}>
        <div className={cls.left}>
          <button
            className={`${cls.btn} ${multiSelect ? cls.primary : ""}`}
            onClick={() => setMultiSelect((v) => !v)}
            title="Chọn nhiều bàn để thao tác"
          >
            {multiSelect ? "Đang chọn nhiều" : "Chọn nhiều"}
          </button>

          {multiSelect && (
            <>
              <button
                className={`${cls.btn} ${
                  selectedIds.length >= 2 ? cls.success : cls.disabled
                }`}
                onClick={handleMerge}
                disabled={selectedIds.length < 2}
                title="Gộp nhóm các bàn đã chọn"
              >
                Gộp bàn
              </button>

              <button
                className={`${cls.btn} ${
                  sameGroupSelected ? cls.violet : cls.disabled
                }`}
                onClick={handleSplitPartial}
                disabled={!sameGroupSelected}
                title="Tách các bàn đã chọn khỏi nhóm"
              >
                Tách bàn
              </button>

              <button
                className={`${cls.btn} ${canSwap ? cls.primary : cls.disabled}`}
                onClick={handleSwap}
                disabled={!canSwap}
                title="Đổi chỗ (swap code) giữa 2 bàn cùng tầng"
              >
                Đổi chỗ
              </button>

              <button
                className={cls.btn}
                onClick={() => {
                  setSelectedIds([]);
                  setMultiSelect(false);
                }}
              >
                Bỏ chọn
              </button>
            </>
          )}
        </div>
      </div>

      {/* Danh sách bàn + DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className={cls.tablesGrid}>
          {tables?.length ? (
            tables.map((t) => (
              <TableCard
                key={t.id}
                t={t}
                active={false}
                selected={selectedIds.includes(t.id)}
                onClick={() => handleClickTable(t)}
                onOpenTableActions={onOpenTableActions}
              />
            ))
          ) : (
            <div className={cls.empty}>Không có bàn phù hợp bộ lọc.</div>
          )}
        </div>
      </DndContext>

      {/* Modal hành động bàn */}
      <TableActionsModal
        open={actionsOpen}
        table={activeTableForActions}
        onClose={() => setActionsOpen(false)}
        onUpdated={() => refetchTables?.()}
      />
    </div>
  );
}
