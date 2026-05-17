import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { RESERVATION_EVENT_TYPES, RESERVATION_SOCKET_EVENT } from "@/hooks/useSocketReservation";
import styles from "./POSLayout.module.scss";

const MAX_ITEMS = 5;

function getReservation(evt) {
  return evt?.reservation || evt?.reservations?.[0] || null;
}

function getReservationKey(evt) {
  const reservation = getReservation(evt);
  return String(reservation?.id || reservation?._id || evt?.reservationId || Date.now());
}

function getTableLabel(evt) {
  const reservation = getReservation(evt);
  return reservation?.tableCode || reservation?.tableName || reservation?.tableId || evt?.tableId || "Chưa rõ bàn";
}

function formatTime(value) {
  if (!value) return "Chưa rõ giờ";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Chưa rõ giờ";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function mapEvent(evt) {
  const reservation = getReservation(evt);
  const tableLabel = getTableLabel(evt);
  const timeLabel = formatTime(reservation?.timeTo);

  switch (evt?.type) {
    case RESERVATION_EVENT_TYPES.CREATED:
      return {
        tone: "info",
        icon: CalendarClock,
        title: "Đặt bàn mới",
        description: `${tableLabel} · ${timeLabel}`,
      };
    case RESERVATION_EVENT_TYPES.CONFIRMED:
      return {
        tone: "success",
        icon: CheckCircle2,
        title: "Đã xác nhận",
        description: `${tableLabel} · ${timeLabel}`,
      };
    case RESERVATION_EVENT_TYPES.CHANGE_REQUESTED:
      return {
        tone: "warning",
        icon: Clock3,
        title: "Chờ duyệt đổi",
        description: `${tableLabel} · ${evt?.changeRequestType || "thay đổi"}`,
      };
    case RESERVATION_EVENT_TYPES.CHANGE_APPROVED:
      return {
        tone: "success",
        icon: CheckCircle2,
        title: "Đã duyệt đổi",
        description: `${tableLabel} · ${timeLabel}`,
      };
    case RESERVATION_EVENT_TYPES.CHANGE_REJECTED:
      return {
        tone: "danger",
        icon: XCircle,
        title: "Từ chối đổi",
        description: `${tableLabel} · giữ lịch cũ`,
      };
    case RESERVATION_EVENT_TYPES.CHECKED_IN:
      return {
        tone: "success",
        icon: CheckCircle2,
        title: "Đã nhận bàn",
        description: `${tableLabel} · seated`,
      };
    case RESERVATION_EVENT_TYPES.CANCELLED:
      return {
        tone: "danger",
        icon: XCircle,
        title: "Đã hủy",
        description: `${tableLabel} · giải phóng bàn`,
      };
    case RESERVATION_EVENT_TYPES.PAYMENT_EXPIRED:
      return {
        tone: "warning",
        icon: Clock3,
        title: "Hết hạn giữ bàn",
        description: "Pending payment đã quá hạn",
      };
    default:
      return {
        tone: "info",
        icon: CalendarClock,
        title: "Cập nhật đặt bàn",
        description: `${tableLabel} · ${timeLabel}`,
      };
  }
}

function normalizeActivity(evt) {
  const reservation = getReservation(evt);
  const mapped = mapEvent(evt);
  return {
    id: `${getReservationKey(evt)}:${evt?.type || "UNKNOWN"}:${Date.now()}`,
    reservationId: getReservationKey(evt),
    type: evt?.type || "UNKNOWN",
    tableId: reservation?.tableId || evt?.tableId || null,
    tableLabel: getTableLabel(evt),
    partySize: reservation?.partySize || null,
    timeTo: reservation?.timeTo || null,
    receivedAt: new Date().toISOString(),
    ...mapped,
  };
}

export default function PosReservationActivityPanel({ restaurantId }) {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (!restaurantId) return undefined;

    const onReservationEvent = (event) => {
      const evt = event?.detail?.event;
      if (!evt?.type) return;
      const eventRestaurantId = evt.restaurantId || getReservation(evt)?.restaurantId;
      if (eventRestaurantId && String(eventRestaurantId) !== String(restaurantId)) return;

      const next = normalizeActivity(evt);
      setActivities((prev) => {
        const deduped = (prev || []).filter(
          (item) => !(item.reservationId === next.reservationId && item.type === next.type),
        );
        return [next, ...deduped].slice(0, MAX_ITEMS);
      });
    };

    window.addEventListener(RESERVATION_SOCKET_EVENT, onReservationEvent);
    return () => window.removeEventListener(RESERVATION_SOCKET_EVENT, onReservationEvent);
  }, [restaurantId]);

  const visibleActivities = useMemo(() => activities.slice(0, MAX_ITEMS), [activities]);

  if (!visibleActivities.length) return null;

  return (
    <div className={styles.reservationActivityPanel}>
      <div className={styles.reservationActivityHeader}>
        <div>
          <strong>Hoạt động đặt bàn</strong>
          <span>Theo dõi realtime từ khách/POS</span>
        </div>
        <button type="button" onClick={() => setActivities([])}>Xóa</button>
      </div>

      <div className={styles.reservationActivityList}>
        {visibleActivities.map((activity) => {
          const Icon = activity.icon;
          return (
            <div
              key={activity.id}
              className={`${styles.reservationActivityItem} ${styles[`reservationActivityItem_${activity.tone}`] || ""}`}
            >
              <div className={styles.reservationActivityIcon}>
                <Icon size={16} />
              </div>
              <div className={styles.reservationActivityContent}>
                <strong>{activity.title}</strong>
                <span>{activity.description}</span>
              </div>
              {activity.partySize ? (
                <span className={styles.reservationActivityParty}>{activity.partySize} khách</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
