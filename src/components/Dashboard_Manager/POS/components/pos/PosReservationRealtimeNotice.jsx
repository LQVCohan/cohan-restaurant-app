import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, Clock3, XCircle } from "lucide-react";
import useSocketReservation, { RESERVATION_EVENT_TYPES } from "@/hooks/useSocketReservation";
import { useNotification } from "@/hooks/useNotification";
import styles from "./POSLayout.module.scss";

const MAX_ACTIVITY_ITEMS = 5;

function getReservation(evt) {
  return evt?.reservation || evt?.reservations?.[0] || null;
}

function getTableLabel(evt) {
  const reservation = getReservation(evt);
  return reservation?.tableCode || reservation?.tableName || reservation?.tableId || evt?.tableId || "bàn liên quan";
}

function getReservationKey(evt) {
  const reservation = getReservation(evt);
  return String(reservation?.id || reservation?._id || evt?.reservationId || Date.now());
}

function formatReservationTime(value) {
  if (!value) return "chưa rõ giờ";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "chưa rõ giờ";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function buildNotice(evt) {
  const reservation = getReservation(evt);
  const tableLabel = getTableLabel(evt);
  const timeLabel = formatReservationTime(reservation?.timeTo);

  switch (evt?.type) {
    case RESERVATION_EVENT_TYPES.CREATED:
      return {
        tone: "info",
        icon: CalendarClock,
        title: "Có yêu cầu đặt bàn mới",
        message: `Khách vừa tạo đặt bàn cho ${tableLabel} lúc ${timeLabel}.`,
        badge: "Đặt bàn mới",
      };
    case RESERVATION_EVENT_TYPES.CONFIRMED:
      return {
        tone: "success",
        icon: CheckCircle2,
        title: "Đặt bàn đã xác nhận",
        message: `${tableLabel} đã được xác nhận cho khung giờ ${timeLabel}.`,
        badge: "Đã xác nhận",
      };
    case RESERVATION_EVENT_TYPES.CANCELLED:
      return {
        tone: "danger",
        icon: XCircle,
        title: "Đặt bàn đã hủy",
        message: `${tableLabel} vừa hủy/đóng reservation. Kiểm tra lại trạng thái bàn nếu cần.`,
        badge: "Đã hủy",
      };
    case RESERVATION_EVENT_TYPES.PAYMENT_EXPIRED:
      return {
        tone: "warning",
        icon: AlertTriangle,
        title: "Giữ bàn quá hạn thanh toán",
        message: "Một hoặc nhiều reservation pending_payment đã quá hạn và được giải phóng.",
        badge: "Hết hạn giữ bàn",
      };
    case RESERVATION_EVENT_TYPES.PAYMENT_FAILED:
      return {
        tone: "danger",
        icon: AlertTriangle,
        title: "Thanh toán cọc thất bại",
        message: `${tableLabel} chưa được xác nhận do thanh toán cọc không thành công.`,
        badge: "Thanh toán lỗi",
      };
    case RESERVATION_EVENT_TYPES.CHANGE_REQUESTED:
      return {
        tone: "warning",
        icon: BellRing,
        title: "Khách yêu cầu đổi đặt bàn",
        message: `Reservation của ${tableLabel} đang chờ duyệt đổi ${evt?.changeRequestType || "thông tin"}.`,
        badge: "Chờ duyệt đổi",
      };
    case RESERVATION_EVENT_TYPES.CHANGE_APPROVED:
      return {
        tone: "success",
        icon: CheckCircle2,
        title: "Đã duyệt thay đổi đặt bàn",
        message: `${tableLabel} đã được cập nhật theo yêu cầu thay đổi.`,
        badge: "Đã duyệt",
      };
    case RESERVATION_EVENT_TYPES.CHANGE_REJECTED:
      return {
        tone: "danger",
        icon: XCircle,
        title: "Đã từ chối thay đổi đặt bàn",
        message: `${tableLabel} giữ nguyên thông tin đặt bàn cũ.`,
        badge: "Từ chối đổi",
      };
    case RESERVATION_EVENT_TYPES.CHECKED_IN:
      return {
        tone: "success",
        icon: CheckCircle2,
        title: "Khách đặt bàn đã check-in",
        message: `${tableLabel} đã chuyển sang seated và mở/ghép phiên POS an toàn.`,
        badge: "Đã nhận bàn",
      };
    default:
      return {
        tone: "info",
        icon: Clock3,
        title: "Reservation vừa cập nhật",
        message: `${tableLabel} có thay đổi trạng thái đặt bàn.`,
        badge: "Cập nhật",
      };
  }
}

function buildActivity(evt) {
  const notice = buildNotice(evt);
  const reservation = getReservation(evt);
  return {
    id: `${getReservationKey(evt)}:${evt?.type || "UNKNOWN"}:${Date.now()}`,
    reservationId: getReservationKey(evt),
    type: evt?.type || "UNKNOWN",
    tone: notice.tone,
    icon: notice.icon,
    title: notice.badge,
    tableLabel: getTableLabel(evt),
    timeLabel: formatReservationTime(reservation?.timeTo),
    partySize: reservation?.partySize || null,
  };
}

export default function PosReservationRealtimeNotice({ restaurantId }) {
  const { showNotification } = useNotification();
  const [latestEvent, setLatestEvent] = useState(null);
  const [activities, setActivities] = useState([]);

  const notice = useMemo(() => {
    return latestEvent ? buildNotice(latestEvent) : null;
  }, [latestEvent]);

  useSocketReservation(restaurantId, {
    onReservationEvent: (evt) => {
      setLatestEvent(evt);
      setActivities((prev) => {
        const next = buildActivity(evt);
        const deduped = (prev || []).filter(
          (item) => !(item.reservationId === next.reservationId && item.type === next.type),
        );
        return [next, ...deduped].slice(0, MAX_ACTIVITY_ITEMS);
      });
      const nextNotice = buildNotice(evt);
      showNotification?.(nextNotice.message, nextNotice.tone === "danger" ? "error" : nextNotice.tone);
    },
  });

  if (!notice && !activities.length) return null;

  const Icon = notice?.icon;
  const reservation = getReservation(latestEvent);

  return (
    <>
      {notice && (
        <div className={`${styles.reservationRealtimeNotice} ${styles[`reservationRealtimeNotice_${notice.tone}`] || ""}`}>
          <div className={styles.reservationRealtimeNoticeIcon}>
            <Icon size={20} />
          </div>

          <div className={styles.reservationRealtimeNoticeBody}>
            <div className={styles.reservationRealtimeNoticeMeta}>
              <span>{notice.badge}</span>
              {reservation?.partySize ? <span>{reservation.partySize} khách</span> : null}
              {reservation?.timeTo ? <span>{formatReservationTime(reservation.timeTo)}</span> : null}
            </div>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>

          <button
            type="button"
            className={styles.reservationRealtimeNoticeClose}
            onClick={() => setLatestEvent(null)}
            aria-label="Đóng thông báo đặt bàn"
          >
            Đóng
          </button>
        </div>
      )}

      {activities.length > 0 && (
        <div className={styles.reservationActivityPanel}>
          <div className={styles.reservationActivityHeader}>
            <div>
              <strong className={styles.reservationActivityTitle}>Hoạt động đặt bàn</strong>
              <span className={styles.reservationActivitySubtitle}>Theo dõi realtime từ khách/POS</span>
            </div>
            <button
              type="button"
              onClick={() => setActivities([])}
              className={styles.reservationActivityClear}
            >
              Xóa
            </button>
          </div>

          <div className={styles.reservationActivityList}>
            {activities.map((activity) => {
              const ActivityIcon = activity.icon;
              return (
                <div key={activity.id} className={`${styles.reservationActivityCard} ${styles[`reservationActivityCard_${activity.tone}`] || ""}`}>
                  <span className={styles.reservationActivityIcon}>
                    <ActivityIcon size={15} />
                  </span>
                  <span className={styles.reservationActivityContent}>
                    <strong>{activity.title}</strong>
                    <span>
                      {activity.tableLabel} · {activity.timeLabel}
                      {activity.partySize ? ` · ${activity.partySize} khách` : ""}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
