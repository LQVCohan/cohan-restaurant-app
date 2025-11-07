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
import { useReservation } from "../../../../../hooks/useReservation";
import { useNotification } from "../../../../../hooks/useNotification";

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
      data-status={t.status}
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
      </div>

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
    floors,
    activeLevel,
    setActiveLevel,
    tables,
    tableSearch,
    setTableSearch,
    statusFilter,
    setStatusFilter,
    currentOrderType,
    setCurrentOrderType,
    selectTableForOrder,
    swapTableCodes,
    mergeTables,
    splitTables,
    refetchTables,

    // helpers
    fetchOrderByTable,
    fetchTableByCode,
    setTableStatus,

    // NEW from context (hook order)
    updateOrderCustomerByCode,
  } = usePos();

  const { showNotification } = useNotification();
  const { createReservation } = useReservation();

  const tabs = useMemo(
    () => [
      { key: "dine_in", label: "Bàn ăn" },
      { key: "delivery", label: "Giao hàng" },
      { key: "takeaway", label: "Mang về" },
    ],
    []
  );
  const setTab = (key) => setCurrentOrderType(key);

  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [actionsOpen, setActionsOpen] = useState(false);
  const [activeTableForActions, setActiveTableForActions] = useState(null);
  const onOpenTableActions = useCallback((t) => {
    setActiveTableForActions(t);
    setActionsOpen(true);
  }, []);

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

  /**
   * ✅ Được gọi từ TableActionsModal.saveCustomerInfo
   * - Nếu bàn có order: cập nhật trực tiếp order.user (không query lại OrdersByRestaurantNow)
   * - Nếu bàn trống: tạo Reservation và set status = reserved
   * (chỉ 1 lần refetchTables ở cuối)
   */
  const handleSaveCustomerFromModal = useCallback(
    async (tableCode, cust) => {
      try {
        const code = (tableCode || "").trim();
        const table =
          fetchTableByCode?.(code, restaurantId) ||
          (tables || []).find(
            (t) => (t.code || "").toLowerCase() === code.toLowerCase()
          );
        if (!table) {
          showNotification?.("Không tìm thấy bàn để lưu khách.", "error");
          return;
        }

        // 1) Có order? (chỉ gọi 1 lần)
        const res = await fetchOrderByTable?.(restaurantId, code, 1, 0);
        const activeOrder = res?.data?.[0] || null;

        if (activeOrder) {
          // cập nhật user vào đơn bằng orderCode (không cần query thêm)
          await updateOrderCustomerByCode({
            restaurantId,
            orderCode: activeOrder.orderCode,
            customer: {
              fullName: (cust?.fullName || cust?.name || "").trim(),
              phone: (cust?.phone || "").trim(),
              email: (cust?.email || "").trim().toLowerCase(),
            },
          });
          showNotification?.(
            `Đã cập nhật thông tin khách cho đơn #${activeOrder.orderCode}.`,
            "success"
          );

          // Nếu bàn đang reserved → chuyển sang occupied
          try {
            if (table.status === "reserved") {
              await setTableStatus?.({ id: table.id, status: "occupied" });
            }
            // eslint-disable-next-line no-empty
          } catch {}
          await refetchTables?.();
          return;
        }

        // 2) Không có order → nếu available thì tạo reservation
        if (table.status === "available") {
          const isoTime = cust?.checkin
            ? new Date(cust.checkin).toISOString()
            : new Date().toISOString();

          await createReservation({
            restaurantId,
            tableId: table.id,
            timeTo: isoTime,
            partySize:
              Number.isFinite(Number(cust?.guests)) && Number(cust?.guests) > 0
                ? Number(cust?.guests)
                : Number(table.capacity || 2),
            note: cust?.note || "",
            customerName: (cust?.name || cust?.fullName || "Guest").trim(),
            customerPhone: (cust?.phone || "").trim(),
            customerEmail: (cust?.email || "").trim().toLowerCase(),
            depositAmount: 0,
            durationMinutes: 90,
          });

          try {
            await setTableStatus?.({ id: table.id, status: "reserved" });
            // eslint-disable-next-line no-empty
          } catch {}

          showNotification?.(
            `Đã tạo đặt bàn cho ${code} và chuyển trạng thái sang "Đã đặt".`,
            "success"
          );
          await refetchTables?.();
        } else {
          // các trạng thái khác thì chỉ refresh 1 lần
          await refetchTables?.();
        }
      } catch (e) {
        console.error(e);
        showNotification?.("Lưu thông tin khách thất bại.", "error");
      }
    },
    [
      restaurantId,
      tables,
      fetchTableByCode,
      fetchOrderByTable,
      updateOrderCustomerByCode,
      setTableStatus,
      refetchTables,
      createReservation,
      showNotification,
    ]
  );

  return (
    <div className={`${cls.wrapper} ${className}`}>
      {/* Tabs */}
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

        {/* New order boxes by tab */}
        {currentOrderType === "dine_in" && (
          <div className={cls.newOrderBox}>
            <h4>Tạo đơn mới (Bàn ăn)</h4>
            <div className={cls.newOrderActions}>
              <button
                className={`${cls.btn} ${cls.primary}`}
                onClick={() => {
                  const el = document.querySelector(`.${cls.search}`);
                  el?.focus();
                }}
              >
                Chọn bàn
              </button>
              <button className={cls.btn} onClick={() => {}}>
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
                onClick={() => {}}
              >
                + Đơn giao
              </button>
              <button className={cls.btn} onClick={() => {}}>
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
                onClick={() => {}}
              >
                + Đơn mang về
              </button>
              <button className={cls.btn} onClick={() => {}}>
                Chọn combo
              </button>
            </div>
          </div>
        )}

        {/* Select tầng + tìm kiếm */}
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

      {/* Toolbar */}
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
        onSave={handleSaveCustomerFromModal}
      />
    </div>
  );
}
