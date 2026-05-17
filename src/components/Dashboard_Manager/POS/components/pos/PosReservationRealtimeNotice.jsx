import React, { useMemo, useState } from "react";
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, Clock3, XCircle } from "lucide-react";
import useSocketReservation, { RESERVATION_EVENT_TYPES } from "@/hooks/useSocketReservation";
import { useNotification } from "@/hooks/useNotification";
import styles from "./POSLayout.module.scss";

function getReservation(evt) {
  return evt?.reservation || evt?.reservations?.[0] || null;
}

function getTableLabel(evt) {
  const reservation = getReservation(evt);
  return reservation?.tableCode || reservation?.tableName || reservation?.tableId || evt?.tableId || "bàn liên quan";
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

export default function PosReservationRealtimeNotice({ restaurantId }) {
  const { showNotification } = useNotification();
  const [latestEvent, setLatestEvent] = useState(null);

  const notice = useMemo(() => {
    return latestEvent ? buildNotice(latestEvent) : null;
  }, [latestEvent]);

  useSocketReservation(restaurantId, {
    onReservationEvent: (evt) => {
      setLatestEvent(evt);
      const nextNotice = buildNotice(evt);
      showNotification?.(nextNotice.message, nextNotice.tone === "danger" ? "error" : nextNotice.tone);
    },
  });

  if (!notice) return null;

  const Icon = notice.icon;
  const reservation = getReservation(latestEvent);

  return (
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
  );
}
