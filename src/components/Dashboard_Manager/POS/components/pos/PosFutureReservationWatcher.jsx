import { useEffect, useMemo, useRef } from "react";
import { useNotification } from "@/hooks/useNotification";
import { usePos } from "../../../../../context/PosContext";
import {
  buildFutureReservationNotice,
  getTableReservationTime,
  hasFutureTableReservation,
} from "./posReservationSchedule";

const MAX_TIMER_DELAY_MS = 60 * 1000;

export default function PosFutureReservationWatcher() {
  const {
    currentOrderType,
    currentTable,
    tables,
    selectTableForOrder,
  } = usePos();
  const { showNotification } = useNotification();
  const lastNoticeKeyRef = useRef(null);
  const loadedScheduleKeyRef = useRef(null);

  const selectedTable = useMemo(() => {
    if (!currentTable?.id) return null;
    return (tables || []).find(
      (table) => String(table?.id || "") === String(currentTable.id),
    );
  }, [currentTable?.id, tables]);

  const reservationTime = getTableReservationTime(selectedTable);
  const scheduleKey = reservationTime
    ? `${selectedTable?.id || selectedTable?.code}:${reservationTime.toISOString()}`
    : null;

  useEffect(() => {
    if (currentOrderType !== "dine_in" || !selectedTable || !scheduleKey) return;
    if (!hasFutureTableReservation(selectedTable)) return;
    if (lastNoticeKeyRef.current === scheduleKey) return;

    lastNoticeKeyRef.current = scheduleKey;
    showNotification?.(buildFutureReservationNotice(selectedTable), "info");
  }, [
    currentOrderType,
    scheduleKey,
    selectedTable,
    showNotification,
  ]);

  useEffect(() => {
    if (
      currentOrderType !== "dine_in" ||
      !selectedTable?.code ||
      !reservationTime ||
      !scheduleKey
    ) {
      return undefined;
    }

    let cancelled = false;
    let timer = null;

    const refreshWhenDue = async () => {
      const remaining = reservationTime.getTime() - Date.now();
      if (remaining > 0) {
        timer = window.setTimeout(
          refreshWhenDue,
          Math.min(remaining + 250, MAX_TIMER_DELAY_MS),
        );
        return;
      }

      if (cancelled || loadedScheduleKeyRef.current === scheduleKey) return;
      loadedScheduleKeyRef.current = scheduleKey;

      await selectTableForOrder?.(
        selectedTable.code,
        selectedTable.capacity,
        { preserveDraftItems: false, source: "reservation_schedule" },
      );

      if (!cancelled) {
        showNotification?.(
          `Đã tới giờ đặt bàn ${selectedTable.code}. Món đặt trước đã được tải vào POS.`,
          "success",
        );
      }
    };

    void refreshWhenDue();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [
    currentOrderType,
    reservationTime,
    scheduleKey,
    selectedTable?.capacity,
    selectedTable?.code,
    selectTableForOrder,
    showNotification,
  ]);

  return null;
}
