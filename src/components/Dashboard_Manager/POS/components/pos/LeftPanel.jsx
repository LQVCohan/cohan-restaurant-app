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
      title={`Bàn ${t.displayCode || t.code} • ${t.capacity ?? 0} chỗ • ${
        t.status
      }${t.isGroup ? " • (Nhóm bàn)" : ""}`}
    >
      <div className={cls.tableTop}>
        <StatusDot status={t.status} />
        {t.type && <span className={cls.badge}>{t.type}</span>}
        {t.isGroup && <span className={cls.badge}>Nhóm</span>}
      </div>

      <div className={cls.tableCode}>Bàn {t.displayCode || t.code}</div>

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

  // ---------- Gom nhóm bàn để hiển thị một thẻ duy nhất cho nhóm ----------
  const uiTables = useMemo(() => {
    if (!Array.isArray(tables) || tables.length === 0) return [];

    const groups = new Map();
    const singles = [];

    tables.forEach((t) => {
      if (t.joinGroupId) {
        if (!groups.has(t.joinGroupId)) groups.set(t.joinGroupId, []);
        groups.get(t.joinGroupId).push(t);
      } else {
        singles.push({
          ...t,
          isGroup: false,
          memberIds: [t.id],
          displayCode: t.code,
        });
      }
    });

    const precedence = [
      "occupied",
      "reserved",
      "cleaning",
      "offline",
      "available",
    ];

    const groupCards = Array.from(groups.values()).map((arr) => {
      const sortedByCode = [...arr].sort((a, b) =>
        String(a.code).localeCompare(String(b.code), undefined, {
          numeric: true,
        })
      );
      const displayCode = sortedByCode.map((x) => x.code).join("+");
      const anchor = sortedByCode[0];
      const groupStatus =
        precedence.find((s) => arr.some((x) => x.status === s)) || "available";
      const totalCapacity =
        arr.reduce((sum, x) => sum + (Number(x.capacity) || 0), 0) ||
        anchor.capacity;

      const tags = Array.from(new Set(arr.flatMap((x) => x.tags || [])));
      const memberIds = arr.map((x) => x.id);
      const memberCodes = sortedByCode.map((x) => x.code);

      return {
        ...anchor,
        isGroup: true,
        memberIds,
        memberCodes,
        displayCode,
        status: groupStatus,
        capacity: totalCapacity,
        tags,
      };
    });

    return [...singles, ...groupCards];
  }, [tables]);

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

  const toggleSelect = (entity) => {
    const ids = entity?.memberIds || [entity?.id];
    setSelectedIds((s) => {
      const allIncluded = ids.every((id) => s.includes(id));
      if (allIncluded) return s.filter((x) => !ids.includes(x));
      return Array.from(new Set([...s, ...ids]));
    });
  };

  const handleClickTable = (t) => {
    if (multiSelect) return toggleSelect(t);
    // với nhóm: lấy anchor theo code hiện tại (t.code là anchor)
    const anchor = fetchTableByCode?.(t.code, t.restaurantId) || t;
    selectTableForOrder(anchor.code, anchor.capacity || 0);
  };

  // ---------- Kéo thả: gộp bàn thay vì đổi code ----------
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
    if (!a || !b) return;
    if (String(a.floorId) !== String(b.floorId)) return;

    const ok = window.confirm(
      `Bạn có chắc muốn gộp bàn ${a.code} vào bàn ${
        b.code
      }?\nSau khi gộp, giao diện sẽ hiển thị dạng "${[a.code, b.code]
        .sort((x, y) =>
          String(x).localeCompare(String(y), undefined, { numeric: true })
        )
        .join("+")}".`
    );
    if (!ok) return;

    try {
      await mergeTables({ tableIds: [a.id, b.id], anchorId: b.id });
      await refetchTables?.();
      const name = [a.code, b.code]
        .sort((x, y) =>
          String(x).localeCompare(String(y), undefined, { numeric: true })
        )
        .join("+");
      showNotification?.(`Đã gộp bàn thành công: ${name}`, "success");
      setSelectedIds([]);
      setMultiSelect(false);
    } catch (e) {
      console.error(e);
      showNotification?.("Gộp bàn thất bại. Vui lòng thử lại.", "error");
    }
  };

  /**
   * Lưu thông tin khách (giữ nguyên như trước)
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

        const res = await fetchOrderByTable?.(restaurantId, code, 1, 0);
        const activeOrder = res?.data?.[0] || null;

        if (activeOrder) {
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

          try {
            if (table.status === "reserved") {
              await setTableStatus?.({ id: table.id, status: "occupied" });
            }
          } catch {}
          await refetchTables?.();
          return;
        }

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
          } catch {}

          showNotification?.(
            `Đã tạo đặt bàn cho ${code} và chuyển trạng thái sang "Đã đặt".`,
            "success"
          );
          await refetchTables?.();
        } else {
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

  /* ---------- Reset toàn bộ bàn về TRỐNG (bulk) ---------- */
  const [isResetting, setIsResetting] = useState(false);

  const handleResetAllTables = useCallback(async () => {
    if (!restaurantId) {
      showNotification?.("Không xác định được nhà hàng.", "error");
      return;
    }
    const ok = window.confirm(
      "Bạn có muốn reset toàn bộ bàn về TRỐNG?\nHành động này chỉ đổi trạng thái bàn, không ảnh hưởng đến order hay hóa đơn."
    );
    if (!ok) return;

    try {
      setIsResetting(true);
      const list = (tables || []).filter((t) => t.status !== "available");
      if (list.length === 0) {
        showNotification?.("Tất cả bàn đang ở trạng thái trống.", "info");
        return;
      }

      const chunkSize = 10;
      for (let i = 0; i < list.length; i += chunkSize) {
        const chunk = list.slice(i, i + chunkSize);
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
          chunk.map((t) => setTableStatus?.({ id: t.id, status: "available" }))
        );
      }

      await refetchTables?.();
      showNotification?.(`Đã reset ${list.length} bàn về TRỐNG.`, "success");
    } catch (e) {
      console.error(e);
      showNotification?.("Reset bàn thất bại. Vui lòng thử lại.", "error");
    } finally {
      setIsResetting(false);
    }
  }, [restaurantId, tables, setTableStatus, refetchTables, showNotification]);

  /* --------- Lọc theo tầng + Tìm kiếm (contains & exact) + Trạng thái --------- */
  const filteredUiTables = useMemo(() => {
    const levelFiltered = (uiTables || []).filter((t) =>
      activeLevel == null ? true : String(t.floorLevel) === String(activeLevel)
    );

    const raw = tableSearch || "";
    const endsWithSpace = /\s$/.test(raw);
    const q = raw.trim().toLowerCase();

    const searchFiltered = q
      ? levelFiltered.filter((t) => {
          const display = String(t.displayCode || t.code || "").toLowerCase();
          if (endsWithSpace) {
            // exact mode: khớp đúng mã hiển thị hoặc bất kỳ mã thành viên
            const exactCodes = new Set([
              display,
              ...(t.memberCodes || []).map((x) => String(x).toLowerCase()),
              String(t.code || "").toLowerCase(),
            ]);
            return exactCodes.has(q);
          }
          // contains mode: tìm trong displayCode hoặc code của anchor
          const pool = [display, String(t.code || "").toLowerCase()];
          return pool.some((s) => s.includes(q));
        })
      : levelFiltered;

    const status = statusFilter || "all";
    const statusFiltered =
      status === "all"
        ? searchFiltered
        : searchFiltered.filter((t) => t.status === status);

    return statusFiltered;
  }, [uiTables, activeLevel, tableSearch, statusFilter]);

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
                onClick={async () => {
                  if (selectedIds.length < 2) return;
                  try {
                    await mergeTables({
                      tableIds: selectedIds,
                      anchorId: selectedIds[0],
                    });
                    await refetchTables?.();
                    setSelectedIds([]);
                    setMultiSelect(false);
                    showNotification?.("Đã gộp bàn đã chọn.", "success");
                  } catch (e) {
                    console.error(e);
                    showNotification?.("Gộp bàn thất bại.", "error");
                  }
                }}
                disabled={selectedIds.length < 2}
                title="Gộp nhóm các bàn đã chọn"
              >
                Gộp bàn
              </button>

              <button
                className={`${cls.btn} ${
                  sameGroupSelected ? cls.violet : cls.disabled
                }`}
                onClick={async () => {
                  if (!sameGroupSelected) return;
                  try {
                    await splitTables({
                      joinGroupId: sameGroupSelected,
                      mode: "PARTIAL",
                      tableIds: selectedIds,
                    });
                    await refetchTables?.();
                    setSelectedIds([]);
                    setMultiSelect(false);
                    showNotification?.("Đã tách bàn.", "success");
                  } catch (e) {
                    console.error(e);
                    showNotification?.("Tách bàn thất bại.", "error");
                  }
                }}
                disabled={!sameGroupSelected}
                title="Tách các bàn đã chọn khỏi nhóm"
              >
                Tách bàn
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

        {/* Reset toàn bộ bàn về TRỐNG */}
        <div className={cls.right}>
          <button
            type="button"
            className={`${cls.btn} ${cls.violet}`}
            onClick={handleResetAllTables}
            disabled={isResetting || (tables?.length ?? 0) === 0}
            title="Đặt tất cả bàn về TRỐNG"
          >
            {isResetting ? "Đang reset..." : "Reset toàn bộ bàn"}
          </button>
        </div>
      </div>

      {/* Danh sách bàn + DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className={cls.tablesGrid}>
          {filteredUiTables?.length ? (
            filteredUiTables.map((t) => (
              <TableCard
                key={t.id}
                t={t}
                active={false}
                selected={(t.memberIds || [t.id]).every((id) =>
                  selectedIds.includes(id)
                )}
                onClick={() => handleClickTable(t)}
                onOpenTableActions={onOpenTableActions}
              />
            ))
          ) : (
            <div className={cls.empty}>Không có bàn phù hợp bộ lọc.</div>
          )}
        </div>
      </DndContext>

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
